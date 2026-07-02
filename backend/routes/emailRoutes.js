const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/emailPreferenceController');

// Public: one-click unsubscribe (no auth)
router.get('/unsubscribe/:token', ctrl.unsubscribeByToken);

// Authenticated
router.get('/preferences', auth, ctrl.getPreferences);
router.put('/preferences', auth, ctrl.updatePreferences);
router.post('/preferences/reset', auth, ctrl.resetPreferences);
router.get('/log', auth, ctrl.getRecentLog);

// Dev-only test trigger
router.post('/test/:emailType', auth, ctrl.sendTestEmail);

module.exports = router;
