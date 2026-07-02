const Booking = require('../models/Booking');
const Mentor = require('../models/Mentor');
const User = require('../models/User');
const { google } = require('googleapis');
const { sendNotification } = require('../utils/notificationHelper');
const emailService = require('../services/emailService');

// Helper: create OAuth2 client
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI
  );
}

// Helper: create a Google Calendar event with a Meet link
async function createGoogleCalendarEvent(booking, mentor) {
  try {
    if (!mentor.googleRefreshToken) return null;

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: mentor.googleRefreshToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Build datetime strings
    const dateStr = booking.sessionDate.toISOString().split('T')[0];
    const startISO = `${dateStr}T${booking.startTime}:00`;
    const endISO = `${dateStr}T${booking.endTime}:00`;

    const event = {
      summary: `Mentor Session: ${booking.studentName} ↔ ${booking.mentorName}`,
      description: booking.agenda || 'No agenda provided.',
      start: { dateTime: startISO, timeZone: 'UTC' },
      end: { dateTime: endISO, timeZone: 'UTC' },
      attendees: [
        { email: booking.studentEmail },
        { email: booking.mentorEmail }
      ],
      // Generate Google Meet link automatically
      conferenceData: {
        createRequest: {
          requestId: booking._id.toString(),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };

    const response = await calendar.events.insert({
      calendarId: mentor.googleCalendarId || 'primary',
      resource: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all' // sends email invites to attendees
    });

    return {
      eventId: response.data.id,
      meetLink: response.data.hangoutLink || response.data.conferenceData?.entryPoints?.[0]?.uri || ''
    };
  } catch (err) {
    console.error('Google Calendar error:', err.message);
    return null;
  }
}

// @route   POST /api/bookings
// @desc    Book a mentor session
exports.createBooking = async (req, res) => {
  try {
    const { mentorId, sessionDate, startTime, durationMinutes, agenda } = req.body;

    if (!mentorId || !sessionDate || !startTime) {
      return res.status(400).json({ message: 'mentorId, sessionDate, and startTime are required' });
    }

    const mentor = await Mentor.findById(mentorId);
    if (!mentor) return res.status(404).json({ message: 'Mentor not found' });

    const student = await User.findById(req.user.id).select('-password');

    // Calculate end time
    const duration = durationMinutes === 60 ? 60 : 30;
    const [h, m] = startTime.split(':').map(Number);
    const endDate = new Date(2000, 0, 1, h, m + duration);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    // Check for double booking (unique index will also catch this)
    const conflict = await Booking.findOne({
      mentorId,
      sessionDate: new Date(sessionDate),
      startTime,
      status: { $in: ['pending', 'confirmed'] }
    });
    if (conflict) {
      return res.status(409).json({ message: 'This time slot is already booked. Please choose another.' });
    }

    const booking = new Booking({
      studentId: student._id,
      studentName: student.name,
      studentEmail: student.email,
      mentorId: mentor._id,
      mentorName: mentor.name,
      mentorEmail: mentor.email,
      sessionDate: new Date(sessionDate),
      startTime,
      endTime,
      durationMinutes: duration,
      agenda: agenda || '',
      status: 'pending'
    });

    await booking.save();

    // Try to create Google Calendar event
    const calResult = await createGoogleCalendarEvent(booking, mentor);
    if (calResult) {
      booking.googleEventId = calResult.eventId;
      booking.meetingLink = calResult.meetLink;
      booking.status = 'confirmed';
      await booking.save();
    }

    res.status(201).json(booking);

    // --- Trigger Notifications ---
    // 1. Alert Student
    sendNotification(
      student._id,
      'Mentor session booked!',
      `Confirmed with ${mentor.name} on ${sessionDate} at ${startTime}.`,
      'MENTOR',
      { dedupeKey: `BOOKING_STUDENT:${booking._id}` }
    );

    // 2. Alert Mentor (if they have a linked user account)
    if (mentor.userId) {
      sendNotification(
        mentor.userId,
        'New session request',
        `${student.name} booked a session: ${sessionDate} @ ${startTime}.`,
        'MENTOR',
        { dedupeKey: `BOOKING_MENTOR:${booking._id}` }
      );
    }

    // Fire-and-forget booking confirmation emails (to student + mentor)
    try {
      emailService.sendMentorBookingConfirmation(booking, student, mentor)
        .catch((e) => console.error('Booking email failed:', e.message));
    } catch (e) { console.error('Booking email dispatch failed:', e.message); }
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'This time slot is already booked.' });
    }
    console.error(err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @route   GET /api/bookings/my
// @desc    Get all bookings for logged-in student
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ studentId: req.user.id })
      .sort({ sessionDate: 1 })
      .populate('mentorId', 'name expertise bio');
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @route   GET /api/bookings/mentor
// @desc    Get all bookings for logged-in mentor
exports.getMentorBookings = async (req, res) => {
  try {
    const mentor = await Mentor.findOne({ userId: req.user.id });
    if (!mentor) return res.status(404).json({ message: 'Mentor profile not found' });

    const bookings = await Booking.find({ mentorId: mentor._id })
      .sort({ sessionDate: 1 })
      .populate('studentId', 'name email');
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @route   GET /api/bookings/availability/:mentorId
// @desc    Get booked slots for a mentor on a given date
exports.getMentorAvailability = async (req, res) => {
  try {
    const { date } = req.query; // "2026-05-01"
    if (!date) return res.status(400).json({ message: 'date query param required' });

    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const bookings = await Booking.find({
      mentorId: req.params.mentorId,
      sessionDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'confirmed'] }
    }).select('startTime endTime');

    res.json({ bookedSlots: bookings.map(b => ({ startTime: b.startTime, endTime: b.endTime })) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @route   PUT /api/bookings/:bookingId/cancel
// @desc    Cancel a booking
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Only student or mentor can cancel
    const mentor = await Mentor.findById(booking.mentorId);
    const isStudent = booking.studentId.toString() === req.user.id;
    const isMentor = mentor && mentor.userId.toString() === req.user.id;

    if (!isStudent && !isMentor) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    booking.status = 'cancelled';
    await booking.save();
    res.json({ message: 'Booking cancelled', booking });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @route   POST /api/bookings/:bookingId/rate
// @desc    Submit post-session rating
exports.submitRating = async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Can only rate completed sessions' });
    }

    const isStudent = booking.studentId.toString() === req.user.id;
    if (!isStudent) {
      return res.status(403).json({ message: 'Not authorized to rate this booking. Only the student who booked the session can submit ratings.' });
    }

    booking.studentRating = rating;
    booking.studentFeedback = feedback || '';
    await booking.save();

    // Update mentor's aggregate rating
    const mentor = await Mentor.findById(booking.mentorId);
    if (mentor) {
      mentor.ratingSum += rating;
      mentor.totalRatings += 1;
      await mentor.save();
    }

    res.json({ message: 'Rating submitted successfully', booking });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};