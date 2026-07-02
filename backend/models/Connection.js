const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  message: {
    type: String,
    default: ''
  },
  matchScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  matchReason: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Ensure unique pending/accepted connections between users
connectionSchema.index({ sender: 1, receiver: 1, status: 1 }, { unique: true });

module.exports = mongoose.model('Connection', connectionSchema);
