const Connection = require('../models/Connection');
const User = require('../models/User');
const Notification = require('../models/Notification');
const emailService = require('../services/emailService');

// POST /api/connections/send - Send a connection request
const sendRequest = async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.user.id;

    // Validate
    if (!receiverId) {
      return res.status(400).json({ error: 'receiverId required' });
    }

    if (senderId === receiverId) {
      return res.status(400).json({ error: 'Cannot send connection to yourself' });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    // Check if connection already exists
    const existingConnection = await Connection.findOne({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId }
      ]
    });

    if (existingConnection) {
      return res.status(400).json({ error: 'Connection already exists' });
    }

    // Get sender info for notification
    const sender = await User.findById(senderId);

    // Create connection with pending status
    const connection = new Connection({
      sender: senderId,
      receiver: receiverId,
      message: message || '',
      status: 'pending'
    });

    await connection.save();
    await connection.populate('sender receiver', 'name email');

    // Create notification for receiver
    const notification = new Notification({
      recipient: receiverId,
      title: `Connection Request from ${sender.name}`,
      message: `${sender.name} wants to connect with you`,
      type: 'MATCH',
      dedupeKey: `connection_${connection._id}`,
      fromUser: senderId
    });

    await notification.save();

    res.status(201).json({
      connection,
      notificationSent: true
    });

    // Fire-and-forget: email the recipient about the new connection request
    try {
      emailService.sendConnectionRequest(sender, receiver, message || '')
        .catch((e) => console.error('Connection req email failed:', e.message));
    } catch (e) { console.error('Connection req email dispatch failed:', e.message); }
  } catch (error) {
    console.error('Send connection request error:', error);
    res.status(500).json({ error: 'Failed to send connection request' });
  }
};

// PATCH /api/connections/respond - Respond to a connection request
const respondToRequest = async (req, res) => {
  try {
    const { connectionId, status } = req.body;
    const userId = req.user.id;

    // Validate status
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be accepted or rejected' });
    }

    const connection = await Connection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Only receiver can respond
    if (connection.receiver.toString() !== userId) {
      return res.status(403).json({ error: 'Only receiver can respond to connection' });
    }

    // Only pending connections can be responded to
    if (connection.status !== 'pending') {
      return res.status(400).json({ error: 'Connection is no longer pending' });
    }

    // Update status
    connection.status = status;
    await connection.save();
    await connection.populate('sender receiver', 'name email');

    // Create notification for sender about the response
    const receiver = await User.findById(userId);
    const responseMessage = status === 'accepted' 
      ? `${receiver.name} accepted your connection request`
      : `${receiver.name} declined your connection request`;

    const notification = new Notification({
      recipient: connection.sender,
      title: `Connection ${status === 'accepted' ? 'Accepted' : 'Declined'}`,
      message: responseMessage,
      type: 'MATCH',
      dedupeKey: `connection_response_${connection._id}`,
      fromUser: userId
    });

    await notification.save();

    res.json({
      connection,
      notificationSent: true
    });

    // Fire-and-forget: email the original sender when request is accepted
    if (status === 'accepted') {
      try {
        (async () => {
          try {
            const requester = await User.findById(connection.sender).select('-password').lean();
            if (requester) {
              await emailService.sendConnectionAccepted(receiver, requester);
            }
          } catch (e) { console.error('Connection accept email failed:', e.message); }
        })();
      } catch (e) { console.error('Connection accept email dispatch failed:', e.message); }
    }
  } catch (error) {
    console.error('Respond to connection error:', error);
    res.status(500).json({ error: 'Failed to respond to connection' });
  }
};

// GET /api/connections - Get all connections for current user
const getConnections = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let query = {
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    };

    if (status) {
      query.status = status;
    }

    const connections = await Connection.find(query)
      .populate('sender receiver', 'name email university department skills')
      .sort({ createdAt: -1 });

    res.json(connections);
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
};

// GET /api/connections/pending - Get pending requests for current user as receiver
const getPendingRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    const connections = await Connection.find({
      receiver: userId,
      status: 'pending'
    })
      .populate('sender', 'name email university department skills')
      .sort({ createdAt: -1 });

    res.json(connections);
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
};

// GET /api/connections/active - Get all accepted connections for current user
const getActiveConnections = async (req, res) => {
  try {
    const userId = req.user.id;

    const connections = await Connection.find({
      status: 'accepted',
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    })
      .populate('sender', 'name email university department skills')
      .populate('receiver', 'name email university department skills')
      .sort({ createdAt: -1 });

    // Return structured list with 'partner' being the other user
    const enriched = connections.map(c => {
      const partner = c.sender._id.toString() === userId ? c.receiver : c.sender;
      return {
        connectionId: c._id,
        status: c.status,
        partner
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Get active connections error:', error);
    res.status(500).json({ error: 'Failed to fetch active connections' });
  }
};

module.exports = {
  sendRequest,
  respondToRequest,
  getConnections,
  getPendingRequests,
  getActiveConnections
};
