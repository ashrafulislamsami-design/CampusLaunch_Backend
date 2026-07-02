const mongoose = require('mongoose');
const crypto = require('crypto');

// Per-user email preferences for the Automated Email Communication System.
// Kept intentionally separate from User.notificationSettings so this module
// never has to modify the User model.

const categorySchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    frequency: {
      type: String,
      enum: ['immediate', 'daily', 'off'],
      default: 'immediate'
    }
  },
  { _id: false }
);

const emailPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    preferences: {
      coFounderMatches: { type: categorySchema, default: () => ({}) },
      mentorSessions: { type: categorySchema, default: () => ({}) },
      pitchEvents: { type: categorySchema, default: () => ({}) },
      fundingOpportunities: { type: categorySchema, default: () => ({}) },
      curriculumProgress: { type: categorySchema, default: () => ({}) },
      teamCanvasUpdates: { type: categorySchema, default: () => ({}) },
      weeklyDigest: {
        enabled: { type: Boolean, default: true }
      }
    },
    unsubscribedAll: { type: Boolean, default: false },
    unsubscribeToken: {
      type: String,
      default: () => crypto.randomBytes(24).toString('hex'),
      index: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmailPreference', emailPreferenceSchema);
