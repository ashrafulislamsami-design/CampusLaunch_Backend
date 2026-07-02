const mongoose = require('mongoose');

const availabilitySlotSchema = new mongoose.Schema({
  dayOfWeek: { type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
  startTime: String, // "09:00"
  endTime: String    // "17:00"
});

const mentorSchema = new mongoose.Schema({
  // Link to user
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  name: { type: String, required: true },
  email: { type: String, required: true },
  jobDetails: { type: String, default: '' },
  linkedinUrl: { type: String, default: '' },
  profilePhoto: { type: String, default: '' },

  // Areas of expertise
  expertise: {
    type: [String],
    enum: ['tech', 'marketing', 'finance', 'law', 'product', 'design', 'operations', 'fundraising'],
    default: []
  },

  // Bio / intro
  bio: { type: String, default: '' },

  // Availability slots (recurring weekly schedule)
  availabilitySlots: {
    type: [availabilitySlotSchema],
    default: []
  },

  // Google Calendar integration
  googleCalendarId: { type: String, default: '' },
  googleRefreshToken: { type: String, default: '' },

  // Ratings
  totalRatings: { type: Number, default: 0 },
  ratingSum: { type: Number, default: 0 },

  // Session pricing
  sessionType: { type: String, enum: ['free', 'paid'], default: 'free' },
  sessionPriceUSD: { type: Number, default: 0 },

  isActive: { type: Boolean, default: true },

  // Admin verification
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  verificationNote: { type: String, default: '' },
  verifiedAt: { type: Date, default: null },

}, { timestamps: true });

// Virtual: average rating
mentorSchema.virtual('averageRating').get(function () {
  if (this.totalRatings === 0) return 0;
  return Math.round((this.ratingSum / this.totalRatings) * 10) / 10;
});

mentorSchema.set('toJSON', { virtuals: true });
mentorSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Mentor', mentorSchema);