const mongoose = require('mongoose');

const eventRegistrationSchema = new mongoose.Schema({
  eventId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  userName:  { type: String },
  userEmail: { type: String },
  status: {
    type: String,
    enum: ['registered', 'waitlisted', 'cancelled', 'checked-in'],
    default: 'registered'
  },
  checkedInAt: { type: Date, default: null }
}, { timestamps: true });

// Prevent duplicate registrations
eventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('EventRegistration', eventRegistrationSchema);