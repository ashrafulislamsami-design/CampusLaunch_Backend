const Profile = require('../models/Profile');
const User = require('../models/User');

// @route   POST /api/profiles
// @desc    Create profile for logged-in student
exports.createProfile = async (req, res) => {
  try {
    // Prevent duplicate
    const existing = await Profile.findOne({ userId: req.user.id });
    if (existing) {
      return res.status(400).json({ message: 'Profile already exists. Use PUT to update.' });
    }

    // Pull base info from the User record so name/email are always consistent
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const {
      skills, lookingForSkills, pastProjects,
      startupIdea, weeklyAvailability, motivation,
      profileTag, linkedinUrl, isPublic,
      university, department, graduationYear
    } = req.body;

    const profile = new Profile({
      userId: req.user.id,
      name: user.name,
      email: user.email,
      university: university || user.university || '',
      department: department || user.department || '',
      graduationYear: graduationYear || user.graduationYear || null,
      skills: skills || [],
      lookingForSkills: lookingForSkills || [],
      pastProjects: pastProjects || [],
      startupIdea: startupIdea || '',
      weeklyAvailability: weeklyAvailability || 0,
      motivation: motivation || '',
      profileTag: profileTag || 'Ready to join a team',
      linkedinUrl: linkedinUrl || '',
      isPublic: isPublic !== undefined ? isPublic : true
    });

    await profile.save();
    res.status(201).json(profile);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @route   GET /api/profiles/me
// @desc    Get my own profile
exports.getMyProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.user.id });
    if (!profile) {
      return res.status(404).json({ message: 'No profile found. Please create one.' });
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @route   GET /api/profiles/:userId
// @desc    Get any public profile by userId
exports.getProfileByUserId = async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.params.userId, isPublic: true });
    if (!profile) return res.status(404).json({ message: 'Profile not found or is private' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @route   PUT /api/profiles
// @desc    Update my profile
exports.updateProfile = async (req, res) => {
  try {
    const {
      skills, lookingForSkills, pastProjects,
      startupIdea, weeklyAvailability, motivation,
      profileTag, linkedinUrl, isPublic,
      university, department, graduationYear
    } = req.body;

    const updateData = {
      skills, lookingForSkills, pastProjects,
      startupIdea, weeklyAvailability, motivation,
      profileTag, linkedinUrl, isPublic,
      university, department, graduationYear
    };

    // Remove undefined keys so we don't accidentally null them
    Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

    const profile = await Profile.findOneAndUpdate(
      { userId: req.user.id },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.json(profile);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @route   DELETE /api/profiles
// @desc    Delete my profile
exports.deleteProfile = async (req, res) => {
  try {
    const profile = await Profile.findOneAndDelete({ userId: req.user.id });
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.json({ message: 'Profile deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @route   GET /api/profiles
// @desc    Browse profiles with search/filter
exports.browseProfiles = async (req, res) => {
  try {
    const { skills, tag, minAvailability, maxAvailability, search, page = 1, limit = 12 } = req.query;

    const query = { isPublic: true };

    // Filter by skills (comma-separated)
    if (skills) {
      const skillArr = skills.split(',').map(s => s.trim().toLowerCase());
      query.skills = { $in: skillArr };
    }

    // Filter by profile tag
    if (tag) {
      query.profileTag = tag;
    }

    // Filter by weekly availability range
    if (minAvailability || maxAvailability) {
      query.weeklyAvailability = {};
      if (minAvailability) query.weeklyAvailability.$gte = Number(minAvailability);
      if (maxAvailability) query.weeklyAvailability.$lte = Number(maxAvailability);
    }

    // Text search on name, university, motivation, startupIdea
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { university: { $regex: search, $options: 'i' } },
        { motivation: { $regex: search, $options: 'i' } },
        { startupIdea: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [profiles, total] = await Promise.all([
      Profile.find(query).skip(skip).limit(Number(limit)).sort({ updatedAt: -1 }),
      Profile.countDocuments(query)
    ]);

    res.json({
      profiles,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};