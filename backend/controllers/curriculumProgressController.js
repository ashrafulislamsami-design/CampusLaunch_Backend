const CurriculumProgress = require('../models/CurriculumProgress');
const Curriculum = require('../models/Curriculum');
const User = require('../models/User');
const emailService = require('../services/emailService');
const EmailLog = require('../models/EmailLog');

const getOrCreateProgress = async (studentId, weekNumber) => {
  let progress = await CurriculumProgress.findOne({ studentId, weekNumber });
  if (!progress) {
    progress = new CurriculumProgress({ studentId, weekNumber });
    await progress.save();
  }
  return progress;
};

// Fire-and-forget: if this week's completion unlocked the next week,
// OR completed all 12 weeks, dispatch the appropriate email.
const _dispatchCompletionEmails = async (studentId, completedWeek) => {
  try {
    const [user, completed] = await Promise.all([
      User.findById(studentId).select('-password').lean(),
      CurriculumProgress.find({
        studentId,
        isCompleted: true
      }).select('weekNumber').lean()
    ]);

    if (!user) return;

    // Week-unlocked email for the NEXT week
    if (completedWeek < 12) {
      const nextWeek = await Curriculum.findOne({
        weekNumber: completedWeek + 1,
        isPublished: true
      }).lean();

      if (nextWeek) {
        const already = await EmailLog.findOne({
          recipient: studentId,
          emailType: 'week_unlocked',
          'metadata.weekNumber': nextWeek.weekNumber
        }).select('_id').lean();

        if (!already) {
          await emailService.sendWeekUnlocked(
            user,
            nextWeek.weekNumber,
            nextWeek.moduleTitle,
            nextWeek.description
          );
        }
      }
    }

    // Certificate email — only when all 12 weeks are complete
    const completedNums = new Set(completed.map((p) => p.weekNumber));
    const allDone = Array.from({ length: 12 }, (_, i) => i + 1).every((w) => completedNums.has(w));

    if (allDone) {
      const already = await EmailLog.findOne({
        recipient: studentId,
        emailType: 'curriculum_certificate'
      }).select('_id').lean();
      if (!already) {
        await emailService.sendCurriculumCertificate(user);
      }
    }
  } catch (err) {
    console.error('Curriculum completion email failed:', err.message);
  }
};

exports.getStudentProgress = async (req, res) => {
  try {
    const progress = await CurriculumProgress.find({ studentId: req.user.id }).sort({ weekNumber: 1 });
    res.json(progress);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error fetching progress' });
  }
};

exports.markVideoWatched = async (req, res) => {
  try {
    const { weekNumber } = req.body;
    if (!weekNumber) {
      return res.status(400).json({ message: 'weekNumber is required' });
    }

    const progress = await getOrCreateProgress(req.user.id, weekNumber);
    progress.videoWatched = true;
    await progress.save();
    res.json(progress);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error marking video' });
  }
};

exports.submitQuiz = async (req, res) => {
  try {
    const { weekNumber, answers } = req.body;
    if (!weekNumber || !answers) {
      return res.status(400).json({ message: 'weekNumber and answers are required' });
    }

    const progress = await getOrCreateProgress(req.user.id, weekNumber);
    if (progress.quizSubmitted) {
      return res.status(400).json({ message: 'Quiz already submitted for this week' });
    }

    const curriculum = await Curriculum.findOne({ weekNumber });
    if (!curriculum || !curriculum.quiz || curriculum.quiz.length === 0) {
      return res.status(404).json({ message: 'Quiz not found for this week' });
    }

    let correct = 0;
    curriculum.quiz.forEach((q, i) => {
      if (answers[i] === q.correctIndex) correct++;
    });

    const score = Math.round((correct / curriculum.quiz.length) * 100);
    progress.quizAnswers = answers;
    progress.quizScore = score;
    progress.quizSubmitted = true;

    if (progress.videoWatched && progress.quizSubmitted) {
      progress.isCompleted = true;
      progress.completedAt = new Date();
    }

    await progress.save();
    res.json(progress);

    if (progress.isCompleted) {
      _dispatchCompletionEmails(req.user.id, Number(weekNumber)).catch(() => {});
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error submitting quiz' });
  }
};

exports.submitAssignment = async (req, res) => {
  try {
    const { weekNumber, text } = req.body;
    if (!weekNumber || !text) {
      return res.status(400).json({ message: 'weekNumber and text are required' });
    }

    const progress = await getOrCreateProgress(req.user.id, weekNumber);
    if (progress.assignmentSubmitted) {
      return res.status(400).json({ message: 'Assignment already submitted for this week' });
    }

    progress.assignmentText = text;
    progress.assignmentSubmitted = true;
    await progress.save();
    res.json(progress);

    if (progress.isCompleted) {
      _dispatchCompletionEmails(req.user.id, Number(weekNumber)).catch(() => {});
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error submitting assignment' });
  }
};

exports.getCertificateEligibility = async (req, res) => {
  try {
    const progress = await CurriculumProgress.find({
      studentId: req.user.id,
      isCompleted: true,
    });

    const completedWeeks = progress.map((p) => p.weekNumber);
    const allCompleted = Array.from({ length: 12 }, (_, i) => i + 1).every((w) => completedWeeks.includes(w));

    if (!allCompleted) {
      return res.json({
        eligible: false,
        completedCount: completedWeeks.length,
        totalWeeks: 12,
      });
    }

    const user = await User.findById(req.user.id).select('name email');
    const lastCompletion = progress.reduce((latest, p) => (p.completedAt > latest ? p.completedAt : latest), new Date(0));

    res.json({
      eligible: true,
      studentName: user?.name || 'Student',
      completionDate: lastCompletion,
      completedCount: 12,
      totalWeeks: 12,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error checking certificate' });
  }
};
