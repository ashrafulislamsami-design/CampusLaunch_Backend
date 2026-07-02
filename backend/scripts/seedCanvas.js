// Seed script for the Canvas Builder feature.
// Usage: node scripts/seedCanvas.js
// Creates demo canvases (fully filled + partial) for the first teams in the DB.

require('dotenv').config();
const mongoose = require('mongoose');
const Team = require('../models/Team');
const CanvasBoard = require('../models/CanvasBoard');
const CanvasVersion = require('../models/CanvasVersion');
const CanvasComment = require('../models/CanvasComment');

const FINTECH = {
  keyPartnerships: [
    'Local commercial banks',
    'bKash / Nagad payment gateway',
    'BTRC for telecom-KYC',
    'University finance clubs'
  ],
  keyActivities: [
    'Mobile app development',
    'Fraud detection engineering',
    'Regulatory compliance',
    'Partnership onboarding'
  ],
  keyResources: [
    'Engineering team (10 people)',
    'Banking licence partnership',
    'Secure cloud infrastructure',
    'Transaction data pipeline'
  ],
  valuePropositions: [
    'Zero-fee P2P transfers for students',
    'Instant tuition payments',
    'Built-in savings pockets',
    'Bilingual (Bangla + English) UX'
  ],
  customerRelationships: [
    '24/7 in-app support chat',
    'Campus ambassador programme',
    'Facebook community group'
  ],
  channels: [
    'Play Store & App Store',
    'University orientation booths',
    'Referral links with cashback'
  ],
  customerSegments: [
    'Bangladeshi undergraduates (18–24)',
    'Parents paying tuition remotely',
    'Campus-based micro-merchants'
  ],
  costStructure: [
    'Cloud & infrastructure',
    'Compliance & audit',
    'Marketing & CAC',
    'Team salaries'
  ],
  revenueStreams: [
    'Interchange fees from merchants',
    'Premium subscription (BDT 99/mo)',
    'B2B API for campus shops'
  ]
};

const HEALTHTECH_PARTIAL = {
  keyPartnerships: ['BSMMU teaching hospital', 'Local pharmacies'],
  valuePropositions: [
    'AI-powered symptom checker in Bangla',
    'Affordable tele-consultations',
    'Medicine reminders & adherence'
  ],
  customerSegments: [
    'Patients in underserved districts',
    'Busy urban professionals'
  ],
  channels: ['WhatsApp chatbot', 'Community health workers'],
  revenueStreams: ['Pay-per-consultation (BDT 150)']
};

const asCards = (arr, opts = {}) => {
  const palette = ['yellow', 'blue', 'green', 'pink', 'orange'];
  return arr.map((content, idx) => ({
    content,
    color: opts.fixedColor || palette[idx % palette.length],
    order: idx,
    createdAt: new Date(),
    lastEditedAt: new Date()
  }));
};

const buildSections = (data) => {
  const keys = CanvasBoard.SECTION_KEYS;
  const out = {};
  keys.forEach((k) => {
    out[k] = { cards: asCards(data[k] || []), lockedBy: null };
  });
  return out;
};

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[seedCanvas] Connected to MongoDB');

    const teams = await Team.find({}).limit(2);
    if (teams.length === 0) {
      console.log('[seedCanvas] No teams exist — create a team first, then re-run.');
      await mongoose.disconnect();
      return;
    }

    // Team 1: fully filled fintech canvas with 3 versions + comments.
    const team1 = teams[0];
    const ceo1 = team1.members.find((m) => m.role === 'CEO')?.userId || team1.members[0].userId;
    await CanvasBoard.deleteOne({ team: team1._id });
    await CanvasVersion.deleteMany({ team: team1._id });
    await CanvasComment.deleteMany({ team: team1._id });

    const c1 = await CanvasBoard.create({
      team: team1._id,
      createdBy: ceo1,
      sections: buildSections(FINTECH),
      lastEditedBy: ceo1,
      lastEditedAt: new Date()
    });

    const snapshot = {};
    CanvasBoard.SECTION_KEYS.forEach((k) => {
      snapshot[k] = { cards: c1.sections[k].cards.map((x) => x.toObject()), lockedBy: null };
    });
    for (let v = 1; v <= 3; v++) {
      await CanvasVersion.create({
        canvas: c1._id,
        team: team1._id,
        versionNumber: v,
        label: v === 3 ? 'Pre-pitch final' : v === 2 ? 'Incorporated mentor feedback' : 'Initial draft',
        sectionsSnapshot: snapshot,
        savedBy: ceo1,
        isAutoSave: false,
        savedAt: new Date(Date.now() - (4 - v) * 86400000)
      });
    }

    const commentSeeds = [
      ['valuePropositions', 'Can we emphasise the bilingual UX more?'],
      ['customerSegments', 'Consider splitting parents into a separate card.'],
      ['revenueStreams', 'Need pricing validation with 50+ students.'],
      ['keyPartnerships', 'Any talks with Dutch-Bangla Bank yet?']
    ];
    for (const [section, content] of commentSeeds) {
      await CanvasComment.create({
        canvas: c1._id,
        team: team1._id,
        sectionKey: section,
        author: ceo1,
        content
      });
    }

    console.log(`[seedCanvas] Filled canvas for team "${team1.name}"`);

    // Team 2 (if present): partial healthtech canvas.
    if (teams[1]) {
      const team2 = teams[1];
      const ceo2 = team2.members.find((m) => m.role === 'CEO')?.userId || team2.members[0].userId;
      await CanvasBoard.deleteOne({ team: team2._id });
      await CanvasVersion.deleteMany({ team: team2._id });
      await CanvasComment.deleteMany({ team: team2._id });

      await CanvasBoard.create({
        team: team2._id,
        createdBy: ceo2,
        sections: buildSections(HEALTHTECH_PARTIAL),
        lastEditedBy: ceo2,
        lastEditedAt: new Date()
      });
      console.log(`[seedCanvas] Partial canvas for team "${team2.name}"`);
    }

    console.log('[seedCanvas] Done.');
    await mongoose.disconnect();
  } catch (err) {
    console.error('[seedCanvas] Error:', err);
    process.exit(1);
  }
})();
