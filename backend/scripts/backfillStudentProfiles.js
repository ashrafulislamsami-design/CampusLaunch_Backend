require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const missingSkillsFilter = {
    role: 'Student',
    $or: [{ skills: { $exists: false } }, { skills: { $size: 0 } }]
  };

  const missingInterestsFilter = {
    role: 'Student',
    $or: [{ lookingFor: { $exists: false } }, { lookingFor: { $size: 0 } }]
  };

  const skillsRes = await User.updateMany(missingSkillsFilter, {
    $set: { skills: ['Problem Solving', 'Teamwork', 'Communication'] }
  });

  const interestsRes = await User.updateMany(missingInterestsFilter, {
    $set: { lookingFor: ['Product Development', 'Tech Innovation'] }
  });

  const remainingMissing = await User.countDocuments({
    role: 'Student',
    $or: [
      { skills: { $exists: false } },
      { skills: { $size: 0 } },
      { lookingFor: { $exists: false } },
      { lookingFor: { $size: 0 } }
    ]
  });

  console.log(
    JSON.stringify({
      skillsUpdated: skillsRes.modifiedCount,
      interestsUpdated: interestsRes.modifiedCount,
      remainingMissing
    })
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('backfillStudentProfiles error:', error.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
