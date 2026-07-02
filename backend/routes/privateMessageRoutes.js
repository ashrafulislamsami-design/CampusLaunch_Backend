const express = require('express');
const {
  sendMessage,
  getMessages,
  editMessage,
  deleteMessage,
  toggleSaveMessage
} = require('../controllers/privateMessageController');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require auth
router.use(auth);

// POST /api/private-messages/:connectionId - Send DM
router.post('/:connectionId', sendMessage);

// GET /api/private-messages/:connectionId - Get DMs
router.get('/:connectionId', getMessages);

// PATCH /api/private-messages/message/:messageId - Edit a message
router.patch('/message/:messageId', editMessage);

// DELETE /api/private-messages/message/:messageId - Delete a message
router.delete('/message/:messageId', deleteMessage);

// PATCH /api/private-messages/message/:messageId/save - Toggle save
router.patch('/message/:messageId/save', toggleSaveMessage);

module.exports = router;
