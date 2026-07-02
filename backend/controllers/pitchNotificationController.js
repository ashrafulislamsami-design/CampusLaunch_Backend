const PitchEvent = require('../models/PitchEvent');
const User = require('../models/User');
const { sendNotification } = require('../utils/notificationHelper');

// Notify students for pitch registration deadlines approaching (3 days and 1 day).
exports.sendPitchDeadlineAlerts = async () => {
  const events = await PitchEvent.find({
    status: 'registration_open',
    registrationDeadline: { $exists: true, $ne: null },
  });

  if (events.length === 0) return;

  const students = await User.find({ role: 'Student' }).select('_id');
  if (students.length === 0) return;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (const event of events) {
    const deadline = new Date(event.registrationDeadline);
    deadline.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    if (diffDays !== 3 && diffDays !== 1) continue;

    const timeLabel = diffDays === 1 ? 'in 1 day' : 'in 3 days';
    await Promise.all(
      students.map((student) =>
        sendNotification(
          student._id,
          'Pitch event deadline is near',
          `${event.title} registration closes ${timeLabel}.`,
          'EVENT',
          { dedupeKey: `PITCH_DEADLINE:${event._id}:${student._id}:${diffDays}` }
        )
      )
    );
  }
};
