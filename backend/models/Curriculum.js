const mongoose = require('mongoose');

const quizQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true },
  },
  { _id: false }
);

const curriculumSchema = new mongoose.Schema(
  {
    weekNumber: { type: Number, required: true, unique: true, min: 1, max: 12 },
    moduleTitle: { type: String, required: true },
    weekRange: { type: String, required: true },
    description: { type: String, required: true },
    videoUrl: { type: String, default: '' },
    readingContent: { type: String, default: '' },
    assignment: {
      prompt: { type: String, default: '' },
      maxWords: { type: Number, default: 500 },
    },
    quiz: [quizQuestionSchema],
    isPublished: { type: Boolean, default: true },
    // Release date for "new week available" notification scheduling
    releaseAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

curriculumSchema.index({ weekNumber: 1 });
curriculumSchema.index({ releaseAt: 1, isPublished: 1 });

module.exports = mongoose.model('Curriculum', curriculumSchema);
