const EmailPreference = require('../models/EmailPreference');
const EmailLog = require('../models/EmailLog');

// Default shape returned when no preference doc exists yet.
const DEFAULT_PREFS = {
  coFounderMatches: { enabled: true, frequency: 'immediate' },
  mentorSessions: { enabled: true, frequency: 'immediate' },
  pitchEvents: { enabled: true, frequency: 'immediate' },
  fundingOpportunities: { enabled: true, frequency: 'immediate' },
  curriculumProgress: { enabled: true, frequency: 'immediate' },
  teamCanvasUpdates: { enabled: true, frequency: 'immediate' },
  weeklyDigest: { enabled: true }
};

const getOrCreatePref = async (userId) => {
  let pref = await EmailPreference.findOne({ user: userId });
  if (!pref) {
    pref = await EmailPreference.create({
      user: userId,
      preferences: DEFAULT_PREFS
    });
  }
  return pref;
};

// GET /api/email/preferences
exports.getPreferences = async (req, res) => {
  try {
    const pref = await getOrCreatePref(req.user.id);
    res.json(pref);
  } catch (err) {
    console.error('getPreferences error:', err.message);
    res.status(500).json({ message: 'Failed to load preferences' });
  }
};

// PUT /api/email/preferences
exports.updatePreferences = async (req, res) => {
  try {
    const pref = await getOrCreatePref(req.user.id);

    if (req.body.preferences) {
      Object.keys(req.body.preferences).forEach((key) => {
        if (pref.preferences[key]) {
          pref.preferences[key] = {
            ...(pref.preferences[key].toObject?.() || pref.preferences[key]),
            ...req.body.preferences[key]
          };
        }
      });
    }

    if (typeof req.body.unsubscribedAll === 'boolean') {
      pref.unsubscribedAll = req.body.unsubscribedAll;
    }

    await pref.save();
    res.json(pref);
  } catch (err) {
    console.error('updatePreferences error:', err.message);
    res.status(500).json({ message: 'Failed to update preferences' });
  }
};

// POST /api/email/preferences/reset
exports.resetPreferences = async (req, res) => {
  try {
    const pref = await getOrCreatePref(req.user.id);
    pref.preferences = DEFAULT_PREFS;
    pref.unsubscribedAll = false;
    await pref.save();
    res.json(pref);
  } catch (err) {
    console.error('resetPreferences error:', err.message);
    res.status(500).json({ message: 'Failed to reset preferences' });
  }
};

// GET /api/email/log
exports.getRecentLog = async (req, res) => {
  try {
    const logs = await EmailLog.find({ recipient: req.user.id })
      .sort({ sentAt: -1 })
      .limit(20)
      .select('emailType subject status sentAt resendMessageId');
    res.json(logs);
  } catch (err) {
    console.error('getRecentLog error:', err.message);
    res.status(500).json({ message: 'Failed to load email log' });
  }
};

// GET /api/email/unsubscribe/:token (no auth)
exports.unsubscribeByToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).send('Invalid link');

    const pref = await EmailPreference.findOne({ unsubscribeToken: token });
    if (!pref) return res.status(404).send('Unsubscribe link is invalid or expired');

    pref.unsubscribedAll = true;
    await pref.save();

    res.status(200).send(`<!doctype html>
<html><body style="font-family:sans-serif;max-width:520px;margin:60px auto;text-align:center;color:#111">
  <h1 style="color:#16a34a">You've been unsubscribed ✓</h1>
  <p style="color:#4b5563">You will no longer receive marketing or digest emails from CampusLaunch.</p>
  <p style="color:#6b7280;font-size:14px">You'll still receive essential transactional emails (password resets, session confirmations). Manage individual categories from your account settings.</p>
  <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings/email-preferences" style="color:#16a34a">Manage Preferences</a>
</body></html>`);
  } catch (err) {
    console.error('unsubscribeByToken error:', err.message);
    res.status(500).send('Unsubscribe failed');
  }
};

// POST /api/email/test/:emailType   (dev only)
exports.sendTestEmail = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Test endpoint disabled in production' });
    }
    const emailService = require('../services/emailService');
    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const type = req.params.emailType;
    const map = {
      welcome: () => emailService.sendWelcomeEmail(user),
      week_unlocked: () => emailService.sendWeekUnlocked(user, 3, 'Customer Discovery', 'Learn how to find your first 10 customers.'),
      connection_request: () => emailService.sendConnectionRequest(
        { ...user.toObject(), _id: user._id },
        user,
        'Hey, would love to team up on a health-tech idea I have!'
      ),
      curriculum_certificate: () => emailService.sendCurriculumCertificate(user)
    };
    if (!map[type]) return res.status(400).json({ message: 'Unknown test email type' });
    const result = await map[type]();
    res.json({ type, result });
  } catch (err) {
    console.error('sendTestEmail error:', err.message);
    res.status(500).json({ message: 'Failed to send test email' });
  }
};
