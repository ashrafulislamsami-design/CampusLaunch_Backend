const crypto = require('crypto');
const CanvasBoard = require('../models/CanvasBoard');
const { assertTeamMembership } = require('./canvasController');

exports.enableShare = async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await assertTeamMembership(teamId, req.user.id, res);
    if (!team) return;

    const canvas = await CanvasBoard.findOne({ team: teamId });
    if (!canvas) return res.status(404).json({ message: 'Canvas not found' });

    if (!canvas.shareToken) {
      canvas.shareToken = crypto.randomBytes(16).toString('hex');
    }
    canvas.shareEnabled = true;
    await canvas.save();

    res.json({ shareToken: canvas.shareToken, shareEnabled: true });
  } catch (err) {
    console.error('enableShare error:', err.message);
    res.status(500).json({ message: 'Failed to enable sharing' });
  }
};

exports.disableShare = async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await assertTeamMembership(teamId, req.user.id, res);
    if (!team) return;

    const canvas = await CanvasBoard.findOne({ team: teamId });
    if (!canvas) return res.status(404).json({ message: 'Canvas not found' });
    canvas.shareEnabled = false;
    await canvas.save();
    res.json({ shareEnabled: false });
  } catch (err) {
    console.error('disableShare error:', err.message);
    res.status(500).json({ message: 'Failed to disable sharing' });
  }
};

// Public read-only canvas via share token.
exports.getPublicCanvas = async (req, res) => {
  try {
    const { shareToken } = req.params;
    const canvas = await CanvasBoard.findOne({ shareToken, shareEnabled: true })
      .populate('team', 'name problemStatement solution stage')
      .populate('lastEditedBy', 'name');
    if (!canvas) return res.status(404).json({ message: 'Canvas not found or sharing disabled' });
    res.json({
      canvas: {
        _id: canvas._id,
        sections: canvas.sections,
        lastEditedAt: canvas.lastEditedAt,
        lastEditedBy: canvas.lastEditedBy
      },
      team: canvas.team
    });
  } catch (err) {
    console.error('getPublicCanvas error:', err.message);
    res.status(500).json({ message: 'Failed to load public canvas' });
  }
};
