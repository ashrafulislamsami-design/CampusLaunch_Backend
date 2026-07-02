const mongoose = require('mongoose');

/**
 * FeaturedContent — admin-curated featured items displayed on the platform.
 * Supports mentors, startups (teams), events, and success stories.
 */
const featuredContentSchema = new mongoose.Schema(
  {
    contentType: {
      type: String,
      enum: ['mentor', 'startup', 'event', 'success_story'],
      required: true,
    },

    // Reference to the actual document (polymorphic via contentType)
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'refModel',
    },

    // Mongoose refPath companion — resolved from contentType
    refModel: {
      type: String,
      required: true,
      enum: ['Mentor', 'Team', 'Event', 'User'],
    },

    // Optional custom headline / caption set by admin
    title: { type: String, default: '' },
    description: { type: String, default: '' },

    // Display order (lower = higher priority)
    sortOrder: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },

    // Admin who featured this
    featuredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

featuredContentSchema.index({ contentType: 1, isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('FeaturedContent', featuredContentSchema);
