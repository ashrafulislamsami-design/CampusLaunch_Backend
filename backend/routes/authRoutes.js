const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const auth = require('../middleware/auth');

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', authController.register);

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', authController.login);

// @route   GET /api/auth/me
// @desc    Get current user profile and team details
router.get('/me', auth, authController.getMe);

module.exports = router;


const { google } = require('googleapis');
const Mentor = require('../models/Mentor');

// Step 1: redirect mentor to Google consent
router.get('/google/calendar', auth, (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI
  );
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'],
    state: req.user.id // pass userId as state
  });
  res.redirect(url);
});

// Step 2: Google callback — save refresh_token to Mentor doc
router.get('/google/callback', async (req, res) => {
  const { code, state: userId } = req.query;
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI
  );
  const { tokens } = await oauth2Client.getToken(code);
  await Mentor.findOneAndUpdate(
    { userId },
    { googleRefreshToken: tokens.refresh_token }
  );
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/mentor/dashboard?calendarLinked=true`);
});