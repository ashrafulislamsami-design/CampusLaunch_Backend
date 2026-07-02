const Event = require('../models/Event');
const EventRegistration = require('../models/EventRegistration');
const EventFeedback = require('../models/EventFeedback');
const User = require('../models/User');
const cache = require('../utils/cache');

// ─── LIST & SEARCH ────────────────────────────────────────────────────────────

// GET /api/hub/events
exports.listEvents = async (req, res) => {
  try {
    const { search, type, format, status, hostingOrg, from, to, page = 1, limit = 12 } = req.query;
    
    // Construct cache key based on query parameters
    const cacheKey = `events:list:${search || ''}:${type || ''}:${format || ''}:${status || ''}:${hostingOrg || ''}:${from || ''}:${to || ''}:${page}:${limit}`;
    
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const query = {};

    if (search) {
      query.$or = [
        { title:       { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags:        { $regex: search, $options: 'i' } }
      ];
    }
    if (type       && type !== 'All')       query.eventType  = type;
    if (format     && format !== 'All')     query.format     = format;
    if (status     && status !== 'All')     query.status     = status;
    if (hostingOrg && hostingOrg !== 'All') query.hostingOrg = { $regex: hostingOrg, $options: 'i' };
    if (from)       query.date = { ...(query.date || {}), $gte: new Date(from) };
    if (to)         query.date = { ...(query.date || {}), $lte: new Date(to) };

    const skip = (Number(page) - 1) * Number(limit);
    const [events, total] = await Promise.all([
      Event.find(query).sort({ date: 1 }).skip(skip).limit(Number(limit)),
      Event.countDocuments(query)
    ]);

    const result = { events, total, page: Number(page) };
    
    // Cache result for 5 minutes (300 seconds)
    await cache.set(cacheKey, result, 300);

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /api/hub/events/archive
exports.archivedEvents = async (req, res) => {
  try {
    const events = await Event.find({ status: 'completed' }).sort({ date: -1 }).limit(50);
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/hub/events/:id
exports.getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Attach registration count
    const registrationCount = await EventRegistration.countDocuments({
      eventId: req.params.id,
      status: { $in: ['registered', 'checked-in'] }
    });
    res.json({ ...event.toObject(), registrationCount });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── ORGANIZER CRUD ───────────────────────────────────────────────────────────

// POST /api/hub/events
exports.createEvent = async (req, res) => {
  try {
    const {
      title, description, eventType, organizerName, hostingOrg,
      format, venue, meetLink, date, endDate, registrationDeadline,
      allowedParticipants, capacityLimit, tags, status
    } = req.body;

    const bannerImage = req.file ? `/uploads/pitchdecks/${req.file.filename}` : '';

    const event = new Event({
      title, description, eventType,
      organizerName: organizerName || req.user.name || 'Organizer',
      organizerId: req.user.id,
      hostingOrg: hostingOrg || '',
      format: format || 'in-person',
      venue: venue || '',
      meetLink: meetLink || '',
      date: new Date(date),
      endDate: endDate ? new Date(endDate) : null,
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      allowedParticipants: allowedParticipants || 'anyone',
      capacityLimit: capacityLimit ? Number(capacityLimit) : 0,
      bannerImage,
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
      status: status || 'upcoming'
    });

    await event.save();
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PUT /api/hub/events/:id
exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.organizerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized — you are not the organizer' });
    }

    const updates = { ...req.body };
    if (updates.date) updates.date = new Date(updates.date);
    if (updates.endDate) updates.endDate = new Date(updates.endDate);
    if (updates.registrationDeadline) updates.registrationDeadline = new Date(updates.registrationDeadline);
    if (updates.tags && !Array.isArray(updates.tags)) updates.tags = updates.tags.split(',').map(t => t.trim());
    if (req.file) updates.bannerImage = `/uploads/pitchdecks/${req.file.filename}`;

    const updated = await Event.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE /api/hub/events/:id
exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.organizerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await Event.findByIdAndDelete(req.params.id);
    await EventRegistration.deleteMany({ eventId: req.params.id });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── RSVP / REGISTRATION ──────────────────────────────────────────────────────

// POST /api/hub/events/:id/rsvp
exports.rsvp = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const user = await User.findById(req.user.id).select('-password');

    // Count current registered (not cancelled)
    const currentCount = await EventRegistration.countDocuments({
      eventId: req.params.id,
      status: { $in: ['registered', 'checked-in'] }
    });

    // Check existing registration
    const existing = await EventRegistration.findOne({ eventId: req.params.id, userId: req.user.id });
    if (existing && existing.status !== 'cancelled') {
      return res.status(400).json({ message: 'Already registered for this event' });
    }

    // Determine status: waitlist if full
    const isFull = event.capacityLimit > 0 && currentCount >= event.capacityLimit;
    const status = isFull ? 'waitlisted' : 'registered';

    if (existing) {
      // Re-register (was cancelled)
      existing.status = status;
      await existing.save();
      return res.json({ message: status === 'waitlisted' ? 'Added to waitlist' : 'Registered!', status });
    }

    const reg = new EventRegistration({
      eventId: req.params.id,
      userId: req.user.id,
      userName: user.name,
      userEmail: user.email,
      status
    });
    await reg.save();

    res.status(201).json({ message: status === 'waitlisted' ? 'Added to waitlist' : 'Registered!', status });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Already registered' });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE /api/hub/events/:id/rsvp
exports.cancelRsvp = async (req, res) => {
  try {
    const reg = await EventRegistration.findOneAndUpdate(
      { eventId: req.params.id, userId: req.user.id },
      { status: 'cancelled' },
      { new: true }
    );
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    // Promote first waitlisted person if a slot freed up
    const event = await Event.findById(req.params.id);
    if (event && event.capacityLimit > 0) {
      const waitlisted = await EventRegistration.findOne({
        eventId: req.params.id, status: 'waitlisted'
      }).sort({ createdAt: 1 });
      if (waitlisted) {
        waitlisted.status = 'registered';
        await waitlisted.save();
      }
    }

    res.json({ message: 'Registration cancelled' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/hub/events/my-registrations
exports.myRegistrations = async (req, res) => {
  try {
    const regs = await EventRegistration.find({ userId: req.user.id, status: { $ne: 'cancelled' } })
      .populate('eventId')
      .sort({ createdAt: -1 });
    res.json(regs);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── ORGANIZER MANAGEMENT ─────────────────────────────────────────────────────

// GET /api/hub/events/:id/registrations  (organizer only)
exports.getRegistrations = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.organizerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const regs = await EventRegistration.find({ eventId: req.params.id }).sort({ createdAt: 1 });
    res.json(regs);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/hub/events/:id/checkin/:userId  (organizer only)
exports.checkIn = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.organizerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const reg = await EventRegistration.findOneAndUpdate(
      { eventId: req.params.id, userId: req.params.userId },
      { status: 'checked-in', checkedInAt: new Date() },
      { new: true }
    );
    if (!reg) return res.status(404).json({ message: 'Registration not found' });
    res.json({ message: 'Checked in!', reg });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/hub/events/:id/archive  (organizer: save results)
exports.archiveEvent = async (req, res) => {
  try {
    const { winners, runnerUp, summary } = req.body;
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Not found' });
    if (event.organizerId.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    event.status = 'completed';
    event.winners  = winners  || '';
    event.runnerUp = runnerUp || '';
    event.summary  = summary  || '';
    await event.save();
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/hub/events/:id/feedback
exports.submitFeedback = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating 1-5 required' });
    const fb = await EventFeedback.findOneAndUpdate(
      { eventId: req.params.id, userId: req.user.id },
      { rating, comment: comment || '' },
      { upsert: true, new: true }
    );
    res.json(fb);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/hub/events/my-events  (organizer: events I created)
exports.myEvents = async (req, res) => {
  try {
    const events = await Event.find({ organizerId: req.user.id }).sort({ date: -1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};