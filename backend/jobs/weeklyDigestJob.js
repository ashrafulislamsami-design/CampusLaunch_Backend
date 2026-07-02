const cron = require('node-cron');
const User = require('../models/User');
const PitchEvent = require('../models/PitchEvent');
const Funding = require('../models/Funding');
const CurriculumProgress = require('../models/CurriculumProgress');
const emailService = require('../services/emailService');

// Run every Monday at 03:00 UTC = 09:00 Bangladesh time (UTC+6).
const CRON_EXPR = '0 3 * * 1';

const buildDigestForUser = async (user) => {
  const now = new Date();
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [events, funding, progressDocs] = await Promise.all([
    PitchEvent.find({
      eventDate: { $gte: now, $lte: weekFromNow },
      status: { $in: ['registration_open', 'live', 'judging'] }
    }).sort({ eventDate: 1 }).limit(3).lean(),
    Funding.find({ deadline: { $gte: now, $lte: weekFromNow } })
      .sort({ deadline: 1 })
      .limit(3)
      .lean(),
    CurriculumProgress.find({ studentId: user._id, isCompleted: true })
      .select('weekNumber')
      .lean()
  ]);

  const completedWeeks = progressDocs.map((p) => p.weekNumber);
  const nextWeek = Array.from({ length: 12 }, (_, i) => i + 1)
    .find((w) => !completedWeeks.includes(w)) || null;

  return {
    matches: [], // placeholder — wire up to AI match service if available
    events,
    funding,
    curriculumWeek: nextWeek
  };
};

const runDigestOnce = async () => {
  console.log('[weeklyDigest] Starting run…');
  let sent = 0;
  let failed = 0;
  try {
    const users = await User.find({ role: 'Student' })
      .select('_id name email')
      .lean();

    for (const user of users) {
      try {
        const digest = await buildDigestForUser(user);
        await emailService.sendWeeklyDigest(user, digest);
        sent += 1;
      } catch (err) {
        failed += 1;
        console.error(`[weeklyDigest] failed for ${user.email}:`, err.message);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  } catch (err) {
    console.error('[weeklyDigest] fatal:', err.message);
  }
  console.log(`[weeklyDigest] Done. sent=${sent} failed=${failed}`);
};

const scheduleWeeklyDigest = () => {
  cron.schedule(CRON_EXPR, runDigestOnce, { timezone: 'UTC' });
  console.log('[weeklyDigest] Scheduled Monday 09:00 Bangladesh time');
};

module.exports = { scheduleWeeklyDigest, runDigestOnce };
