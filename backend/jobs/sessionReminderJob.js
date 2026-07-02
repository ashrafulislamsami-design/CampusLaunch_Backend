const cron = require('node-cron');
const Booking = require('../models/Booking');
const Mentor = require('../models/Mentor');
const User = require('../models/User');
const EmailLog = require('../models/EmailLog');
const emailService = require('../services/emailService');

// Every 30 minutes: send reminders for sessions starting ~24h and ~1h from now.
const CRON_EXPR = '*/30 * * * *';

const bookingStartAt = (booking) => {
  if (!booking?.sessionDate || !booking?.startTime) return null;
  const [h, m] = (booking.startTime || '00:00').split(':').map(Number);
  const d = new Date(booking.sessionDate);
  d.setUTCHours(h || 0, m || 0, 0, 0);
  return d;
};

const alreadySent = async (bookingId, hoursUntil, userId) => {
  const log = await EmailLog.findOne({
    recipient: userId,
    emailType: 'session_reminder',
    'metadata.bookingId': String(bookingId),
    'metadata.hoursUntil': hoursUntil
  }).select('_id').lean();
  return !!log;
};

const runRemindersOnce = async () => {
  const now = new Date();
  try {
    const windowStart = new Date(now.getTime() + 30 * 60 * 1000);   // 30 min
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25 hours

    const bookings = await Booking.find({
      status: { $in: ['pending', 'confirmed'] },
      sessionDate: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) }
    }).lean();

    for (const booking of bookings) {
      const startAt = bookingStartAt(booking);
      if (!startAt) continue;
      const msUntil = startAt.getTime() - now.getTime();
      if (msUntil < 0) continue;

      const hoursUntil = msUntil / (60 * 60 * 1000);
      let bucket = null;
      if (hoursUntil >= 0.5 && hoursUntil <= 1.5) bucket = 1;
      else if (hoursUntil >= 23 && hoursUntil <= 25) bucket = 24;
      if (!bucket) continue;

      const mentor = await Mentor.findById(booking.mentorId).lean();
      const student = await User.findById(booking.studentId).select('-password').lean();
      if (!student) continue;

      // Remind student
      if (!(await alreadySent(booking._id, bucket, student._id))) {
        await emailService.sendSessionReminder(
          booking, student,
          { name: mentor?.name || booking.mentorName, role: 'mentor' },
          bucket
        );
      }

      // Remind mentor if they have a linked user account
      if (mentor?.userId) {
        const mentorUser = await User.findById(mentor.userId).select('-password').lean();
        if (mentorUser && !(await alreadySent(booking._id, bucket, mentorUser._id))) {
          await emailService.sendSessionReminder(
            booking, mentorUser,
            { name: student.name, role: 'student' },
            bucket
          );
        }
      }
    }
  } catch (err) {
    console.error('[sessionReminder] fatal:', err.message);
  }
};

// Also trigger feedback requests 30 min after a session ended.
const runFeedbackOnce = async () => {
  const now = new Date();
  try {
    const completedWindowStart = new Date(now.getTime() - 90 * 60 * 1000);
    const completedWindowEnd = new Date(now.getTime() - 20 * 60 * 1000);

    const bookings = await Booking.find({
      status: { $in: ['confirmed', 'completed'] },
      sessionDate: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) }
    }).lean();

    for (const booking of bookings) {
      const start = bookingStartAt(booking);
      if (!start) continue;
      const duration = (booking.durationMinutes || 30) * 60 * 1000;
      const end = new Date(start.getTime() + duration);

      if (end >= completedWindowStart && end <= completedWindowEnd) {
        const existing = await EmailLog.findOne({
          emailType: 'session_feedback',
          'metadata.bookingId': String(booking._id)
        }).select('_id').lean();
        if (existing) continue;

        const mentor = await Mentor.findById(booking.mentorId).lean();
        const student = await User.findById(booking.studentId).select('-password').lean();
        if (student) {
          await emailService.sendSessionFeedbackRequest(booking, student, {
            name: mentor?.name || booking.mentorName
          });
        }
      }
    }
  } catch (err) {
    console.error('[sessionFeedback] fatal:', err.message);
  }
};

const scheduleSessionReminders = () => {
  cron.schedule(CRON_EXPR, async () => {
    await runRemindersOnce();
    await runFeedbackOnce();
  });
  console.log('[sessionReminder] Scheduled every 30 minutes');
};

module.exports = {
  scheduleSessionReminders,
  runRemindersOnce,
  runFeedbackOnce
};
