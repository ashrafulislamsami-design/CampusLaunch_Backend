const mongoose = require('mongoose');
const Resource = require('../models/Resource');
const User = require('../models/User');

const seedResources = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/campuslaunch');

    // Get an organizer user or create one
    let organizer = await User.findOne({ role: 'Organizer' });
    if (!organizer) {
      organizer = new User({
        name: 'Admin User',
        email: 'admin@campuslaunch.com',
        password: 'password123', // In real app, hash this
        role: 'Organizer'
      });
      await organizer.save();
    }

    const resources = [
      {
        title: 'Co-Founder Agreement Template',
        description: 'A comprehensive template for co-founder agreements to protect your startup partnership.',
        type: 'text',
        content: `# Co-Founder Agreement Template

This agreement outlines the terms between co-founders of [Startup Name].

## Key Sections:
1. Equity Distribution
2. Roles and Responsibilities
3. Decision Making Process
4. Exit Strategy
5. Intellectual Property Rights

## How to Use:
1. Replace placeholders with your information
2. Consult with a lawyer before signing
3. Keep copies for all parties
4. Store in a secure location`,
        stage: 'idea',
        instructions: 'Download this template, customize it with your startup details, and have all co-founders review and sign it.',
        author: organizer._id,
        tags: ['legal', 'template', 'co-founder']
      },
      {
        title: 'Financial Projections Spreadsheet',
        description: 'Excel template for creating 3-year financial projections for your startup.',
        type: 'link',
        content: 'https://docs.google.com/spreadsheets/d/example-template-link',
        stage: 'validation',
        instructions: 'Use this spreadsheet to project your startup\'s revenue, expenses, and cash flow for the next 3 years. Input your assumptions and adjust as needed.',
        author: organizer._id,
        tags: ['finance', 'projections', 'spreadsheet']
      },
      {
        title: 'Business Registration Guide - Bangladesh',
        description: 'Step-by-step guide for registering your business with RJSC in Bangladesh.',
        type: 'text',
        content: `# Business Registration in Bangladesh

## Steps to Register with RJSC:

1. **Choose Business Structure**: Decide between proprietorship, partnership, or private limited company.

2. **Prepare Documents**:
   - Name clearance certificate
   - Memorandum and Articles of Association
   - Registered office address proof

3. **Apply Online**: Use the RJSC online portal to submit your application.

4. **Pay Fees**: Pay the required registration fees.

5. **Collect Certificate**: Receive your incorporation certificate.

## Required Documents:
- Passport-sized photos
- National ID copies
- Bank statements
- Property documents

## Timeline: 7-15 working days`,
        stage: 'early',
        instructions: 'Follow these steps in order. Prepare all documents before starting the application process.',
        author: organizer._id,
        tags: ['legal', 'registration', 'bangladesh']
      },
      {
        title: 'Term Sheet Explained',
        description: 'A comprehensive guide explaining what a term sheet is and how to understand it.',
        type: 'text',
        content: `# Understanding Term Sheets

A term sheet is a non-binding agreement outlining the basic terms and conditions of an investment.

## Key Components:

### Valuation
- Pre-money valuation
- Post-money valuation
- Price per share

### Investment Amount
- Total investment
- Tranche details (if applicable)

### Equity Stake
- Percentage ownership
- Number of shares

### Liquidation Preferences
- 1x, 2x, etc.
- Participating vs. non-participating

### Board Seats
- Number of board seats
- Observer rights

### Vesting Schedule
- Founder vesting
- Key employee vesting

## Red Flags to Watch For:
- Excessive liquidation preferences
- Full ratchet anti-dilution
- No pro-rata rights
- Unfavorable board control

## Negotiation Tips:
- Get multiple term sheets
- Understand all terms clearly
- Consult with experienced advisors
- Don't rush the process`,
        stage: 'growth',
        instructions: 'Read this guide before reviewing any term sheet. Highlight terms you don\'t understand and ask your lawyer to explain them.',
        author: organizer._id,
        tags: ['investment', 'legal', 'funding']
      }
    ];

    for (const resourceData of resources) {
      const existing = await Resource.findOne({ title: resourceData.title });
      if (!existing) {
        const resource = new Resource(resourceData);
        await resource.save();
        console.log(`Created resource: ${resource.title}`);
      } else {
        console.log(`Resource already exists: ${resourceData.title}`);
      }
    }

    console.log('Resource seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding resources:', error);
    process.exit(1);
  }
};

seedResources();