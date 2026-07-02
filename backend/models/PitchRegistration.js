const mongoose = require('mongoose');

const pitchRegistrationSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'PitchEvent', required: true },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  pitchDeckUrl: { type: String, default: '' },
  pitchDeckOriginalName: { type: String, default: '' },
  presentationOrder: { type: Number, default: 0 },
  registeredAt: { type: Date, default: Date.now },
});

pitchRegistrationSchema.index({ event: 1, team: 1 }, { unique: true });

module.exports = mongoose.model('PitchRegistration', pitchRegistrationSchema);
