const mongoose = require('mongoose');

const canvasVersionSchema = new mongoose.Schema({
  canvas: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CanvasBoard',
    required: true,
    index: true
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
    index: true
  },
  versionNumber: { type: Number, default: 1 },
  label: { type: String, default: '' },
  // Snapshot of the 9 sections at save time, stored as a flexible object.
  sectionsSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  savedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  savedAt: { type: Date, default: Date.now },
  isAutoSave: { type: Boolean, default: false }
});

canvasVersionSchema.index({ team: 1, savedAt: -1 });

module.exports = mongoose.model('CanvasVersion', canvasVersionSchema);
