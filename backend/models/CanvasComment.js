const mongoose = require('mongoose');

const canvasCommentSchema = new mongoose.Schema({
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
  sectionKey: {
    type: String,
    required: true,
    enum: [
      'keyPartnerships',
      'keyActivities',
      'keyResources',
      'valuePropositions',
      'customerRelationships',
      'channels',
      'customerSegments',
      'costStructure',
      'revenueStreams'
    ]
  },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true },
  isEdited: { type: Boolean, default: false }
}, { timestamps: true });

canvasCommentSchema.index({ team: 1, sectionKey: 1, createdAt: -1 });

module.exports = mongoose.model('CanvasComment', canvasCommentSchema);
