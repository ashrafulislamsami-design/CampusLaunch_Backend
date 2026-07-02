// backend/controllers/mentorNotificationController.js
const Booking = require('../models/Booking');
const Mentor = require('../models/Mentor');
const { sendNotification } = require('../utils/notificationHelper');

/**
 * Scans bookings and sends reminders for sessions starting in ~24 hours and ~1 hour.
 */
const sendMentorSessionReminders = async () => {
  try {
    const now = new Date();
    
    // 1. Reminders for 24 hours from now
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStart = new Date(tomorrow.getTime() - 15 * 60 * 1000); // 15 min window
    const tomorrowEnd = new Date(tomorrow.getTime() + 15 * 60 * 1000);

    const upcoming24h = await Booking.find({
      sessionDate: { $gte: tomorrowStart.toISOString().split('T')[0] },
      status: 'confirmed',
      reminderSent24h: { $ne: true }
    });

    for (const booking of upcoming24h) {
        // Simple check: is the session startTime matching the window roughly?
        // For production, we'd use a more precise UTC comparison.
        await sendNotification(
          booking.studentId,
          'Mentor Session Tomorrow',
          `Reminder: Your session with ${booking.mentorName} is in 24 hours.`,
          'MENTOR',
          { dedupeKey: `REMINDER_24H_STUDENT:${booking._id}` }
        );

        const mentor = await Mentor.findById(booking.mentorId);
        if (mentor && mentor.userId) {
          await sendNotification(
            mentor.userId,
            'Upcoming Session Tomorrow',
            `Reminder: You have a session with ${booking.studentName} in 24 hours.`,
            'MENTOR',
            { dedupeKey: `REMINDER_24H_MENTOR:${booking._id}` }
          );
        }
        
        booking.reminderSent24h = true;
        await booking.save();
    }

    // 2. Reminders for 1 hour from now
    const soon = new Date(now.getTime() + 1 * 60 * 60 * 1000);
    const soonStart = new Date(soon.getTime() - 15 * 60 * 1000);
    const soonEnd = new Date(soon.getTime() + 15 * 60 * 1000);

    const upcoming1h = await Booking.find({
      sessionDate: { $gte: soonStart.toISOString().split('T')[0] },
      status: 'confirmed',
      reminderSent1h: { $ne: true }
    });

    for (const booking of upcoming1h) {
      await sendNotification(
        booking.studentId,
        'Mentor Session in 1 Hour',
        `Your session with ${booking.mentorName} starts in 1 hour. Get ready!`,
        'MENTOR',
        { dedupeKey: `REMINDER_1H_STUDENT:${booking._id}` }
      );

      const mentor = await Mentor.findById(booking.mentorId);
      if (mentor && mentor.userId) {
        await sendNotification(
          mentor.userId,
          'Session Starting Soon',
          `Your session with ${booking.studentName} starts in 1 hour.`,
          'MENTOR',
          { dedupeKey: `REMINDER_1H_MENTOR:${booking._id}` }
        );
      }
      
      booking.reminderSent1h = true;
      await booking.save();
    }

  } catch (error) {
    console.error('Error in sendMentorSessionReminders:', error.message);
  }
};

module.exports = { sendMentorSessionReminders };
