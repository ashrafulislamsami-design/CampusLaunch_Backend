const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['CEO', 'CTO', 'CMO', 'Designer', 'Member'],
    default: 'Member'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted'],
    default: 'accepted'
  }
});

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  status: {
    type: String,
    enum: ['To Do', 'In Progress', 'Done'],
    default: 'To Do'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

const historySchema = new mongoose.Schema({
  oldStage: String,
  newStage: String,
  changeNote: String,
  timestamp: { type: Date, default: Date.now }
});

const documentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  category: { type: String, default: 'Resource' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  senderName: String,
  senderRole: String,
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  problemStatement: {
    type: String,
    required: true
  },
  solution: {
    type: String,
    required: true
  },
  targetCustomer: {
    type: String
  },
  logoUrl: {
    type: String
  },
  stage: {
    type: String,
    enum: ['Idea', 'Testing', 'Building MVP', 'Growing'],
    default: 'Idea'
  },
  members: [memberSchema],
  tasks: [taskSchema],
  history: [historySchema],
  documents: [documentSchema],
  messages: [messageSchema],
  // Portfolio & Showcase Fields
  description: {
    type: String,
    default: ''
  },
  teamPhotoUrl: {
    type: String,
    default: ''
  },
  productMedia: [{
    url: String,
    mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
    caption: String
  }],
  businessModel: {
    type: String,
    default: ''
  },
  pitchDeckUrl: {
    type: String,
    default: ''
  },
  achievements: [{
    title: String,
    date: Date,
    description: String,
    awardType: String
  }],
  fundingRounds: [{
    amount: Number,
    date: Date,
    source: String,
    type: String
  }],
  // Leaderboard Metrics
  pitchEventsJoined: {
    type: Number,
    default: 0
  },
  fundingReceived: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);
