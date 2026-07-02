const express = require('express');
const router = express.Router();
const { getEvents, registerTeam } = require('../controllers/eventController');
const auth = require('../middleware/auth');

// Note: In an actual production scenario, some routes might be protected. For events, we leave GET open to all users. 
// Registration requires a logged in team so we lock it.
router.get('/', auth, getEvents);
router.post('/:id/register', auth, registerTeam);

module.exports = router;
