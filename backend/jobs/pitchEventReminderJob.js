const cron = require('node-cron');
const PitchEvent = require('../models/PitchEvent');
const PitchRegistration = require('../models/PitchRegistration');
const Team = require('../models/Team');
const User = require('../models/User');
const EmailLog = require('../models/EmailLog');
const emailService = require('../services/emailService');

// Daily at 09:00 UTC — send pitch event reminders 2 days before the event.
const CRON_EXPR = '0 9 * * *';

const daysBetween = (a, b) => Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));

const alreadySent = async (userId, eventId, daysUntil) => {
  const log = await EmailLog.findOne({
    recipient: userId,
    emailType: 'pitch_reminder',
    'metadata.eventId': String(eventId),
    'metadata.daysUntil': daysUntil
  }).select('_id').lean();
  return !!log;
};

const runPitchRemindersOnce = async () => {
  const now = new Date();
  try {
    const horizon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const events = await PitchEvent.find({
      eventDate: { $gte: now, $lte: horizon },
      status: { $in: ['registration_open', 'registration_closed', 'live', 'judging'] }
    }).lean();

    for (const event of events) {
      const daysUntil = daysBetween(now, new Date(event.eventDate));
      if (daysUntil !== 2) continue;

      const registrations = await PitchRegistration.find({ event: event._id })
        .populate('team')
        .lean();

      for (const reg of registrations) {
        const team = reg.team;
        if (!team?.members) continue;

        for (const member of team.members) {
          const user = await User.findById(member.userId).select('-password').lean();
          if (!user) continue;
          if (await alreadySent(user._id, event._id, daysUntil)) continue;
          await emailService.sendPitchEventReminder(event, team, user, daysUntil);
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    }
  } catch (err) {
    console.error('[pitchEventReminder] fatal:', err.message);
  }
};

const schedulePitchEventReminders = () => {
  cron.schedule(CRON_EXPR, runPitchRemindersOnce, { timezone: 'UTC' });
  console.log('[pitchEventReminder] Scheduled daily at 09:00 UTC');
};

module.exports = { schedulePitchEventReminders, runPitchRemindersOnce };
