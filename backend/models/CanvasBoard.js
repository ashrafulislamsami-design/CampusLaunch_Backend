const mongoose = require('mongoose');

// Embedded card inside each section.
const cardSchema = new mongoose.Schema({
  content: { type: String, default: '' },
  color: {
    type: String,
    enum: ['yellow', 'blue', 'green', 'pink', 'orange'],
    default: 'yellow'
  },
  order: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastEditedAt: { type: Date, default: Date.now }
});

const sectionSchema = new mongoose.Schema({
  cards: { type: [cardSchema], default: [] },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastEditedAt: { type: Date }
}, { _id: false });

const SECTION_KEYS = [
  'keyPartnerships',
  'keyActivities',
  'keyResources',
  'valuePropositions',
  'customerRelationships',
  'channels',
  'customerSegments',
  'costStructure',
  'revenueStreams'
];

const sectionsShape = SECTION_KEYS.reduce((acc, key) => {
  acc[key] = { type: sectionSchema, default: () => ({ cards: [], lockedBy: null }) };
  return acc;
}, {});

// The board schema is the Business Model Canvas workspace per team.
// Named 'CanvasBoard' to avoid colliding with the existing simple 'Canvas' model.
const canvasBoardSchema = new mongoose.Schema({
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
    unique: true,
    index: true
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sections: sectionsShape,
  shareToken: { type: String, index: true, sparse: true },
  shareEnabled: { type: Boolean, default: false },
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastEditedAt: { type: Date, default: Date.now }
}, { timestamps: true });

canvasBoardSchema.statics.SECTION_KEYS = SECTION_KEYS;

module.exports = mongoose.model('CanvasBoard', canvasBoardSchema);
module.exports.SECTION_KEYS = SECTION_KEYS;
