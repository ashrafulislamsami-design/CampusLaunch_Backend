const admin = require('../config/firebase');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const emailService = require('../services/emailService');

// @route   POST /api/auth/register
// @desc    Register a new user
exports.register = async (req, res) => {
  try {
    const {
      email,
      password,
      name,
      role,
      university,
      department,
      graduationYear,
      skills,
      lookingFor,
      jobDetails,
      linkedinUrl,
      expertise,
      hoursPerWeek,
      workStyle,
      ideaStage,
      adminSecret
    } = req.body;

    // Enforce character limits on password input payload (Long Password DoS protection)
    if (password && typeof password === 'string' && password.length > 72) {
      return res.status(400).json({ message: 'Password is too long (maximum 72 characters).' });
    }

    // Validate admin registration
    if (role === 'Admin') {
      if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ message: 'Invalid admin secret key' });
      }
    }

    const normalizedSkills = Array.isArray(skills)
      ? skills.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const normalizedLookingFor = Array.isArray(lookingFor)
      ? lookingFor.map((s) => String(s).trim()).filter(Boolean)
      : [];

    if (role === 'Student' && normalizedSkills.length === 0) {
      return res.status(400).json({ message: 'At least one skill is required for students' });
    }
    if (role === 'Student' && normalizedLookingFor.length === 0) {
      return res.status(400).json({ message: 'At least one interest is required for students' });
    }
    if (role === 'Mentor' && !jobDetails) {
      return res.status(400).json({ message: 'Job details are required for mentors' });
    }

    // Extract Firebase user details if authenticated on client side
    const authHeader = req.header('Authorization');
    let firebaseUid; // undefined by default
    let finalEmail = email;

    if (authHeader && authHeader.startsWith('Bearer ') && process.env.FIREBASE_PROJECT_ID) {
      const idToken = authHeader.split(' ')[1];
      try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        firebaseUid = decodedToken.uid;
        finalEmail = decodedToken.email;
      } catch (err) {
        return res.status(401).json({ message: 'Firebase ID Token is invalid.' });
      }
    }

    // Check if user exists
    let user = await User.findOne({ email: finalEmail });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user instance
    user = new User({
      name,
      email: finalEmail,
      role,
      university,
      department,
      graduationYear,
      skills: normalizedSkills,
      lookingFor: normalizedLookingFor,
      jobDetails,
      linkedinUrl,
      expertise,
      hoursPerWeek: hoursPerWeek ? Number(hoursPerWeek) : null,
      workStyle: workStyle || null,
      ideaStage: ideaStage || null,
      ...(firebaseUid && { firebaseUid }),
      // Organizers start as pending until admin verifies them
      ...(role === 'Organizer' && { organizerVerified: 'pending' }),
    });

    // Hash password (development fallback)
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    } else {
      user.password = 'PURE_FIREBASE_AUTH_USER_PLACEHOLDER';
    }

    await user.save();

    // Fire-and-forget welcome email (additive; never blocks response)
    try {
      emailService.sendWelcomeEmail(user).catch((e) =>
        console.error('Welcome email failed:', e.message)
      );
    } catch (e) { console.error('Welcome email dispatch failed:', e.message); }

    // Create JWT payload (legacy token support for testing)
    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    // Sign token
    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'super_secret_jwt_key_1234',
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.status(201).json({ token, message: 'User registered successfully' });
      }
    );
  } catch (err) {
    console.error(err.message);
    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Enforce character limits on password input payload (Long Password DoS protection)
    if (password && typeof password === 'string' && password.length > 72) {
      return res.status(400).json({ message: 'Password is too long (maximum 72 characters).' });
    }

    // If client sends Firebase Auth ID token
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ') && process.env.FIREBASE_PROJECT_ID) {
      const idToken = authHeader.split(' ')[1];
      try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        let user = await User.findOne({ $or: [{ firebaseUid: uid }, { email: decodedToken.email }] });
        if (!user) {
          return res.status(400).json({ message: 'Invalid Credentials' });
        }

        if (!user.firebaseUid) {
          user.firebaseUid = uid;
          await user.save();
        }

        const payload = {
          user: {
            id: user.id,
            role: user.role
          }
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || 'super_secret_jwt_key_1234', { expiresIn: '1h' });
        return res.json({ token, message: 'Logged in successfully' });
      } catch (err) {
        return res.status(401).json({ message: 'Firebase ID Token is invalid.' });
      }
    }

    // Check for user
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    if (user.password === 'PURE_FIREBASE_AUTH_USER_PLACEHOLDER') {
      return res.status(400).json({ message: 'Invalid Credentials. Please sign in via Firebase Auth.' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    // Create JWT payload
    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    // Sign token
    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'super_secret_jwt_key_1234',
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, message: 'Logged in successfully' });
      }
    );
  } catch (err) {
    console.error(err.message);
    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @route   GET /api/auth/me
// @desc    Get user profile with Team Role
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    let teamRole = null;
    const Team = require('../models/Team');
    const team = await Team.findOne({ 'members.userId': req.user.id });
    if (team) {
      const mem = team.members.find(m => m.userId.toString() === req.user.id);
      if (mem) teamRole = mem.role;
    }

    res.json({ ...user.toObject(), teamRole });
  } catch (err) {
    console.error(err.message);
    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};
