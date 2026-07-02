const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  // Core info
  title:       { type: String, required: true },
  description: { type: String, required: true },
  eventType: {
    type: String,
    enum: ['pitch-competition', 'hackathon', 'workshop', 'networking', 'webinar', 'other'],
    required: true,
    default: 'other'
  },

  // Organizer
  organizerName:    { type: String, required: true },
  organizerId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hostingOrg:       { type: String, default: '' }, // university or company name

  // Format
  format:    { type: String, enum: ['online', 'in-person', 'hybrid'], default: 'in-person' },
  venue:     { type: String, default: '' },     // physical address
  meetLink:  { type: String, default: '' },     // online meeting URL

  // Timing
  date:                 { type: Date, required: true },
  endDate:              { type: Date, default: null },
  registrationDeadline: { type: Date, default: null },

  // Participation
  allowedParticipants: {
    type: String,
    enum: ['students', 'teams', 'anyone'],
    default: 'students'
  },
  capacityLimit: { type: Number, default: 0 }, // 0 = unlimited

  // Media
  bannerImage: { type: String, default: '' },
  tags: { type: [String], default: [] },

  // Status
  status: {
    type: String,
    enum: ['upcoming', 'live', 'completed', 'cancelled'],
    default: 'upcoming'
  },

  // Legacy attendees (kept for backward compat)
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Archive / results
  winners:    { type: String, default: '' },
  runnerUp:   { type: String, default: '' },
  summary:    { type: String, default: '' },
  galleryUrls: { type: [String], default: [] }

}, { timestamps: true });

module.exports = mongoose.model('Event', EventSchema);