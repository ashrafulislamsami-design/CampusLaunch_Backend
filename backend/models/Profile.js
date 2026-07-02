const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true }
});

const profileSchema = new mongoose.Schema({
  // Link to the User document
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  // Mirrors User fields but extended for richer profile
  name: { type: String, required: true },
  email: { type: String, required: true },
  university: { type: String, default: '' },
  department: { type: String, default: '' },
  graduationYear: { type: Number, default: null },

  // Skills multi-select
  skills: {
    type: [String],
    default: [],
    enum: [
      'coding', 'design', 'marketing', 'writing', 'finance',
      'sales', 'product', 'data', 'ai/ml', 'legal',
      'operations', 'social media', 'video editing', 'research'
    ]
  },

  // Co-founder search
  lookingForSkills: {
    type: [String],
    default: []
  },

  // Past projects (array of objects)
  pastProjects: {
    type: [projectSchema],
    default: []
  },

  // Startup idea (optional free text)
  startupIdea: { type: String, default: '' },

  // Weekly availability
  weeklyAvailability: { type: Number, default: 0 }, // hours per week

  // Motivation paragraph
  motivation: { type: String, default: '' },

  // Profile tag (status)
  profileTag: {
    type: String,
    enum: ['Looking for co-founder', 'I have an idea', 'Ready to join a team'],
    default: 'Ready to join a team'
  },

  // LinkedIn optional
  linkedinUrl: { type: String, default: '' },

  // Visibility
  isPublic: { type: Boolean, default: true }

}, { timestamps: true });

// Virtual: calculate profile completeness %
profileSchema.virtual('completeness').get(function () {
  const fields = [
    this.name,
    this.university,
    this.department,
    this.skills.length > 0,
    this.lookingForSkills.length > 0,
    this.pastProjects.length > 0,
    this.startupIdea,
    this.weeklyAvailability > 0,
    this.motivation,
    this.profileTag,
    this.linkedinUrl
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
});

profileSchema.set('toJSON', { virtuals: true });
profileSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Profile', profileSchema);