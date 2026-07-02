// backend/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  updateDeviceToken,
  updateNotificationSettings,
  getNotificationSettings,
} = require('../controllers/notificationController');
const auth = require('../middleware/auth');

// GET  /api/notifications          → fetch full inbox
router.get('/', auth, getNotifications);

// GET  /api/notifications/unread-count → get badge number for navbar
router.get('/unread-count', auth, getUnreadCount);

// PUT  /api/notifications/read/:id → mark one as read
router.put('/read/:id', auth, markAsRead);

// PUT  /api/notifications/read-all → mark all as read
router.put('/read-all', auth, markAllAsRead);

// PUT  /api/notifications/update-token → save FCM token from device
router.put('/update-token', auth, updateDeviceToken);

// PUT  /api/notifications/settings → update user's notification preferences
router.put('/settings', auth, updateNotificationSettings);
router.get('/settings', auth, getNotificationSettings);

module.exports = router;
