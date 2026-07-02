const mongoose = require('mongoose');

/**
 * ProfileReport — stores reports submitted by users against other profiles.
 * Distinct from the AI-generated "Report" model (idea validation reports).
 */
const profileReportSchema = new mongoose.Schema(
  {
    // Who filed the report
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // The profile / user being reported
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Reason category
    reason: {
      type: String,
      enum: [
        'spam',
        'harassment',
        'fake_profile',
        'inappropriate_content',
        'scam',
        'other',
      ],
      required: true,
    },

    // Free-text description
    details: {
      type: String,
      default: '',
      maxlength: 2000,
    },

    // Admin action taken
    status: {
      type: String,
      enum: ['pending', 'dismissed', 'suspended', 'investigating'],
      default: 'pending',
    },

    // Admin note when acting on the report
    adminNote: {
      type: String,
      default: '',
    },

    // Timestamp when admin acted
    resolvedAt: {
      type: Date,
      default: null,
    },

    // Admin who resolved
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Index for efficient admin queries
profileReportSchema.index({ status: 1, createdAt: -1 });
profileReportSchema.index({ reportedUser: 1 });

module.exports = mongoose.model('ProfileReport', profileReportSchema);
