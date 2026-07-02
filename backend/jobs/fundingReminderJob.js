const cron = require('node-cron');
const Funding = require('../models/Funding');
const User = require('../models/User');
const EmailLog = require('../models/EmailLog');
const emailService = require('../services/emailService');

// Every day at 08:00 UTC (14:00 BD time).
const CRON_EXPR = '0 8 * * *';

const daysBetween = (a, b) => {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
};

const alreadySent = async (userId, fundingId, daysUntil) => {
  const log = await EmailLog.findOne({
    recipient: userId,
    emailType: 'funding_reminder',
    'metadata.fundingId': String(fundingId),
    'metadata.daysUntil': daysUntil
  }).select('_id').lean();
  return !!log;
};

const runFundingRemindersOnce = async () => {
  const now = new Date();
  try {
    const horizon = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    const fundings = await Funding.find({
      deadline: { $gte: now, $lte: horizon }
    }).lean();

    for (const f of fundings) {
      const d = daysBetween(now, new Date(f.deadline));
      if (d !== 7 && d !== 3 && d !== 1) continue;

      // Find all users who have this funding in their watchlist.
      const users = await User.find({ watchlist: f._id })
        .select('_id name email')
        .lean();

      for (const user of users) {
        if (await alreadySent(user._id, f._id, d)) continue;
        try {
          await emailService.sendFundingDeadlineReminder(f, user, d);
        } catch (err) {
          console.error(`[fundingReminder] user ${user.email}:`, err.message);
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  } catch (err) {
    console.error('[fundingReminder] fatal:', err.message);
  }
};

const scheduleFundingReminders = () => {
  cron.schedule(CRON_EXPR, runFundingRemindersOnce, { timezone: 'UTC' });
  console.log('[fundingReminder] Scheduled daily at 08:00 UTC');
};

module.exports = { scheduleFundingReminders, runFundingRemindersOnce };
