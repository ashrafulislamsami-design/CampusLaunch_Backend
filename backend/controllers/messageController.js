// backend/controllers/messageController.js
const Message = require('../models/Message');
const Team = require('../models/Team');
const User = require('../models/User');
const { sendNotification } = require('../utils/notificationHelper');

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// @desc    Create a new message in a team (with @ mention detection)
// @route   POST /api/messages
exports.createMessage = async (req, res) => {
  try {
    const { teamId, text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Verify user is an accepted member of the team
    const member = team.members.find(m => m.userId.toString() === req.user.id && m.status === 'accepted');
    if (!member) {
      return res.status(403).json({ message: 'You are not an accepted member of this team' });
    }

    const sender = await User.findById(req.user.id);

    // Parse @ mentions from text and notify only actual team members
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;

    const teamMemberIds = team.members.map((m) => m.userId.toString());

    while ((match = mentionRegex.exec(text)) !== null) {
      const username = match[1];
      // Find users whose name starts with the username (case-insensitive)
      // This matches the common pattern where @John matches "John Smith"
      const mentionedUser = await User.findOne({ 
        name: new RegExp(`^${escapeRegExp(username)}`, 'i') 
      });
      if (!mentionedUser) continue;
      const mentionedUserId = mentionedUser._id.toString();
      if (mentionedUserId === req.user.id) continue;
      if (!teamMemberIds.includes(mentionedUserId)) continue;
      mentions.push(mentionedUser._id);
    }

    // Create message
    const message = new Message({
      teamId,
      sender: req.user.id,
      senderName: sender.name,
      senderRole: member.role,
      text,
      mentions,
      isPinned: false
    });

    await message.save();

    // Send notifications to mentioned users
    const uniqueMentions = [...new Set(mentions.map((id) => id.toString()))];
    await Promise.all(
      uniqueMentions.map((mentionedUserId) =>
        sendNotification(
          mentionedUserId,
          `You were mentioned in ${team.name}`,
          `${sender.name} mentioned you: "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`,
          'TEAM_UPDATE'
        )
      )
    );

    res.status(201).json(message);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all messages for a team (with pagination)
// @route   GET /api/messages/:teamId
exports.getMessages = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Verify user is member of team
    const isMember = team.members.some(m => m.userId.toString() === req.user.id);
    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized to view this team' });
    }

    const skip = (page - 1) * limit;
    const messages = await Message.find({ teamId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('sender', 'name email')
      .populate('mentions', 'name email')
      .populate('pinnedBy', 'name');

    const total = await Message.countDocuments({ teamId });

    res.json({
      messages: messages.reverse(), // Return in chronological order
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get pinned messages for a team
// @route   GET /api/messages/:teamId/pinned
exports.getPinnedMessages = async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Verify user is member of team
    const isMember = team.members.some(m => m.userId.toString() === req.user.id);
    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized to view this team' });
    }

    const pinnedMessages = await Message.find({ teamId, isPinned: true })
      .sort({ pinnedAt: -1 })
      .populate('sender', 'name email')
      .populate('pinnedBy', 'name');

    res.json(pinnedMessages);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Pin/Unpin a message
// @route   PATCH /api/messages/:id/pin
exports.togglePin = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const team = await Team.findById(message.teamId);
    const member = team.members.find(m => m.userId.toString() === req.user.id && m.status === 'accepted');

    // Only team members can pin messages
    if (!member) {
      return res.status(403).json({ message: 'Not authorized to pin messages' });
    }

    if (message.isPinned) {
      // Unpin
      message.isPinned = false;
      message.pinnedBy = null;
      message.pinnedAt = null;
    } else {
      // Pin
      message.isPinned = true;
      message.pinnedBy = req.user.id;
      message.pinnedAt = new Date();
    }

    await message.save();
    res.json(message);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Search messages in a team
// @route   GET /api/messages/:teamId/search
exports.searchMessages = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { query } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Verify user is member of team
    const isMember = team.members.some(m => m.userId.toString() === req.user.id);
    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized to search this team' });
    }

    // MongoDB text search
    const results = await Message.find(
      { teamId, $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .populate('sender', 'name email')
      .populate('mentions', 'name email')
      .limit(50);

    res.json(results);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get team members for @ mention autocomplete
// @route   GET /api/messages/:teamId/members
exports.getTeamMembers = async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await Team.findById(teamId)
      .populate('members.userId', 'name email')
      .select('members');

    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Filter only accepted members
    const members = team.members
      .filter(m => m.status === 'accepted')
      .map(m => ({
        _id: m.userId._id,
        name: m.userId.name,
        email: m.userId.email,
        role: m.role
      }));

    res.json(members);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};
