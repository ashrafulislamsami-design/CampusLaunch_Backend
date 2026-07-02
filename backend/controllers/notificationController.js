// backend/controllers/notificationController.js
const Notification = require('../models/Notification');
const User = require('../models/User');

const seedShowcaseNotificationsIfNeeded = async (userId) => {
  const existingDemoCount = await Notification.countDocuments({
    recipient: userId,
    dedupeKey: { $regex: '^SHOWCASE_DEMO:' },
  });

  if (existingDemoCount > 0) return;

  const now = Date.now();
  const demoNotifications = [
    {
      recipient: userId,
      title: 'New team task in NovaSpark',
      message: 'Farhan added "Validate 10 customer interviews" to your Kanban board.',
      type: 'TEAM_UPDATE',
      isRead: false,
      dedupeKey: `SHOWCASE_DEMO:${userId}:TEAM_TASK`,
      createdAt: new Date(now - 1000 * 60 * 14),
    },
    {
      recipient: userId,
      title: 'New message in NovaSpark',
      message: 'Nabila posted an update about tomorrow\'s prototype review.',
      type: 'TEAM_UPDATE',
      isRead: false,
      dedupeKey: `SHOWCASE_DEMO:${userId}:TEAM_MESSAGE`,
      createdAt: new Date(now - 1000 * 60 * 48),
    },
    {
      recipient: userId,
      title: 'New document in NovaSpark',
      message: 'Investor one-pager v2 was uploaded to team resources.',
      type: 'TEAM_UPDATE',
      isRead: true,
      dedupeKey: `SHOWCASE_DEMO:${userId}:TEAM_DOCUMENT`,
      createdAt: new Date(now - 1000 * 60 * 120),
    },
    {
      recipient: userId,
      title: 'Watchlist funding closing soon',
      message: 'Campus Innovators Grant 2026 (Ministry of ICT) closes in 3 days.',
      type: 'FUNDING',
      isRead: false,
      dedupeKey: `SHOWCASE_DEMO:${userId}:FUNDING_3D`,
      createdAt: new Date(now - 1000 * 60 * 200),
    },
    {
      recipient: userId,
      title: 'Watchlist funding closing soon',
      message: 'Startup Sprint Micro-Fund (BD Angel Network) closes in 1 day.',
      type: 'FUNDING',
      isRead: true,
      dedupeKey: `SHOWCASE_DEMO:${userId}:FUNDING_1D`,
      createdAt: new Date(now - 1000 * 60 * 380),
    },
  ];

  try {
    await Notification.insertMany(demoNotifications, { ordered: false });
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }
  }
};

// 1. Get all notifications for the logged-in user (Inbox)
exports.getNotifications = async (req, res) => {
  try {
    await seedShowcaseNotificationsIfNeeded(req.user.id);
    const notifications = await Notification.find({ recipient: req.user.id })
      .sort({ createdAt: -1 }); // Newest first
    res.json(notifications);
  } catch (error) {
    console.error('getNotifications error:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
};

// 2. Get the count of unread notifications (used for the navbar bell badge)
exports.getUnreadCount = async (req, res) => {
  try {
    await seedShowcaseNotificationsIfNeeded(req.user.id);
    const count = await Notification.countDocuments({
      recipient: req.user.id,
      isRead: false,
    });
    res.json({ count });
  } catch (error) {
    console.error('getUnreadCount error:', error);
    res.status(500).json({ message: 'Error fetching unread count' });
  }
};

// 3. Mark a single notification as read
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { isRead: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ message: 'Marked as read' });
  } catch (error) {
    console.error('markAsRead error:', error);
    res.status(500).json({ message: 'Error updating notification' });
  }
};

// 4. Mark ALL notifications as read (for "Mark all as read" button in inbox)
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { isRead: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('markAllAsRead error:', error);
    res.status(500).json({ message: 'Error marking all as read' });
  }
};

// 5. Update the user's FCM Device Token (called from NotificationHandler.jsx on login)
exports.updateDeviceToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }
    await User.findByIdAndUpdate(req.user.id, { fcmToken: token });
    res.json({ message: 'Device token updated successfully' });
  } catch (error) {
    console.error('updateDeviceToken error:', error);
    res.status(500).json({ message: 'Error updating device token' });
  }
};

// 6. Update notification preferences (which types the user wants to receive)
exports.updateNotificationSettings = async (req, res) => {
  try {
    const { notificationSettings } = req.body;
    await User.findByIdAndUpdate(req.user.id, { notificationSettings });
    res.json({ message: 'Notification settings updated' });
  } catch (error) {
    console.error('updateNotificationSettings error:', error);
    res.status(500).json({ message: 'Error updating settings' });
  }
};

// 7. Get notification settings for the current user
exports.getNotificationSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('notificationSettings');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.notificationSettings);
  } catch (error) {
    console.error('getNotificationSettings error:', error);
    res.status(500).json({ message: 'Error fetching settings' });
  }
};
