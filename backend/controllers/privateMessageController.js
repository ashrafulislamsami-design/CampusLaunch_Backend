const PrivateMessage = require('../models/PrivateMessage');
const Connection = require('../models/Connection');

// @desc    Send a direct message within a connection
// @route   POST /api/private-messages/:connectionId
exports.sendMessage = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const connection = await Connection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Must be accepted connection
    if (connection.status !== 'accepted') {
      return res.status(403).json({ error: 'Connection must be accepted to message' });
    }

    // Verify user is part of the connection
    if (connection.sender.toString() !== userId && connection.receiver.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized for this connection' });
    }

    const message = new PrivateMessage({
      connectionId,
      sender: userId,
      text
    });

    await message.save();
    res.status(201).json(message);

  } catch (error) {
    console.error('Send private message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get all direct messages for a connection
// @route   GET /api/private-messages/:connectionId
exports.getMessages = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.id;

    const connection = await Connection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    if (connection.sender.toString() !== userId && connection.receiver.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized for this connection' });
    }

    const messages = await PrivateMessage.find({ connectionId })
      .sort({ createdAt: 1 }); // Chronological order

    res.json(messages);

  } catch (error) {
    console.error('Get private messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Edit a message (sender only)
// @route   PATCH /api/private-messages/message/:messageId
exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const message = await PrivateMessage.findById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    if (message.sender.toString() !== userId) {
      return res.status(403).json({ error: 'Only the sender can edit this message' });
    }

    message.text = text.trim();
    message.isEdited = true;
    await message.save();

    res.json(message);
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Delete a message (sender only)
// @route   DELETE /api/private-messages/message/:messageId
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await PrivateMessage.findById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    if (message.sender.toString() !== userId) {
      return res.status(403).json({ error: 'Only the sender can delete this message' });
    }

    await PrivateMessage.findByIdAndDelete(messageId);
    res.json({ success: true, messageId });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Toggle save-for-later on a message
// @route   PATCH /api/private-messages/message/:messageId/save
exports.toggleSaveMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await PrivateMessage.findById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    // Verify user is party to the connection
    const connection = await Connection.findById(message.connectionId);
    if (!connection) return res.status(404).json({ error: 'Connection not found' });
    if (connection.sender.toString() !== userId && connection.receiver.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const savedIndex = message.savedBy?.findIndex(id => id.toString() === userId) ?? -1;
    if (savedIndex > -1) {
      message.savedBy.splice(savedIndex, 1); // Unsave
    } else {
      if (!message.savedBy) message.savedBy = [];
      message.savedBy.push(userId); // Save
    }
    await message.save();
    res.json(message);
  } catch (error) {
    console.error('Save message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
