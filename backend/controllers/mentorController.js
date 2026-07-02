const Mentor = require('../models/Mentor');
const User = require('../models/User');
const cache = require('../utils/cache');

// @route   POST /api/mentors/register
// @desc    Register as a mentor (only for users with role=Mentor)
exports.registerMentor = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user || user.role !== 'Mentor') {
      return res.status(403).json({ message: 'Only Mentor accounts can register as mentors' });
    }

    const existing = await Mentor.findOne({ userId: req.user.id });
    if (existing) return res.status(400).json({ message: 'Mentor profile already exists' });

    const { bio, expertise, availabilitySlots, sessionType, sessionPriceUSD } = req.body;

    // Validate expertise values
    const validExpertise = ['tech', 'marketing', 'finance', 'law', 'product', 'design', 'operations', 'fundraising'];
    if (expertise && Array.isArray(expertise)) {
      const invalidExpertise = expertise.filter(e => !validExpertise.includes(e));
      if (invalidExpertise.length > 0) {
        return res.status(400).json({ message: `Invalid expertise values: ${invalidExpertise.join(', ')}. Valid values are: ${validExpertise.join(', ')}` });
      }
    }

    const mentor = new Mentor({
      userId: user._id,
      name: user.name,
      email: user.email,
      jobDetails: user.jobDetails || '',
      linkedinUrl: user.linkedinUrl || '',
      expertise: expertise || user.expertise || [],
      bio: bio || '',
      availabilitySlots: availabilitySlots || [],
      sessionType: sessionType || 'free',
      sessionPriceUSD: sessionPriceUSD || 0
    });

    await mentor.save();
    res.status(201).json(mentor);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @route   GET /api/mentors
// @desc    List all mentors with filter
exports.listMentors = async (req, res) => {
  try {
    const { expertise, minRating, sessionType, page = 1, limit = 12 } = req.query;
    
    // Construct cache key based on query filters
    const cacheKey = `mentors:list:${expertise || ''}:${minRating || ''}:${sessionType || ''}:${page}:${limit}`;
    
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const query = { isActive: true };

    if (expertise) {
      query.expertise = { $in: expertise.split(',') };
    }
    if (sessionType) {
      query.sessionType = sessionType;
    }

    const skip = (Number(page) - 1) * Number(limit);
    let mentors = await Mentor.find(query).skip(skip).limit(Number(limit)).sort({ ratingSum: -1 });

    // Filter by rating after computing virtual
    if (minRating) {
      mentors = mentors.filter(m => m.averageRating >= Number(minRating));
    }

    const total = await Mentor.countDocuments(query);
    const result = { mentors, total, page: Number(page) };

    // Cache list for 5 minutes (300 seconds)
    await cache.set(cacheKey, result, 300);

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @route   GET /api/mentors/:mentorId
// @desc    Get one mentor's full profile
exports.getMentor = async (req, res) => {
  try {
    const mentor = await Mentor.findById(req.params.mentorId);
    if (!mentor) return res.status(404).json({ message: 'Mentor not found' });
    res.json(mentor);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @route   PUT /api/mentors/me
// @desc    Update my mentor profile
exports.updateMentor = async (req, res) => {
  try {
    const { bio, expertise, availabilitySlots, sessionType, sessionPriceUSD, isActive } = req.body;

    // Validate expertise values
    const validExpertise = ['tech', 'marketing', 'finance', 'law', 'product', 'design', 'operations', 'fundraising'];
    if (expertise && Array.isArray(expertise)) {
      const invalidExpertise = expertise.filter(e => !validExpertise.includes(e));
      if (invalidExpertise.length > 0) {
        return res.status(400).json({ message: `Invalid expertise values: ${invalidExpertise.join(', ')}. Valid values are: ${validExpertise.join(', ')}` });
      }
    }

    const mentor = await Mentor.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { bio, expertise, availabilitySlots, sessionType, sessionPriceUSD, isActive } },
      { new: true }
    );
    if (!mentor) return res.status(404).json({ message: 'Mentor profile not found' });
    res.json(mentor);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};