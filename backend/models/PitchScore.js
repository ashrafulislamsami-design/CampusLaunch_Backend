const mongoose = require('mongoose');

const pitchScoreSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'PitchEvent', required: true },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  judge: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  problemClarity: { type: Number, min: 0, max: 25, default: 0 },
  solutionViability: { type: Number, min: 0, max: 25, default: 0 },
  teamStrength: { type: Number, min: 0, max: 25, default: 0 },
  marketPotential: { type: Number, min: 0, max: 25, default: 0 },
  totalScore: { type: Number, default: 0 },
  feedback: { type: String, default: '' },
  submittedAt: { type: Date },
  isSubmitted: { type: Boolean, default: false }
});

pitchScoreSchema.index({ event: 1, team: 1, judge: 1 }, { unique: true });

pitchScoreSchema.pre('save', function (next) {
  if (this.isSubmitted) {
    this.totalScore = this.problemClarity + this.solutionViability + this.teamStrength + this.marketPotential;
  }
  next();
});

module.exports = mongoose.model('PitchScore', pitchScoreSchema);
