const Groq = require('groq-sdk');
const Report = require('../models/Report');
const Team = require('../models/Team');
const emailService = require('../services/emailService');


// Helper function to calculate similarity between suggestion objects
function calculateSimilarity(suggestions1, suggestions2) {
  if (!suggestions1 || !suggestions2) return 0;

  let totalSimilarity = 0;
  let fieldCount = 0;

  ['problem', 'solution', 'target'].forEach(field => {
    if (suggestions1[field] && suggestions2[field]) {
      fieldCount++;
      const similarity = getStringSimilarity(suggestions1[field], suggestions2[field]);
      totalSimilarity += similarity;
    }
  });

  return fieldCount > 0 ? totalSimilarity / fieldCount : 0;
}

// Simple string similarity function
function getStringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

// Levenshtein distance calculation
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Fallback suggestions for when AI generates repetitive responses - Bangladesh focused
const fallbackSuggestions = [
  {
    problem: "Bangladeshi SMEs struggle to access affordable digital marketing tools and struggle to compete with larger brands online",
    solution: "An AI-powered digital marketing platform specifically designed for small businesses in Bangladesh with localized content and Bangladeshi payment integration",
    target: "Small and medium enterprises in Bangladesh with 5-100 employees looking to grow their online presence"
  },
  {
    problem: "Bangladeshi farmers face challenges in accessing real-time weather information and market prices for their crops",
    solution: "A mobile app that provides localized weather forecasts, crop disease detection via AI, and real-time market price information for Bangladeshi farmers",
    target: "Smallholder farmers in rural Bangladesh who need better access to agricultural information and market data"
  },
  {
    problem: "Bangladeshi students in rural areas lack access to quality educational resources and personalized learning support",
    solution: "An offline-first educational platform with AI-powered personalized learning paths, available in Bangla, designed for areas with poor internet connectivity",
    target: "Students in rural Bangladesh aged 12-18 who need better educational opportunities and exam preparation"
  },
  {
    problem: "Bangladeshi healthcare providers in rural clinics waste time on paperwork and struggle with patient record management",
    solution: "A cloud-based electronic health record system with telemedicine capabilities, designed specifically for Bangladesh's healthcare infrastructure",
    target: "Rural healthcare providers and small clinics in Bangladesh serving 500-5000 patients annually"
  },
  {
    problem: "Bangladeshi artisans and craftsmen struggle to reach global markets and get fair prices for their traditional handicrafts",
    solution: "An e-commerce platform connecting Bangladeshi artisans directly with international buyers, with AI-powered product categorization and quality verification",
    target: "Traditional artisans and craftsmen in Bangladesh producing textiles, jewelry, and handicrafts for export markets"
  }
];

// @route   POST /api/ai/validate
// @desc    Validate startup idea using AI
// @access  Private
exports.validateIdea = async (req, res) => {
  try {
    const { problem, solution, target } = req.body;
    let teamId = req.body.teamId;

    // --- Automatic Team Linking ---
    if (!teamId) {
      const userTeam = await Team.findOne({ "members.userId": req.user.id });
      if (userTeam) {
        teamId = userTeam._id;
        console.log(`Auto-linking AI report to team: ${userTeam.name}`);
      }
    }

    // Check which fields are provided and which need suggestions
    const providedFields = {
      problem: problem?.trim() || '',
      solution: solution?.trim() || '',
      target: target?.trim() || ''
    };

    const missingFields = Object.entries(providedFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    const looksLikeGibberish = (text) => {
      const normalized = text.trim().toLowerCase();
      if (!normalized || normalized.length < 6) return false;
      const letters = normalized.match(/[a-z]/g) || [];
      if (!letters.length) return true;
      const vowelCount = letters.filter((ch) => 'aeiou'.includes(ch)).length;
      const vowelRatio = vowelCount / letters.length;
      const uniqueRatio = new Set(letters).size / letters.length;
      const repeatedPattern = [2, 3, 4].some((size) => {
        const pattern = normalized.slice(0, size);
        return pattern && normalized === pattern.repeat(Math.ceil(normalized.length / size)).slice(0, normalized.length);
      });
      return vowelRatio < 0.18 || uniqueRatio < 0.28 || repeatedPattern;
    };

    const invalidInput = Object.entries(providedFields).find(
      ([, value]) => value && looksLikeGibberish(value)
    );
    if (invalidInput) {
      return res.status(400).json({
        message: `The ${invalidInput[0]} field looks invalid. Please enter a real idea description instead of random text.`
      });
    }

    // Build prompt for Groq
    const isAllEmpty = missingFields.length === 3; // All fields are empty
    const randomSeed = Math.floor(Math.random() * 1000); // Add randomness

    let prompt = `Analyze as a VC. Return ONLY JSON with this exact structure: { suggestions: { problem?: "", solution?: "", target?: "" }, analysis: { marketSize, competitors: [], similarCompanies: [], swot: {s,w,o,t}, risks: [], nextSteps: [] } }

Provided information:
${providedFields.problem ? `Problem: ${providedFields.problem}` : 'Problem: [NOT PROVIDED - please suggest one]'}
${providedFields.solution ? `Solution: ${providedFields.solution}` : 'Solution: [NOT PROVIDED - please suggest one]'}
${providedFields.target ? `Target Market: ${providedFields.target}` : 'Target Market: [NOT PROVIDED - please suggest one]'}

Instructions:
${isAllEmpty ?
`1. Since NO information was provided, generate creative and varied startup ideas. Random seed: ${randomSeed}. Create unique suggestions that are different from typical examples.
2. PRIORITY: Generate ideas that are relevant to Bangladesh first - consider local problems, culture, economy, and market needs in Bangladesh.
3. Choose from diverse industries: edtech, fintech, healthtech, sustainability, AI/ML, gaming, e-commerce, social impact, agriculture, manufacturing, etc.
4. Make each suggestion original and specific - avoid generic "social media" or "food delivery" ideas.
5. IMPORTANT: Do NOT suggest anything related to LGBTQ+ topics, gender identity, or sexual orientation. Focus on business, technology, education, healthcare, and economic development.
6. Ensure suggestions are realistic and have clear market potential in Bangladesh context.` :
`1. If any field is marked as "[NOT PROVIDED]", generate a relevant suggestion based on the other provided information
2. Make suggestions that complement the provided information naturally
3. Prioritize Bangladesh context and avoid LGBTQ+ related topics`}

3. Always provide a complete, hyper-professional structural analysis.
4. For similarCompanies: 3-5 REAL startups/companies in this space.
5. For analysis, include:
   - marketSize: A realistic 5-7 year TAM/SAM estimation in USD or BDT.
   - swot: Clear S (Strengths), W (Weaknesses), O (Opportunities), T (Threats).
   - risks: Top 3 critical risks (Execution, Market, Technical).
   - nextSteps: 3-5 actionable milestones for a student founder.
   - personas: Describe 'Best Customers' (demographics/pain points).
6. Prioritize the Bangladesh market context and avoid generic filler.
7. Avoid LGBTQ+ topics or sensitive social agendas.`;

    // Call Groq API
    console.log('Calling Groq API for idea validation...');
    console.log('Missing fields:', missingFields);

    // Call Groq API
    console.log('Calling Groq API for idea validation...');
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

      return res.status(500).json({
        message: 'AI service temporarily unavailable',
        error: apiError.message
      });
    }

    // Parse Groq response
    let responseText = completion.choices[0].message.content.trim();
    console.log('Groq Response:', responseText);
    console.log('Raw response text length:', responseText.length);

    // Clean the response by removing markdown code blocks if present
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    console.log('Cleaned response:', responseText);

    let aiResponse;
    try {
      aiResponse = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse Groq response:', parseErr);
      return res.status(500).json({
        message: 'Failed to parse AI response',
        error: 'Invalid JSON from AI service'
      });
    }

    // Validate the structure of aiResponse
    if (!aiResponse.suggestions || !aiResponse.analysis) {
      console.log('AI response missing structure, using fallback for empty fields');
      if (isAllEmpty) {
        const randomFallback = fallbackSuggestions[Math.floor(Math.random() * fallbackSuggestions.length)];
        aiResponse = {
          suggestions: {
            problem: randomFallback.problem,
            solution: randomFallback.solution,
            target: randomFallback.target
          },
          analysis: {
            marketSize: 50000000,
            competitors: ["Generic Competitor A", "Generic Competitor B"],
            similarCompanies: ["CompanyX", "CompanyY", "CompanyZ"],
            swot: { s: "Strong market need", w: "New entrant", o: "Growing market", t: "Competition" },
            risks: ["Market adoption", "Competition"],
            nextSteps: ["Market research", "Prototype development", "User testing"]
          }
        };
      } else {
        return res.status(500).json({
          message: 'AI response missing required structure',
          error: 'Response must contain suggestions and analysis objects'
        });
      }
    }

    // Check for repetitive suggestions when all fields are empty
    if (isAllEmpty && aiResponse.suggestions) {
      // Get recent reports to check for repetition
      const recentReports = await Report.find({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }).limit(5).sort({ createdAt: -1 });

      const recentSuggestions = recentReports.map(r => r.suggestions).filter(s => s);

      // Check if current suggestions are too similar to recent ones
      const isRepetitive = recentSuggestions.some(recent => {
        if (!recent) return false;
        const similarity = calculateSimilarity(aiResponse.suggestions, recent);
        return similarity > 0.7; // 70% similarity threshold
      });

      if (isRepetitive) {
        console.log('AI suggestions are repetitive, using fallback');
        const randomFallback = fallbackSuggestions[Math.floor(Math.random() * fallbackSuggestions.length)];
        aiResponse.suggestions = {
          problem: randomFallback.problem,
          solution: randomFallback.solution,
          target: randomFallback.target
        };
      }
    }

    const requiredAnalysisKeys = ['marketSize', 'competitors', 'similarCompanies', 'swot', 'risks', 'nextSteps'];
    const swotKeys = ['s', 'w', 'o', 't'];

    for (const key of requiredAnalysisKeys) {
      if (!(key in aiResponse.analysis)) {
        return res.status(500).json({
          message: 'AI response analysis missing required fields',
          error: `Missing ${key} in analysis`
        });
      }
    }

    if (!Array.isArray(aiResponse.analysis.similarCompanies)) {
      return res.status(500).json({
        message: 'AI response similarCompanies field must be an array',
        error: 'similarCompanies must be an array'
      });
    }

    if (typeof aiResponse.analysis.swot !== 'object' || aiResponse.analysis.swot === null) {
      return res.status(500).json({
        message: 'AI response swot field is not an object'
      });
    }

    for (const key of swotKeys) {
      if (!(key in aiResponse.analysis.swot)) {
        return res.status(500).json({
          message: 'AI response swot missing required fields',
          error: `Missing ${key} in swot`
        });
      }
    }

    // Prepare the final response with suggestions and completed fields
    const finalIdeaData = {
      problem: providedFields.problem || aiResponse.suggestions.problem || '',
      solution: providedFields.solution || aiResponse.suggestions.solution || '',
      target: providedFields.target || aiResponse.suggestions.target || ''
    };

    // Save report to database
    const report = new Report({
      userId: req.user.id,
      teamId, // Now automatically populated or passed
      ideaData: finalIdeaData,
      aiResponse: aiResponse.analysis,
      suggestions: aiResponse.suggestions,
      missingFields: missingFields
    });

    await report.save();

    res.json({
      message: 'Idea validated successfully',
      report: {
        id: report._id,
        ideaData: finalIdeaData,
        aiResponse: aiResponse.analysis,
        suggestions: aiResponse.suggestions,
        missingFields: missingFields,
        createdAt: report.createdAt
      }
    });

  } catch (error) {
    console.error('Error in validateIdea:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};

// @route   GET /api/ai/reports/:id
// @desc    Get AI report details
// @access  Private
exports.getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    if (report.userId.toString() === req.user.id) {
      return res.json(report);
    }

    if (report.teamId) {
      const team = await Team.findById(report.teamId);
      if (team && team.members.some((member) => member.userId.toString() === req.user.id)) {
        return res.json(report);
      }
    }

    return res.status(403).json({ message: 'Access denied' });
  } catch (error) {
    console.error('Error fetching AI report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
// @desc    Retrieve all AI reports for a specific team
// @access  Private
exports.getTeamReports = async (req, res) => {
  try {
    const { teamId } = req.params;
    if (req.user.role !== 'Organizer') {
      const team = await Team.findById(teamId);
      if (!team) return res.status(404).json({ message: 'Team not found' });
      const isMember = team.members.some(m => m.userId.toString() === req.user.id);
      if (!isMember) {
        return res.status(403).json({ message: 'Not authorized to view these reports' });
      }
    }
    const reports = await Report.find({ teamId }).sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    console.error('Error fetching team reports:', err.message);
    res.status(500).json({ message: 'Server error fetching team reports' });
  }
};
