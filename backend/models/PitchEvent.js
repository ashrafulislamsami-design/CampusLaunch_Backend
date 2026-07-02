const mongoose = require('mongoose');

const pitchEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    eventDate: { type: Date, required: true },
    registrationDeadline: { type: Date },
    maxTeams: { type: Number, default: 10 },
    presentationDuration: { type: Number, default: 5 },
    status: {
      type: String,
      enum: ['draft', 'registration_open', 'registration_closed', 'live', 'judging', 'ended', 'results_published'],
      default: 'draft',
    },
    currentPresenterIndex: { type: Number, default: -1 },
    allowAudienceVoting: { type: Boolean, default: true },
    showLiveLeaderboard: { type: Boolean, default: false },
    judges: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

pitchEventSchema.index({ status: 1, eventDate: -1 });
pitchEventSchema.index({ registrationDeadline: 1 });

module.exports = mongoose.model('PitchEvent', pitchEventSchema);
