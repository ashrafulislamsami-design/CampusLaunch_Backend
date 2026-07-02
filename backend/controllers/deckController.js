const PitchDeck  = require('../models/PitchDeck');
const DeckReview = require('../models/DeckReview');
const path       = require('path');

// ─── DECK UPLOAD & MANAGEMENT ─────────────────────────────────────────────────

// POST /api/decks  — create deck + upload first version
exports.uploadDeck = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'PDF file is required' });
    const { title, description, teamId } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });

    const deck = new PitchDeck({
      uploaderId:   req.user.id,
      uploaderName: req.user.name || '',
      teamId:       teamId || null,
      title,
      description:  description || '',
      currentVersion: 1,
      versions: [{
        version:    1,
        filePath:   `/uploads/pitchdecks/${req.file.filename}`,
        fileName:   req.file.originalname,
        uploadedAt: new Date()
      }]
    });
    await deck.save();
    res.status(201).json(deck);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /api/decks/:id/version  — upload a new version
exports.uploadVersion = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'PDF file is required' });
    const deck = await PitchDeck.findById(req.params.id);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });
    if (deck.uploaderId.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

    const newVersion = deck.currentVersion + 1;
    deck.versions.push({
      version:  newVersion,
      filePath: `/uploads/pitchdecks/${req.file.filename}`,
      fileName: req.file.originalname,
      uploadedAt: new Date()
    });
    deck.currentVersion = newVersion;
    await deck.save();
    res.json(deck);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /api/decks  — list all decks (public browsing for reviewers)
exports.listDecks = async (req, res) => {
  try {
    const decks = await PitchDeck.find().sort({ updatedAt: -1 }).limit(50);
    res.json(decks);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/decks/my  — my decks
exports.myDecks = async (req, res) => {
  try {
    const decks = await PitchDeck.find({ uploaderId: req.user.id }).sort({ updatedAt: -1 });
    res.json(decks);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper: Check if user has access to this deck (BOLA / IDOR protection)
const checkDeckAccess = async (deck, user) => {
  if (user.role === 'Mentor' || user.role === 'Admin') return true;
  if (deck.uploaderId.toString() === user.id) return true;
  if (deck.teamId) {
    const Team = require('../models/Team');
    const team = await Team.findById(deck.teamId);
    if (team) {
      return team.members.some(m => m.userId.toString() === user.id);
    }
  }
  return false;
};

// GET /api/decks/:id  — get one deck
exports.getDeck = async (req, res) => {
  try {
    const deck = await PitchDeck.findById(req.params.id);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    const hasAccess = await checkDeckAccess(deck, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Not authorized to view this pitch deck' });
    }

    res.json(deck);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/decks/:id
exports.deleteDeck = async (req, res) => {
  try {
    const deck = await PitchDeck.findById(req.params.id);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });
    if (deck.uploaderId.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    await PitchDeck.findByIdAndDelete(req.params.id);
    await DeckReview.deleteMany({ deckId: req.params.id });
    res.json({ message: 'Deck deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── REVIEW SUBMISSION ────────────────────────────────────────────────────────

// POST /api/decks/:id/reviews
exports.submitReview = async (req, res) => {
  try {
    const { version, criteria, overallComment, recommendation } = req.body;
    const deck = await PitchDeck.findById(req.params.id);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    // Reviewer authorization: Only mentors and admins can submit pitch deck reviews
    if (req.user.role !== 'Mentor' && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Only mentors and admins are authorized to submit reviews' });
    }

    // Validate criteria scores
    const fields = ['problemClarity', 'solutionQuality', 'marketOpportunity', 'businessModel', 'teamStrength', 'slideDesign'];
    for (const f of fields) {
      if (!criteria[f] || !criteria[f].score || criteria[f].score < 1 || criteria[f].score > 5) {
        return res.status(400).json({ message: `Score 1-5 required for: ${f}` });
      }
    }

    // Calculate average
    const scores  = fields.map(f => criteria[f].score);
    const avgScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;

    const review = await DeckReview.findOneAndUpdate(
      { deckId: req.params.id, version: version || deck.currentVersion, reviewerId: req.user.id },
      {
        reviewerName: req.user.name || '',
        reviewerRole: req.user.role || 'Student',
        criteria,
        overallComment: overallComment || '',
        recommendation: recommendation || 'needs-work',
        avgScore
      },
      { upsert: true, new: true }
    );

    // Recompute aggregate on deck + on version entry
    await _recomputeDeckAggregate(req.params.id, deck);

    res.json(review);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'You already reviewed this version' });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /api/decks/:id/reviews
exports.getReviews = async (req, res) => {
  try {
    const deck = await PitchDeck.findById(req.params.id);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    const hasAccess = await checkDeckAccess(deck, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Not authorized to view reviews for this pitch deck' });
    }

    const { version } = req.query;
    const filter = { deckId: req.params.id };
    if (version) filter.version = Number(version);
    const reviews = await DeckReview.find(filter).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/decks/:id/report  — full report with category breakdown & trend
exports.getDeckReport = async (req, res) => {
  try {
    const deck = await PitchDeck.findById(req.params.id);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    const hasAccess = await checkDeckAccess(deck, req.user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Not authorized to view the report for this pitch deck' });
    }

    const reviews = await DeckReview.find({ deckId: req.params.id }).sort({ version: 1, createdAt: 1 });

    // Build per-version breakdown
    const versionMap = {};
    for (const r of reviews) {
      if (!versionMap[r.version]) versionMap[r.version] = [];
      versionMap[r.version].push(r);
    }

    const criteria = ['problemClarity', 'solutionQuality', 'marketOpportunity', 'businessModel', 'teamStrength', 'slideDesign'];

    const versionReports = Object.keys(versionMap).map(v => {
      const vReviews = versionMap[v];
      const categoryAvgs = {};
      for (const c of criteria) {
        const scores = vReviews.map(r => r.criteria[c]?.score).filter(Boolean);
        categoryAvgs[c] = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
      }
      const allScores = vReviews.map(r => r.avgScore).filter(Boolean);
      const overallAvg = allScores.length ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : null;

      return { version: Number(v), totalReviewers: vReviews.length, overallAvg, categoryAvgs, reviews: vReviews };
    });

    res.json({
      deck,
      totalReviews: reviews.length,
      versionReports,
      trend: versionReports.map(vr => ({ version: vr.version, avg: vr.overallAvg }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Helper ───────────────────────────────────────────────────────────────────
async function _recomputeDeckAggregate(deckId, deck) {
  try {
    // Latest version reviews
    const latestReviews = await DeckReview.find({ deckId, version: deck.currentVersion });
    const scores = latestReviews.map(r => r.avgScore).filter(Boolean);
    const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;

    const totalReviews = await DeckReview.countDocuments({ deckId });

    // Update version entry
    const versionEntry = deck.versions.find(v => v.version === deck.currentVersion);
    if (versionEntry) versionEntry.avgScore = avg;

    deck.latestAvgScore = avg;
    deck.totalReviews   = totalReviews;
    await deck.save();
  } catch (_) {}
}