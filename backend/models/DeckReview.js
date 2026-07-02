const mongoose = require('mongoose');

const criteriaScoreSchema = new mongoose.Schema({
  problemClarity:    { score: { type: Number, min: 1, max: 5 }, comment: String },
  solutionQuality:   { score: { type: Number, min: 1, max: 5 }, comment: String },
  marketOpportunity: { score: { type: Number, min: 1, max: 5 }, comment: String },
  businessModel:     { score: { type: Number, min: 1, max: 5 }, comment: String },
  teamStrength:      { score: { type: Number, min: 1, max: 5 }, comment: String },
  slideDesign:       { score: { type: Number, min: 1, max: 5 }, comment: String }
}, { _id: false });

const deckReviewSchema = new mongoose.Schema({
  deckId:      { type: mongoose.Schema.Types.ObjectId, ref: 'PitchDeck', required: true },
  version:     { type: Number, required: true }, // which deck version was reviewed

  reviewerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewerName: { type: String },
  reviewerRole: { type: String, enum: ['Student', 'Mentor', 'Organizer'], default: 'Student' },

  criteria:     { type: criteriaScoreSchema, required: true },
  overallComment: { type: String, default: '' },

  recommendation: {
    type: String,
    enum: ['needs-work', 'good-potential', 'competition-ready'],
    default: 'needs-work'
  },

  // Computed average of all 6 criteria
  avgScore: { type: Number, default: null }

}, { timestamps: true });

// One review per reviewer per deck per version
deckReviewSchema.index({ deckId: 1, version: 1, reviewerId: 1 }, { unique: true });

module.exports = mongoose.model('DeckReview', deckReviewSchema);