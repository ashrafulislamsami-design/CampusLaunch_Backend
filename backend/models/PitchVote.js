const mongoose = require('mongoose');

const pitchVoteSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'PitchEvent', required: true },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  voter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  votedAt: { type: Date, default: Date.now }
});

pitchVoteSchema.index({ event: 1, voter: 1 }, { unique: true });

module.exports = mongoose.model('PitchVote', pitchVoteSchema);
