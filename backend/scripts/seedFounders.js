const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const User = require('../models/User');

const seedFounders = async () => {
  try {
    console.log('Connecting to MongoDB for founder seeding...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    const testFounders = [
      {
        name: 'Arif Ahmed',
        email: 'arif@nsu.edu.bd',
        password: hashedPassword,
        role: 'Student',
        university: 'North South University',
        department: 'Computer Science',
        skills: ['UI/UX', 'Figma', 'React', 'Adobe XD'],
        lookingFor: ['Team', 'Startup', 'Co-Founder'],
        graduationYear: 2025
      },
      {
        name: 'Sarah Khan',
        email: 'sarah@bracu.ac.bd',
        password: hashedPassword,
        role: 'Student',
        university: 'BRAC University',
        department: 'BBA',
        skills: ['Marketing', 'Social Media', 'Growth Hacking', 'Public Speaking'],
        lookingFor: ['Team', 'Marketing Role'],
        graduationYear: 2024
      },
      {
        name: 'Tanvir Hossain',
        email: 'tanvir@du.ac.bd',
        password: hashedPassword,
        role: 'Student',
        university: 'University of Dhaka',
        department: 'Software Engineering',
        skills: ['Node.js', 'Express', 'MongoDB', 'AWS'],
        lookingFor: ['Backend Role', 'Team'],
        graduationYear: 2025
      }
    ];

    // Clear existing test data if needed, but we'll just insert
    // To avoid duplicates, we can check by email
    for (const founder of testFounders) {
      const existing = await User.findOne({ email: founder.email });
      if (!existing) {
        await new User(founder).save();
        console.log(`Seeded: ${founder.name}`);
      } else {
        console.log(`User ${founder.name} already exists.`);
      }
    }

    console.log('Founder seeding complete.');
    mongoose.disconnect();
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedFounders();
