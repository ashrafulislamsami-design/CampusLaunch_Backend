const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema({
  version:    { type: Number, required: true },   // 1, 2, 3 …
  filePath:   { type: String, required: true },   // uploads/pitchdecks/filename.pdf
  fileName:   { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  avgScore:   { type: Number, default: null }     // filled after reviews aggregate
});

const pitchDeckSchema = new mongoose.Schema({
  teamId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  uploaderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploaderName:{ type: String },
  title:       { type: String, required: true },
  description: { type: String, default: '' },

  // All versions; latest is versions[versions.length - 1]
  versions:    { type: [versionSchema], default: [] },

  // Current active version number
  currentVersion: { type: Number, default: 1 },

  // Cached aggregate for quick listing
  latestAvgScore: { type: Number, default: null },
  totalReviews:   { type: Number, default: 0 }

}, { timestamps: true });

module.exports = mongoose.model('PitchDeck', pitchDeckSchema);