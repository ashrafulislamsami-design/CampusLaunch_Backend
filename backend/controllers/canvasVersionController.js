const CanvasBoard = require('../models/CanvasBoard');
const CanvasVersion = require('../models/CanvasVersion');
const { assertTeamMembership } = require('./canvasController');
const User = require('../models/User');
const Team = require('../models/Team');
const emailService = require('../services/emailService');

const MAX_VERSIONS = 50;

// Extract a plain snapshot from the canvas document.
const snapshotSections = (canvas) => {
  const out = {};
  CanvasBoard.SECTION_KEYS.forEach((key) => {
    const section = canvas.sections?.[key] || { cards: [] };
    out[key] = {
      cards: (section.cards || []).map((c) => ({
        _id: c._id?.toString(),
        content: c.content,
        color: c.color,
        order: c.order,
        createdBy: c.createdBy?.toString?.() || null,
        lastEditedBy: c.lastEditedBy?.toString?.() || null
      })),
      lockedBy: section.lockedBy?.toString?.() || null
    };
  });
  return out;
};

exports.snapshotSections = snapshotSections;

// Create a version snapshot. Used both for manual and auto-save.
exports.createVersion = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { label = '', isAutoSave = false } = req.body || {};
    const team = await assertTeamMembership(teamId, req.user.id, res);
    if (!team) return;

    const canvas = await CanvasBoard.findOne({ team: teamId });
    if (!canvas) return res.status(404).json({ message: 'Canvas not found' });

    const last = await CanvasVersion.findOne({ team: teamId })
      .sort({ versionNumber: -1 })
      .select('versionNumber');

    const version = await CanvasVersion.create({
      canvas: canvas._id,
      team: teamId,
      versionNumber: (last?.versionNumber || 0) + 1,
      label: label.slice(0, 80),
      sectionsSnapshot: snapshotSections(canvas),
      savedBy: req.user.id,
      savedAt: new Date(),
      isAutoSave: !!isAutoSave
    });

    // Trim oldest versions beyond the cap.
    const total = await CanvasVersion.countDocuments({ team: teamId });
    if (total > MAX_VERSIONS) {
      const toDelete = await CanvasVersion.find({ team: teamId })
        .sort({ savedAt: 1 })
        .limit(total - MAX_VERSIONS)
        .select('_id');
      await CanvasVersion.deleteMany({ _id: { $in: toDelete.map((d) => d._id) } });
    }

    res.status(201).json(version);

    // Skip emails for high-frequency auto-saves; only notify on manual saves.
    if (!isAutoSave) {
      try {
        (async () => {
          try {
            const [savedBy, teamDoc] = await Promise.all([
              User.findById(req.user.id).select('name email').lean(),
              Team.findById(teamId).lean()
            ]);
            if (!teamDoc?.members) return;

            for (const member of teamDoc.members) {
              if (String(member.userId) === String(req.user.id)) continue;
              const recipient = await User.findById(member.userId).select('name email _id').lean();
              if (!recipient?.email) continue;
              await emailService.sendCanvasVersionSaved(recipient, savedBy, teamDoc, version)
                .catch((e) => console.error('Canvas email failed:', e.message));
              await new Promise((r) => setTimeout(r, 80));
            }
          } catch (e) { console.error('Canvas email loop failed:', e.message); }
        })();
      } catch (e) { console.error('Canvas email dispatch failed:', e.message); }
    }
  } catch (err) {
    console.error('createVersion error:', err.message);
    res.status(500).json({ message: 'Failed to save version' });
  }
};

exports.listVersions = async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await assertTeamMembership(teamId, req.user.id, res);
    if (!team) return;

    const versions = await CanvasVersion.find({ team: teamId })
      .sort({ savedAt: -1 })
      .limit(50)
      .populate('savedBy', 'name email')
      .select('-sectionsSnapshot');

    res.json(versions);
  } catch (err) {
    console.error('listVersions error:', err.message);
    res.status(500).json({ message: 'Failed to list versions' });
  }
};

exports.getVersion = async (req, res) => {
  try {
    const { teamId, vId } = req.params;
    const team = await assertTeamMembership(teamId, req.user.id, res);
    if (!team) return;

    const version = await CanvasVersion.findOne({ _id: vId, team: teamId })
      .populate('savedBy', 'name email');
    if (!version) return res.status(404).json({ message: 'Version not found' });
    res.json(version);
  } catch (err) {
    console.error('getVersion error:', err.message);
    res.status(500).json({ message: 'Failed to load version' });
  }
};

// Restore a previous version: replace current canvas sections with the snapshot.
exports.restoreVersion = async (req, res) => {
  try {
    const { teamId, vId } = req.params;
    const team = await assertTeamMembership(teamId, req.user.id, res);
    if (!team) return;

    const version = await CanvasVersion.findOne({ _id: vId, team: teamId });
    if (!version) return res.status(404).json({ message: 'Version not found' });

    const canvas = await CanvasBoard.findOne({ team: teamId });
    if (!canvas) return res.status(404).json({ message: 'Canvas not found' });

    // Snapshot current state first so restore is undoable.
    const last = await CanvasVersion.findOne({ team: teamId })
      .sort({ versionNumber: -1 })
      .select('versionNumber');
    await CanvasVersion.create({
      canvas: canvas._id,
      team: teamId,
      versionNumber: (last?.versionNumber || 0) + 1,
      label: `Auto-backup before restoring v${version.versionNumber}`,
      sectionsSnapshot: snapshotSections(canvas),
      savedBy: req.user.id,
      isAutoSave: true
    });

    // Apply snapshot.
    const snap = version.sectionsSnapshot || {};
    CanvasBoard.SECTION_KEYS.forEach((key) => {
      const s = snap[key] || { cards: [] };
      canvas.sections[key].cards = (s.cards || []).map((c, idx) => ({
        content: c.content || '',
        color: c.color || 'yellow',
        order: idx,
        createdBy: c.createdBy || req.user.id,
        lastEditedBy: req.user.id,
        lastEditedAt: new Date()
      }));
      canvas.sections[key].lockedBy = null;
    });
    canvas.lastEditedBy = req.user.id;
    canvas.lastEditedAt = new Date();
    await canvas.save();

    res.json({ canvas, restoredFrom: version.versionNumber });
  } catch (err) {
    console.error('restoreVersion error:', err.message);
    res.status(500).json({ message: 'Failed to restore version' });
  }
};
