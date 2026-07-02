const crypto = require('crypto');
const mongoose = require('mongoose');
const CanvasBoard = require('../models/CanvasBoard');
const Team = require('../models/Team');

const SECTION_KEYS = CanvasBoard.SECTION_KEYS;

const emptySections = () =>
  SECTION_KEYS.reduce((acc, key) => {
    acc[key] = { cards: [], lockedBy: null };
    return acc;
  }, {});

// Verify the authenticated user is a member of the team. Returns the team doc
// or sends a 403/404 response and returns null.
const assertTeamMembership = async (teamId, userId, res) => {
  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    res.status(400).json({ message: 'Invalid team id' });
    return null;
  }
  const team = await Team.findById(teamId);
  if (!team) {
    res.status(404).json({ message: 'Team not found' });
    return null;
  }
  const isMember = team.members.some(
    (m) => m.status === 'accepted' && m.userId.toString() === userId.toString()
  );
  if (!isMember) {
    res.status(403).json({ message: 'You are not a member of this team' });
    return null;
  }
  return team;
};

exports.assertTeamMembership = assertTeamMembership;

// GET or create the team's canvas.
exports.getOrCreateCanvas = async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await assertTeamMembership(teamId, req.user.id, res);
    if (!team) return;

    let canvas = await CanvasBoard.findOne({ team: teamId })
      .populate('lastEditedBy', 'name email')
      .populate('createdBy', 'name email');

    if (!canvas) {
      canvas = await CanvasBoard.create({
        team: teamId,
        createdBy: req.user.id,
        sections: emptySections(),
        lastEditedBy: req.user.id,
        lastEditedAt: new Date()
      });
    }

    res.json({ canvas, team: { _id: team._id, name: team.name } });
  } catch (err) {
    console.error('getOrCreateCanvas error:', err.message);
    res.status(500).json({ message: 'Failed to load canvas' });
  }
};

// Replace a section's cards entirely (used for reorder / bulk updates).
exports.updateSection = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { sectionKey, cards } = req.body;
    if (!SECTION_KEYS.includes(sectionKey)) {
      return res.status(400).json({ message: 'Invalid section key' });
    }
    const team = await assertTeamMembership(teamId, req.user.id, res);
    if (!team) return;

    const canvas = await CanvasBoard.findOne({ team: teamId });
    if (!canvas) return res.status(404).json({ message: 'Canvas not found' });

    const lockedBy = canvas.sections[sectionKey]?.lockedBy;
    if (lockedBy && lockedBy.toString() !== req.user.id) {
      return res.status(423).json({ message: 'Section is locked by another member' });
    }

    canvas.sections[sectionKey].cards = (cards || []).slice(0, 20).map((c, idx) => ({
      ...c,
      order: idx,
      lastEditedBy: req.user.id,
      lastEditedAt: new Date()
    }));
    canvas.sections[sectionKey].lastEditedBy = req.user.id;
    canvas.sections[sectionKey].lastEditedAt = new Date();
    canvas.lastEditedBy = req.user.id;
    canvas.lastEditedAt = new Date();
    await canvas.save();

    res.json(canvas);
  } catch (err) {
    console.error('updateSection error:', err.message);
    res.status(500).json({ message: 'Failed to update section' });
  }
};

exports.addCard = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { sectionKey, content = '', color = 'yellow' } = req.body;
    if (!SECTION_KEYS.includes(sectionKey)) {
      return res.status(400).json({ message: 'Invalid section key' });
    }
    const team = await assertTeamMembership(teamId, req.user.id, res);
    if (!team) return;

    const canvas = await CanvasBoard.findOne({ team: teamId });
    if (!canvas) return res.status(404).json({ message: 'Canvas not found' });

    if (canvas.sections[sectionKey].cards.length >= 20) {
      return res.status(400).json({ message: 'Maximum 20 cards per section' });
    }
    const lockedBy = canvas.sections[sectionKey]?.lockedBy;
    if (lockedBy && lockedBy.toString() !== req.user.id) {
      return res.status(423).json({ message: 'Section is locked' });
    }

    const card = {
      content,
      color,
      order: canvas.sections[sectionKey].cards.length,
      createdBy: req.user.id,
      createdAt: new Date(),
      lastEditedBy: req.user.id,
      lastEditedAt: new Date()
    };
    canvas.sections[sectionKey].cards.push(card);
    canvas.sections[sectionKey].lastEditedBy = req.user.id;
    canvas.sections[sectionKey].lastEditedAt = new Date();
    canvas.lastEditedBy = req.user.id;
    canvas.lastEditedAt = new Date();
    await canvas.save();

    const created = canvas.sections[sectionKey].cards[canvas.sections[sectionKey].cards.length - 1];
    res.status(201).json({ card: created, sectionKey });
  } catch (err) {
    console.error('addCard error:', err.message);
    res.status(500).json({ message: 'Failed to add card' });
  }
};

exports.updateCard = async (req, res) => {
  try {
    const { teamId, cardId } = req.params;
    const { sectionKey, content, color } = req.body;
    if (!SECTION_KEYS.includes(sectionKey)) {
      return res.status(400).json({ message: 'Invalid section key' });
    }
    const team = await assertTeamMembership(teamId, req.user.id, res);
    if (!team) return;

    const canvas = await CanvasBoard.findOne({ team: teamId });
    if (!canvas) return res.status(404).json({ message: 'Canvas not found' });

    const card = canvas.sections[sectionKey].cards.id(cardId);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const lockedBy = canvas.sections[sectionKey]?.lockedBy;
    if (lockedBy && lockedBy.toString() !== req.user.id) {
      return res.status(423).json({ message: 'Section is locked' });
    }

    if (typeof content === 'string') card.content = content;
    if (color) card.color = color;
    card.lastEditedBy = req.user.id;
    card.lastEditedAt = new Date();
    canvas.sections[sectionKey].lastEditedBy = req.user.id;
    canvas.sections[sectionKey].lastEditedAt = new Date();
    canvas.lastEditedBy = req.user.id;
    canvas.lastEditedAt = new Date();
    await canvas.save();

    res.json({ card, sectionKey });
  } catch (err) {
    console.error('updateCard error:', err.message);
    res.status(500).json({ message: 'Failed to update card' });
  }
};

exports.deleteCard = async (req, res) => {
  try {
    const { teamId, cardId } = req.params;
    const { sectionKey } = req.body;
    if (!SECTION_KEYS.includes(sectionKey)) {
      return res.status(400).json({ message: 'Invalid section key' });
    }
    const team = await assertTeamMembership(teamId, req.user.id, res);
    if (!team) return;

    const canvas = await CanvasBoard.findOne({ team: teamId });
    if (!canvas) return res.status(404).json({ message: 'Canvas not found' });

    const card = canvas.sections[sectionKey].cards.id(cardId);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const lockedBy = canvas.sections[sectionKey]?.lockedBy;
    if (lockedBy && lockedBy.toString() !== req.user.id) {
      return res.status(423).json({ message: 'Section is locked' });
    }

    card.deleteOne();
    canvas.sections[sectionKey].cards.forEach((c, idx) => {
      c.order = idx;
    });
    canvas.sections[sectionKey].lastEditedBy = req.user.id;
    canvas.sections[sectionKey].lastEditedAt = new Date();
    canvas.lastEditedBy = req.user.id;
    canvas.lastEditedAt = new Date();
    await canvas.save();

    res.json({ ok: true, cardId, sectionKey });
  } catch (err) {
    console.error('deleteCard error:', err.message);
    res.status(500).json({ message: 'Failed to delete card' });
  }
};

exports.reorderSection = async (req, res) => {
  try {
    const { teamId, key } = req.params;
    const { cardOrder } = req.body;
    if (!SECTION_KEYS.includes(key)) {
      return res.status(400).json({ message: 'Invalid section key' });
    }
    const team = await assertTeamMembership(teamId, req.user.id, res);
    if (!team) return;

    const canvas = await CanvasBoard.findOne({ team: teamId });
    if (!canvas) return res.status(404).json({ message: 'Canvas not found' });

    const sectionCards = canvas.sections[key].cards;
    const byId = new Map(sectionCards.map((c) => [c._id.toString(), c]));
    const reordered = [];
    (cardOrder || []).forEach((id, idx) => {
      const card = byId.get(id);
      if (card) {
        card.order = idx;
        reordered.push(card);
      }
    });
    sectionCards.forEach((c) => {
      if (!cardOrder || !cardOrder.includes(c._id.toString())) {
        c.order = reordered.length;
        reordered.push(c);
      }
    });
    canvas.sections[key].cards = reordered;
    canvas.lastEditedBy = req.user.id;
    canvas.lastEditedAt = new Date();
    await canvas.save();

    res.json(canvas.sections[key]);
  } catch (err) {
    console.error('reorderSection error:', err.message);
    res.status(500).json({ message: 'Failed to reorder' });
  }
};

exports.toggleLock = async (req, res) => {
  try {
    const { teamId, key } = req.params;
    if (!SECTION_KEYS.includes(key)) {
      return res.status(400).json({ message: 'Invalid section key' });
    }
    const team = await assertTeamMembership(teamId, req.user.id, res);
    if (!team) return;

    // Only CEO or the user currently holding the lock can toggle.
    const member = team.members.find(
      (m) => m.userId.toString() === req.user.id && m.status === 'accepted'
    );
    const isLead = member && member.role === 'CEO';

    const canvas = await CanvasBoard.findOne({ team: teamId });
    if (!canvas) return res.status(404).json({ message: 'Canvas not found' });

    const current = canvas.sections[key].lockedBy;
    if (current) {
      if (current.toString() !== req.user.id && !isLead) {
        return res.status(403).json({ message: 'Only the section owner or team lead can unlock' });
      }
      canvas.sections[key].lockedBy = null;
    } else {
      canvas.sections[key].lockedBy = req.user.id;
    }
    await canvas.save();
    res.json({ sectionKey: key, lockedBy: canvas.sections[key].lockedBy });
  } catch (err) {
    console.error('toggleLock error:', err.message);
    res.status(500).json({ message: 'Failed to toggle lock' });
  }
};

exports.assertTeamMembership = assertTeamMembership;
exports.SECTION_KEYS = SECTION_KEYS;
