const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // Who is booking
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentName: String,
  studentEmail: String,

  // Who is being booked
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mentor',
    required: true
  },
  mentorName: String,
  mentorEmail: String,

  // Session details
  sessionDate: { type: Date, required: true },
  startTime: { type: String, required: true },  // "10:00"
  endTime: { type: String, required: true },    // "10:30"
  durationMinutes: { type: Number, enum: [30, 60], default: 30 },

  // Agenda / pre-session notes
  agenda: { type: String, default: '' },

  // Meeting link (Google Meet, Jitsi, etc.)
  meetingLink: { type: String, default: '' },

  // Google Calendar event IDs (for deletion if cancelled)
  googleEventId: { type: String, default: '' },

  // Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },

  // Ratings (post-session)
  studentRating: { type: Number, min: 1, max: 5, default: null },
  studentFeedback: { type: String, default: '' },
  mentorRating: { type: Number, min: 1, max: 5, default: null },
  mentorFeedback: { type: String, default: '' },

  // Payment
  isPaid: { type: Boolean, default: false },
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'waived'], default: 'unpaid' }

}, { timestamps: true });

// Prevent double booking: unique (mentorId + sessionDate + startTime)
bookingSchema.index({ mentorId: 1, sessionDate: 1, startTime: 1 }, { unique: true });

module.exports = mongoose.model('Booking', bookingSchema);