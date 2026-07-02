const mongoose = require('mongoose');

const eventFeedbackSchema = new mongoose.Schema({
  eventId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  rating:    { type: Number, min: 1, max: 5, required: true },
  comment:   { type: String, default: '' }
}, { timestamps: true });

eventFeedbackSchema.index({ eventId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('EventFeedback', eventFeedbackSchema);