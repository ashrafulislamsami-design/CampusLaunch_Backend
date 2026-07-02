const Curriculum = require('../models/Curriculum');
const User = require('../models/User');
const { sendNotification } = require('../utils/notificationHelper');

const notifyCourseWeekAvailable = async (moduleDoc) => {
  if (!moduleDoc?.isPublished) return;

  const releaseAt = moduleDoc.releaseAt ? new Date(moduleDoc.releaseAt) : new Date();
  if (releaseAt > new Date()) return;

  const students = await User.find({ role: 'Student' }).select('_id');
  await Promise.all(
    students.map((student) =>
      sendNotification(
        student._id,
        `Week ${moduleDoc.weekNumber} is now available`,
        `${moduleDoc.moduleTitle} is now live in your startup curriculum.`,
        'COURSE',
        { dedupeKey: `COURSE_WEEK_AVAILABLE:${moduleDoc._id}:${student._id}` }
      )
    )
  );
};

exports.getAllModules = async (req, res) => {
  try {
    const modules = await Curriculum.find({ isPublished: true }).sort({ weekNumber: 1 });
    res.json(modules);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error fetching modules' });
  }
};

exports.getModuleByWeek = async (req, res) => {
  try {
    const { weekNumber } = req.params;
    const moduleDoc = await Curriculum.findOne({ weekNumber: parseInt(weekNumber, 10) });
    if (!moduleDoc) {
      return res.status(404).json({ message: 'Module not found' });
    }
    res.json(moduleDoc);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error fetching module' });
  }
};

exports.createModule = async (req, res) => {
  try {
    if (req.user.role !== 'Organizer') {
      return res.status(403).json({ message: 'Only organizers can create modules' });
    }

    const existing = await Curriculum.findOne({ weekNumber: req.body.weekNumber });
    if (existing) {
      return res.status(400).json({ message: 'Module for this week already exists' });
    }

    const moduleDoc = new Curriculum(req.body);
    await moduleDoc.save();
    await notifyCourseWeekAvailable(moduleDoc);

    res.status(201).json(moduleDoc);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error creating module' });
  }
};

exports.updateModule = async (req, res) => {
  try {
    if (req.user.role !== 'Organizer') {
      return res.status(403).json({ message: 'Only organizers can update modules' });
    }

    const { weekNumber } = req.params;
    const moduleDoc = await Curriculum.findOneAndUpdate(
      { weekNumber: parseInt(weekNumber, 10) },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!moduleDoc) {
      return res.status(404).json({ message: 'Module not found' });
    }

    await notifyCourseWeekAvailable(moduleDoc);
    res.json(moduleDoc);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error updating module' });
  }
};

exports.deleteModule = async (req, res) => {
  try {
    if (req.user.role !== 'Organizer') {
      return res.status(403).json({ message: 'Only organizers can delete modules' });
    }

    const { weekNumber } = req.params;
    const moduleDoc = await Curriculum.findOneAndDelete({ weekNumber: parseInt(weekNumber, 10) });
    if (!moduleDoc) {
      return res.status(404).json({ message: 'Module not found' });
    }
    res.json({ message: 'Module deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error deleting module' });
  }
};
