const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  ideaData: {
    problem: {
      type: String,
      default: ''
    },
    solution: {
      type: String,
      default: ''
    },
    target: {
      type: String,
      default: ''
    }
  },
  aiResponse: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  suggestions: {
    problem: String,
    solution: String,
    target: String
  },
  missingFields: [{
    type: String,
    enum: ['problem', 'solution', 'target']
  }],
}, {
  timestamps: true
});

module.exports = mongoose.model('Report', reportSchema);