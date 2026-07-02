// backend/routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createMessage,
  getMessages,
  getPinnedMessages,
  togglePin,
  searchMessages,
  getTeamMembers
} = require('../controllers/messageController');

// POST /api/messages - Create a new message
router.post('/', auth, createMessage);

// GET /api/messages/:teamId - Get all messages for a team
router.get('/:teamId', auth, getMessages);

// GET /api/messages/:teamId/pinned - Get pinned messages
router.get('/:teamId/pinned', auth, getPinnedMessages);

// PATCH /api/messages/:id/pin - Toggle pin status
router.patch('/:id/pin', auth, togglePin);

// GET /api/messages/:teamId/search - Search messages
router.get('/:teamId/search', auth, searchMessages);

// GET /api/messages/:teamId/members - Get team members for @ mentions
router.get('/:teamId/members', auth, getTeamMembers);

module.exports = router;
