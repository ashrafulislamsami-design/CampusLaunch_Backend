const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: false
  },
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true
  },
  role: {
    type: String,
    enum: ['Student', 'Mentor', 'Organizer', 'Admin'],
    required: true
  },
  // Admin: account suspension
  isSuspended: {
    type: Boolean,
    default: false
  },
  suspendedAt: {
    type: Date,
    default: null
  },
  suspensionReason: {
    type: String,
    default: ''
  },
  // Organizer verification status
  organizerVerified: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: function () { return this.role === 'Organizer' ? 'pending' : undefined; }
  },
  // fields specific to Students
  university: {
    type: String,
    required: function() { return this.role === 'Student'; }
  },
  department: {
    type: String
  },
  graduationYear: {
    type: Number
  },
  skills: {
    type: [String],
    default: [],
    validate: {
      validator: function(value) {
        return this.role !== 'Student' || (Array.isArray(value) && value.length > 0);
      },
      message: 'Student accounts must include at least one skill'
    }
  },
  lookingFor: {
    type: [String],
    default: [],
    validate: {
      validator: function(value) {
        return this.role !== 'Student' || (Array.isArray(value) && value.length > 0);
      },
      message: 'Student accounts must include at least one interest'
    }
  },
  // Co-founder matching dimensions
  hoursPerWeek: {
    type: Number,
    required: function() { return this.role === 'Student'; },
    default: null  // e.g. 5, 10, 20, 40
  },
  workStyle: {
    type: String,
    enum: ['remote', 'in-person', 'hybrid', null],
    required: function() { return this.role === 'Student'; },
    default: null
  },
  ideaStage: {
    type: String,
    enum: ['idea', 'prototype', 'mvp', 'growth', null],
    default: null
  },
  // Leaderboard Metrics
  pitchEvents: {
    type: Number,
    default: 0
  },
  funding: {
    type: Number,
    default: 0,
    min: [0, 'Funding cannot be a negative value']
  },
  mentorSessions: {
    type: Number,
    default: 0
  },
  coursesFinished: {
    type: Number,
    default: 0
  },
  isAmbassador: {
    type: Boolean,
    default: false
  },
  // fields specific to Mentors
  jobDetails: {
    type: String,
    required: function() { return this.role === 'Mentor'; }
  },
  linkedinUrl: {
    type: String
  },
  expertise: {
    type: [String],
    default: []
  },
  // Module 2 Feature 4: Notification System Fields
  fcmToken: {
    type: String,
    default: null
  },
  notificationSettings: {
    coFounderMatches: { type: Boolean, default: true },
    mentorSessions: { type: Boolean, default: true },
    pitchEvents: { type: Boolean, default: true },
    teamUpdates: { type: Boolean, default: true },
    fundingAlerts: { type: Boolean, default: true },
    courseUpdates: { type: Boolean, default: true }
  },
  watchlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Funding'
  }],
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
