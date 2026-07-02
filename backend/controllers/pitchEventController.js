const PitchEvent = require('../models/PitchEvent');
const PitchRegistration = require('../models/PitchRegistration');
const Team = require('../models/Team');
const User = require('../models/User');
const { sendNotification } = require('../utils/notificationHelper');
const emailService = require('../services/emailService');

const notifyRegistrationOpened = async (eventDoc) => {
  if (eventDoc.status !== 'registration_open') return;

  const students = await User.find({ role: 'Student' }).select('_id');
  await Promise.all(
    students.map((student) =>
      sendNotification(
        student._id,
        'New pitch event registration is open',
        `${eventDoc.title} is now open for team registration.`,
        'EVENT',
        { dedupeKey: `PITCH_OPEN:${eventDoc._id}:${student._id}` }
      )
    )
  );
};

exports.listEvents = async (req, res) => {
  try {
    const { status, upcoming, past } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (upcoming === 'true') filter.eventDate = { $gte: new Date() };
    if (past === 'true') filter.eventDate = { $lt: new Date() };

    const events = await PitchEvent.find(filter)
      .populate('organizer', 'name email')
      .populate('judges', 'name email')
      .sort({ eventDate: -1 });

    const eventsWithCount = await Promise.all(
      events.map(async (evt) => {
        const regCount = await PitchRegistration.countDocuments({ event: evt._id, status: 'approved' });
        return { ...evt.toObject(), registeredTeamsCount: regCount };
      })
    );

    res.json(eventsWithCount);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error fetching events' });
  }
};

exports.getEvent = async (req, res) => {
  try {
    const event = await PitchEvent.findById(req.params.eventId)
      .populate('organizer', 'name email')
      .populate('judges', 'name email');
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const regCount = await PitchRegistration.countDocuments({ event: event._id, status: 'approved' });
    res.json({ ...event.toObject(), registeredTeamsCount: regCount });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error fetching event' });
  }
};

exports.createEvent = async (req, res) => {
  try {
    if (req.user.role !== 'Organizer') {
      return res.status(403).json({ message: 'Only organizers can create events' });
    }
    const event = new PitchEvent({ ...req.body, organizer: req.user.id });
    await event.save();
    await notifyRegistrationOpened(event);
    res.status(201).json(event);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error creating event' });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const event = await PitchEvent.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.organizer.toString() !== req.user.id && req.user.role !== 'Organizer') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    Object.assign(event, req.body);
    await event.save();
    await notifyRegistrationOpened(event);
    res.json(event);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error updating event' });
  }
};

exports.registerTeam = async (req, res) => {
  try {
    const event = await PitchEvent.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (event.status !== 'registration_open') {
      return res.status(400).json({ message: 'Registration is not open' });
    }

    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      return res.status(400).json({ message: 'Registration deadline has passed' });
    }

    const existing = await PitchRegistration.findOne({ event: event._id, team: req.body.teamId });
    if (existing) return res.status(409).json({ message: 'Team already registered' });

    const regCount = await PitchRegistration.countDocuments({ event: event._id });
    if (regCount >= event.maxTeams) {
      return res.status(400).json({ message: 'Maximum teams reached' });
    }

    const reg = new PitchRegistration({
      event: event._id,
      team: req.body.teamId,
      registeredBy: req.user.id,
      pitchDeckUrl: req.body.pitchDeckUrl || '',
      pitchDeckOriginalName: req.body.pitchDeckOriginalName || '',
      presentationOrder: regCount + 1,
    });
    await reg.save();
    res.status(201).json(reg);

    // Fire-and-forget: confirmation email to registering user + team members
    try {
      (async () => {
        try {
          const [team, registrant] = await Promise.all([
            Team.findById(req.body.teamId).lean(),
            User.findById(req.user.id).select('-password').lean()
          ]);
          if (registrant) {
            await emailService.sendPitchRegistrationConfirmation(event, team, registrant, reg);
          }
        } catch (e) {
          console.error('Pitch reg email failed:', e.message);
        }
      })();
    } catch (e) { console.error('Pitch reg email dispatch failed:', e.message); }
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Team already registered' });
    console.error(err.message);
    res.status(500).json({ message: 'Server error registering team' });
  }
};

exports.getRegistrations = async (req, res) => {
  try {
    const regs = await PitchRegistration.find({ event: req.params.eventId })
      .populate('team', 'name problemStatement logoUrl')
      .populate('registeredBy', 'name email')
      .sort({ presentationOrder: 1 });
    res.json(regs);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error fetching registrations' });
  }
};

exports.getMyEvents = async (req, res) => {
  try {
    const teams = await Team.find({ 'members.userId': req.user.id });
    const teamIds = teams.map((t) => t._id);

    const regs = await PitchRegistration.find({ team: { $in: teamIds } })
      .populate({
        path: 'event',
        populate: { path: 'organizer', select: 'name' },
      })
      .populate('team', 'name');

    res.json(regs);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error fetching my events' });
  }
};
