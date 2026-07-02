const mongoose = require('mongoose');

const canvasSchema = new mongoose.Schema({
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
    unique: true
  },
  keyPartners: { type: String, default: '' },
  keyActivities: { type: String, default: '' },
  keyResources: { type: String, default: '' },
  valuePropositions: { type: String, default: '' },
  customerRelationships: { type: String, default: '' },
  channels: { type: String, default: '' },
  customerSegments: { type: String, default: '' },
  costStructure: { type: String, default: '' },
  revenueStreams: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Canvas', canvasSchema);
