// backend/utils/notificationHelper.js
const admin = require('../config/firebase');
const User = require('../models/User');
const Notification = require('../models/Notification');

// FIX: Map the uppercase notification type enum values to the camelCase keys
// used in user.notificationSettings in the User schema.
// Without this map, user.notificationSettings['MATCH'] is always undefined,
// so the settings check never works and users can't mute notification types.
const TYPE_TO_SETTINGS_KEY = {
  MATCH: 'coFounderMatches',
  MENTOR: 'mentorSessions',
  EVENT: 'pitchEvents',
  TEAM_UPDATE: 'teamUpdates',
  FUNDING: 'fundingAlerts',
  COURSE: 'courseUpdates',
};

/**
 * Helper to send a push notification and save it to the database inbox.
 * @param {string} userId - ID of the user receiving the notification
 * @param {string} title - The headline of the alert
 * @param {string} body - The detailed message
 * @param {string} type - Category: 'MATCH' | 'MENTOR' | 'EVENT' | 'TEAM_UPDATE' | 'FUNDING' | 'COURSE'
 */
const sendNotification = async (userId, title, body, type, options = {}) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      console.log(`Notification skipped: User ${userId} not found.`);
      return;
    }

    const normalizedType = type.toUpperCase();

    // 1. Save to MongoDB (the persistent inbox shown in the UI)
    await Notification.create({
      recipient: userId,
      title,
      message: body,
      type: normalizedType,
      dedupeKey: options.dedupeKey || undefined
    });

    // 2. Send Firebase push notification (the device pop-up)
    // Check: user must have a saved FCM token AND must not have muted this type
    const settingsKey = TYPE_TO_SETTINGS_KEY[normalizedType];
    const isEnabled = settingsKey ? user.notificationSettings[settingsKey] !== false : true;

    if (user.fcmToken && isEnabled) {
      const message = {
        notification: { title, body },
        token: user.fcmToken,
      };
      await admin.messaging().send(message);
      console.log(`Push notification sent to ${user.name} (type: ${normalizedType})`);
    } else if (!user.fcmToken) {
      console.log(`Inbox-only notification for ${user.name}: no FCM token registered.`);
    } else {
      console.log(`Push suppressed for ${user.name}: type '${normalizedType}' is muted.`);
    }
  } catch (error) {
    if (error && error.code === 11000) {
      return;
    }
    console.error('Error in sendNotification helper:', error.message);
  }
};

module.exports = { sendNotification };
