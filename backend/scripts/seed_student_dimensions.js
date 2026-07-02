const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

const seedDummyData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for seeding...');

    const students = await User.find({ role: 'Student' });
    console.log(`Found ${students.length} students to update.`);

    const hoursOptions = [5, 10, 20, 40];
    const workStyleOptions = ['remote', 'in-person', 'hybrid'];
    const ideaStageOptions = ['idea', 'prototype', 'mvp', 'growth'];

    for (const student of students) {
      // Only seed if missing or null to avoid overwriting recent valid data
      let updateNeeded = false;
      const updates = {};

      if (!student.hoursPerWeek) {
        updates.hoursPerWeek = hoursOptions[Math.floor(Math.random() * hoursOptions.length)];
        updateNeeded = true;
      }
      if (!student.workStyle) {
        updates.workStyle = workStyleOptions[Math.floor(Math.random() * workStyleOptions.length)];
        updateNeeded = true;
      }
      if (!student.ideaStage) {
        updates.ideaStage = ideaStageOptions[Math.floor(Math.random() * ideaStageOptions.length)];
        updateNeeded = true;
      }

      if (updateNeeded) {
        await User.findByIdAndUpdate(student._id, updates);
        console.log(`Updated student: ${student.name}`);
      }
    }

    console.log('Dummy data seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedDummyData();
