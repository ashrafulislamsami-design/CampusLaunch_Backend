const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'doc', 'pdf', 'link'],
    required: true
  },
  content: {
    type: String,
    required: function() { return this.type === 'text' || this.type === 'link'; }
  },
  filePath: {
    type: String,
    required: function() { return this.type === 'doc' || this.type === 'pdf'; }
  },
  stage: {
    type: String,
    enum: ['idea', 'validation', 'early', 'growth', 'scaling'],
    required: true
  },
  instructions: {
    type: String,
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  votes: {
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 }
  },
  voters: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    vote: { type: String, enum: ['like', 'dislike'] }
  }],
  downloads: {
    type: Number,
    default: 0
  },
  tags: [String]
}, {
  timestamps: true
});

module.exports = mongoose.model('Resource', resourceSchema);