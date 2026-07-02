const User = require('../models/User');
const Team = require('../models/Team');

// @route   PUT /api/users/profile
// @desc    Update current user profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, university, department, skills, ideaStage, funding, pitchEvents, mentorSessions } = req.body;
    let user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (email) user.email = email;
    if (university && user.role === 'Student') user.university = university;
    if (department) user.department = department;
    if (ideaStage) user.ideaStage = ideaStage;
    if (funding !== undefined) user.funding = funding;
    if (pitchEvents !== undefined) user.pitchEvents = pitchEvents;
    if (mentorSessions !== undefined) user.mentorSessions = mentorSessions;
    
    // Map abstract interests to correct DB fields
    if (skills) {
      if (user.role === 'Student') user.skills = skills;
      if (user.role === 'Mentor') user.expertise = skills;
    }

    await user.save();
    
    // Scrub password before returning
    res.json(user.toObject({ transform: (doc, ret) => { delete ret.password; return ret; }}));
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
// @route   GET /api/users/watchlist
// @desc    Get current user's populated watchlist
exports.getUserWatchlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('watchlist');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.watchlist);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   GET /api/users/matching
// @desc    Co-founder matching logic based on missing team roles (Refined)
exports.getCoFounderMatches = async (req, res) => {
  try {
    // 1. Find the current team to identify gaps
    const myTeam = await Team.findOne({ 'members.userId': req.user.id });
    
    // 2. Find all students ALREADY on ANY team to exclude them
    const allTeams = await Team.find({}).select('members.userId');
    const usersInTeams = allTeams.reduce((acc, team) => {
      team.members.forEach(m => acc.push(m.userId.toString()));
      return acc;
    }, []);

    let missingSkills = [];
    let isFull = false;

    if (myTeam) {
      const filledRoles = myTeam.members.map(m => m.role);
      
      // Identify Gaps
      if (!filledRoles.includes('CTO')) missingSkills.push('Technology', 'Software', 'Development', 'Fullstack');
      if (!filledRoles.includes('CMO')) missingSkills.push('Marketing', 'Growth', 'Sales', 'Social Media');
      if (!filledRoles.includes('Designer')) missingSkills.push('UI/UX', 'Design', 'Figma', 'Adobe');

      if (missingSkills.length === 0) {
        isFull = true;
        // Fallback: Suggest Specialists/Advisors
        missingSkills = ['Venture Capital', 'Legal', 'Scaling', 'Architecture', 'Strategy'];
      }
    } else {
      // General suggestions for solo founders
      missingSkills = ['Technology', 'Marketing', 'Development', 'Design', 'Business'];
    }

    // 3. Query for Matches
    // Requirements: Student, NOT in any team, matching skills, has at least 2 skills
    const matches = await User.find({
      role: 'Student',
      _id: { $nin: usersInTeams },
      skills: { $in: missingSkills },
      $expr: { $gte: [{ $size: "$skills" }, 2] }
    }).select('-password').limit(12);

    res.json({
      teamStatus: myTeam 
        ? (isFull ? `Strategic Advisory for ${myTeam.name}` : `Bridge the gaps for ${myTeam.name}`)
        : 'Looking for a starting team',
      missingRoles: myTeam ? ['CTO', 'CMO', 'Designer'].filter(r => !myTeam.members.map(m => m.role).includes(r)) : ['All Core Roles'],
      isFull,
      matches
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
