const mongoose = require('mongoose');

const curriculumProgressSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    weekNumber: { type: Number, required: true, min: 1, max: 12 },
    videoWatched: { type: Boolean, default: false },
    quizScore: { type: Number, default: 0, min: 0, max: 100 },
    quizSubmitted: { type: Boolean, default: false },
    quizAnswers: { type: [Number], default: [] },
    assignmentText: { type: String, default: '' },
    assignmentSubmitted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    isCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

curriculumProgressSchema.index({ studentId: 1, weekNumber: 1 }, { unique: true });

module.exports = mongoose.model('CurriculumProgress', curriculumProgressSchema);
