const Groq = require('groq-sdk');
const User = require('../models/User');
const Connection = require('../models/Connection');
const Team = require('../models/Team');
const { sendNotification } = require('../utils/notificationHelper');
const emailService = require('../services/emailService');


const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// In-memory cache: { userId -> { matches, teamStatus, missingRoles, isFull, expiresAt } }
const matchCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// POST /api/match - Generate AI-powered matches using Groq
const calculateComplementarityScore = (skills1, skills2) => {
  const techKeywords = ['javascript', 'python', 'java', 'react', 'node', 'fullstack', 'frontend', 'backend', 'developer', 'engineer', 'coding'];
  const businessKeywords = ['marketing', 'sales', 'business', 'growth', 'finance', 'strategy', 'operations', 'management'];
  const designKeywords = ['design', 'ui', 'ux', 'figma', 'creative', 'graphic', 'branding'];

  const s1 = (skills1 || []).map(s => s.toLowerCase());
  const s2 = (skills2 || []).map(s => s.toLowerCase());

  const hasTech = s => s.some(skill => techKeywords.some(k => skill.includes(k)));
  const hasBusiness = s => s.some(skill => businessKeywords.some(k => skill.includes(k)));
  const hasDesign = s => s.some(skill => designKeywords.some(k => skill.includes(k)));

  const p1 = { tech: hasTech(s1), business: hasBusiness(s1), design: hasDesign(s1) };
  const p2 = { tech: hasTech(s2), business: hasBusiness(s2), design: hasDesign(s2) };

  let score = 0;
  let reason = '';

  if (p1.tech && (p2.business || p2.design)) {
    score = 25;
    reason = `Technical + ${p2.business ? 'Business' : 'Design'} synergy`;
  } else if ((p1.business || p1.design) && p2.tech) {
    score = 25;
    reason = `${p1.business ? 'Business' : 'Design'} + Technical synergy`;
  } else if (p1.business && p2.design) {
    score = 15;
    reason = 'Business + Design synergy';
  } else if (p1.design && p2.business) {
    score = 15;
    reason = 'Design + Business synergy';
  }

  return { score, reason };
};

const calculateInterestScore = (interests1, interests2) => {
  const i1 = (interests1 || []).map(i => i.toLowerCase());
  const i2 = (interests2 || []).map(i => i.toLowerCase());
  
  const common = i1.filter(i => i2.includes(i));
  const score = Math.min(common.length * 5, 15);
  
  return { 
    score, 
    common: common.slice(0, 2) 
  };
};

const generateMatchReason = (compReason, commonInterests, hoursDiff, workStyleMatch, stageMatch) => {
  let parts = [];
  
  if (compReason) {
    parts.push(compReason);
  } else {
    parts.push('Balanced skill overlap');
  }

  if (commonInterests.length > 0) {
    parts.push(`shared interest in ${commonInterests.join(' & ')}`);
  }

  if (hoursDiff <= 10) {
    parts.push('similar commitment levels');
  } else if (hoursDiff >= 20) {
    parts.push('notable commitment gap');
  }

  if (workStyleMatch) {
    parts.push('matching work style');
  }

  if (stageMatch) {
    parts.push('aligned startup stage');
  }

  const reason = parts.join(', ') + '.';
  return reason.charAt(0).toUpperCase() + reason.slice(1);
};

// POST /api/match - Generate AI-powered matches using Groq
const generateMatches = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware

    // --- Cache check ---
    const cached = matchCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`Serving cached matches for user ${userId}`);
      return res.json({
        teamStatus: cached.teamStatus,
        missingRoles: cached.missingRoles,
        isFull: cached.isFull,
        matches: cached.matches,
        cached: true
      });
    }

    // Fetch current user profile and team concurrently
    const [currentUserFull, userTeam] = await Promise.all([
      User.findById(userId).select('name role university department graduationYear skills lookingFor hoursPerWeek workStyle ideaStage'),
      Team.findOne({ "members.userId": userId })
    ]);

    if (!currentUserFull) {
      return res.status(404).json({ error: 'User not found' });
    }

    let teamMemberIds = [];
    let missingRoles = ['All Core Roles'];
    let teamStatus = 'Looking for a starting team';
    let isFull = false;

    if (userTeam) {
      teamMemberIds = userTeam.members.map(m => m.userId.toString());
      const filledRoles = userTeam.members.map(m => m.role);
      
      missingRoles = ['CTO', 'CMO', 'Designer'].filter(r => !filledRoles.includes(r));
      if (missingRoles.length === 0) {
         isFull = true;
         teamStatus = `Strategic Advisory for ${userTeam.name}`;
      } else {
         teamStatus = `Bridge the gaps for ${userTeam.name}`;
      }
    }

    // Fetch all other student profiles
    const otherStudents = await User.find({
      role: 'Student',
      _id: { $ne: req.user.id, $nin: teamMemberIds }
    }).select('name email university department graduationYear skills lookingFor hoursPerWeek workStyle ideaStage');

    if (otherStudents.length === 0) {
      return res.json({ matches: [] });
    }

    // Build prompt for Groq
    const profileData = {
      currentUser: {
        name: currentUserFull.name,
        university: currentUserFull.university,
        department: currentUserFull.department,
        graduationYear: currentUserFull.graduationYear,
        skills: currentUserFull.skills,
        interests: currentUserFull.lookingFor,
        hoursPerWeek: currentUserFull.hoursPerWeek ?? 'unknown',
        workStyle: currentUserFull.workStyle ?? 'unknown',
        ideaStage: currentUserFull.ideaStage ?? 'unknown'
      },
      candidates: otherStudents.map(s => ({
        id: s._id.toString(),
        name: s.name,
        university: s.university,
        department: s.department,
        graduationYear: s.graduationYear,
        skills: s.skills,
        interests: s.lookingFor,
        hoursPerWeek: s.hoursPerWeek ?? 'unknown',
        workStyle: s.workStyle ?? 'unknown',
        ideaStage: s.ideaStage ?? 'unknown'
      }))
    };

const prompt = `You are an AI co-founder matching engine for CampusLaunch, a student startup platform.
Your job is to perform a MULTI-DIMENSIONAL analysis and return a JSON array of match scores.

## SCORING RULES (strictly apply all of these):
1. BASE SCORE: Start with complementarity of skills. If current user is technical (developer/engineer), prefer business/marketing/design candidates, and vice versa.
2. INTERESTS ALIGNMENT: If both students share startup interests (e.g. both want to build a SaaS product), add up to 15 points.
3. HOURS PENALTY: If the difference in hoursPerWeek between the current user and a candidate is >= 20 hours, REDUCE the score by 30%. This prevents future team conflict from mismatched commitment levels.
4. WORK STYLE BONUS: If workStyle matches (both remote, both in-person, or both hybrid), add 5 points.
5. IDEA STAGE ALIGNMENT: If ideaStage is compatible (e.g. both at 'idea' or both at 'mvp'), add up to 10 points.
6. MAXIMUM score is 100. Scores must be integers.
7. CRITICAL: Avoid 100% scores. Only assign 100% if the skills, interests, hours, workStyle, and ideaStage are all a PERFECT match. Be conservative with scores; a 70-85 is a very good match.

## CURRENT USER PROFILE:
- Name: ${profileData.currentUser.name}
- Skills: ${profileData.currentUser.skills.join(', ')}
- Interests/Looking For: ${Array.isArray(profileData.currentUser.interests) ? profileData.currentUser.interests.join(', ') : profileData.currentUser.interests}
- Hours per week available: ${profileData.currentUser.hoursPerWeek}
- Work style preference: ${profileData.currentUser.workStyle}
- Startup idea stage: ${profileData.currentUser.ideaStage}

## CANDIDATE PROFILES:
${profileData.candidates.map(c => `- ID: ${c.id}
  Name: ${c.name}
  Skills: ${c.skills.join(', ')}
  Interests: ${Array.isArray(c.interests) ? c.interests.join(', ') : c.interests}
  Hours/week: ${c.hoursPerWeek}
  Work style: ${c.workStyle}
  Idea stage: ${c.ideaStage}`).join('\n')}

## TASK:
Return ONLY a valid JSON array, no extra text, no markdown. Format:
[{"userId": "<candidate id>", "matchScore": <integer 0-100>, "reason": "<2-3 sentence explanation mentioning specific skill complementarity and any penalty applied>"}]

Sort results from highest to lowest matchScore. Include all candidates.`;

    // Call Groq API
    console.log('Calling Groq API...');
    let completion;
    try {
      if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes('YOUR_')) {
        throw new Error('GROQ_API_KEY is not configured');
      }

      completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      console.log('Groq API call completed successfully');
    } catch (apiError) {
      console.error('Groq API call failed:', apiError.message);
      
      // Trigger admin alert email
      emailService.sendGroqAlert(apiError.message, 'llama-3.3-70b-versatile');

      console.log('Falling back to robust rule-based matching...');
      
      // Fallback: Robust rule-based matching
      const fallbackMatches = otherStudents.map(student => {
        let score = 50; // Base score
        
        // 1. Skill complementarity
        const comp = calculateComplementarityScore(currentUserFull.skills, student.skills);
        score += comp.score;
        
        // 2. Interest alignment
        const interest = calculateInterestScore(currentUserFull.lookingFor, student.lookingFor);
        score += interest.score;
        
        // 3. Hours Penalty
        const h1 = currentUserFull.hoursPerWeek || 0;
        const h2 = student.hoursPerWeek || 0;
        const hoursDiff = Math.abs(h1 - h2);
        if (hoursDiff >= 20) {
          score *= 0.7;
        }

        // 4. Work Style Bonus
        const workStyleMatch = currentUserFull.workStyle === student.workStyle && currentUserFull.workStyle !== null;
        if (workStyleMatch) {
          score += 5;
        }

        // 5. Idea Stage Alignment
        const stageMatch = currentUserFull.ideaStage === student.ideaStage && currentUserFull.ideaStage !== null;
        if (stageMatch) {
          score += 10;
        }
        
        const finalScore = Math.min(Math.round(score), 95);
        const reason = generateMatchReason(comp.reason, interest.common, hoursDiff, workStyleMatch, stageMatch);
        
        return {
          userId: student._id.toString(),
          matchScore: finalScore,
          reason: reason
        };
      }).sort((a, b) => b.matchScore - a.matchScore);

      
      // Enrich fallback matches with user details
      const enrichedMatches = await Promise.all(
        fallbackMatches.map(async (match) => {
          const u = await User.findById(match.userId).select(
            'name email university department skills hoursPerWeek workStyle ideaStage'
          );
          return {
            userId: match.userId,
            name: u?.name,
            email: u?.email,
            university: u?.university,
            department: u?.department,
            skills: u?.skills,
            hoursPerWeek: u?.hoursPerWeek,
            workStyle: u?.workStyle,
            ideaStage: u?.ideaStage,
            matchScore: match.matchScore,
            reason: match.reason
          };
        })
      );
      
      return res.json({ teamStatus, missingRoles, isFull, matches: enrichedMatches });
    }

    // Parse Groq response
    let matches = [];
    try {
      const responseText = completion.choices[0].message.content || '';
      console.log('Groq Response:', responseText);
      
      // Extract JSON from response (may have extra text) without using backtracking regex
      let jsonStr = responseText;
      const firstIndex = responseText.indexOf('[');
      const lastIndex = responseText.lastIndexOf(']');
      if (firstIndex !== -1 && lastIndex !== -1 && lastIndex > firstIndex) {
        jsonStr = responseText.substring(firstIndex, lastIndex + 1);
      }
      matches = JSON.parse(jsonStr);
      console.log('Parsed matches:', matches.length, 'matches found');
    } catch (parseErr) {
      console.error('Failed to parse Groq response:', parseErr);
      console.error('Response text:', completion.choices[0].message.content);
      return res.status(500).json({ error: 'Failed to process matches' });
    }

    // Enrich matches with user details
    const enrichedMatches = await Promise.all(
      matches.map(async (match) => {
        const fetchId = match.userId || match.id;
        const u = await User.findById(fetchId).select(
          'name email university department skills hoursPerWeek workStyle ideaStage'
        );
        return {
          userId: fetchId,
          name: u?.name,
          email: u?.email,
          university: u?.university,
          department: u?.department,
          skills: u?.skills,
          hoursPerWeek: u?.hoursPerWeek,
          workStyle: u?.workStyle,
          ideaStage: u?.ideaStage,
          matchScore: Math.round(match.matchScore),
          reason: match.reason
        };
      })
    );

    // Cache the successful AI result
    matchCache.set(userId, {
      matches: enrichedMatches,
      teamStatus,
      missingRoles,
      isFull,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    // --- Trigger Notification for High-Quality Match ---
    if (enrichedMatches.length > 0 && enrichedMatches[0].matchScore >= 85) {
      const topMatch = enrichedMatches[0];
      await sendNotification(
        userId,
        'New co-founder match!',
        `AI found a ${topMatch.matchScore}% match: ${topMatch.name} from ${topMatch.university}.`,
        'MATCH',
        { dedupeKey: `MATCH:${userId}:${topMatch.userId}:${new Date().toISOString().split('T')[0]}` }
      );
    }

    res.json({ teamStatus, missingRoles, isFull, matches: enrichedMatches });
  } catch (error) {
    console.error('Match generation error:', error);
    res.status(500).json({ error: 'Failed to generate matches' });
  }
};

// POST /api/match/connect - Create connection request
const createConnection = async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.user.id;

    // Validate
    if (!receiverId) {
      return res.status(400).json({ error: 'receiverId required' });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    // Check if connection already exists
    const existingConnection = await Connection.findOne({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId }
      ]
    });

    if (existingConnection) {
      return res.status(400).json({ error: 'Connection already exists' });
    }

    // Create connection
    const connection = new Connection({
      sender: senderId,
      receiver: receiverId,
      message: message || '',
      status: 'pending'
    });

    await connection.save();
    await connection.populate('sender receiver', 'name email');

    res.status(201).json(connection);
  } catch (error) {
    console.error('Connection creation error:', error);
    res.status(500).json({ error: 'Failed to create connection' });
  }
};

// GET /api/match/connections - Get all connections for current user
const getConnections = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let query = {
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    };

    if (status) {
      query.status = status;
    }

    const connections = await Connection.find(query)
      .populate('sender receiver', 'name email university department skills')
      .sort({ createdAt: -1 });

    res.json(connections);
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
};

// PATCH /api/match/connections/:id/accept - Accept connection
const acceptConnection = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const connection = await Connection.findById(id);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Only receiver can accept
    if (connection.receiver.toString() !== userId) {
      return res.status(403).json({ error: 'Only receiver can accept connection' });
    }

    connection.status = 'accepted';
    await connection.save();
    await connection.populate('sender receiver', 'name email');

    res.json(connection);
  } catch (error) {
    console.error('Accept connection error:', error);
    res.status(500).json({ error: 'Failed to accept connection' });
  }
};

// DELETE /api/match/connections/:id - Decline/delete connection
const deleteConnection = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const connection = await Connection.findById(id);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Only sender or receiver can delete
    if (connection.sender.toString() !== userId && connection.receiver.toString() !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Connection.findByIdAndDelete(id);
    res.json({ message: 'Connection deleted' });
  } catch (error) {
    console.error('Delete connection error:', error);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
};

module.exports = {
  generateMatches,
  createConnection,
  getConnections,
  acceptConnection,
  deleteConnection
};
