const CanvasBoard = require('../models/CanvasBoard');
const CanvasComment = require('../models/CanvasComment');
const { assertTeamMembership, SECTION_KEYS } = require('./canvasController');

exports.listSectionComments = async (req, res) => {
  try {
    const { teamId, section } = req.params;
    if (!SECTION_KEYS.includes(section)) {
      return res.status(400).json({ message: 'Invalid section key' });
    }
    const team = await assertTeamMembership(teamId, req.user.id, res);
    if (!team) return;

    const comments = await CanvasComment.find({ team: teamId, sectionKey: section })
      .sort({ createdAt: 1 })
      .populate('author', 'name email');
    res.json(comments);
  } catch (err) {
    console.error('listSectionComments error:', err.message);
    res.status(500).json({ message: 'Failed to list comments' });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { sectionKey, content } = req.body;
    if (!SECTION_KEYS.includes(sectionKey)) {
      return res.status(400).json({ message: 'Invalid section key' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment cannot be empty' });
    }
    const team = await assertTeamMembership(teamId, req.user.id, res);
    if (!team) return;
    const canvas = await CanvasBoard.findOne({ team: teamId });
    if (!canvas) return res.status(404).json({ message: 'Canvas not found' });

    const comment = await CanvasComment.create({
      canvas: canvas._id,
      team: teamId,
      sectionKey,
      author: req.user.id,
      content: content.trim().slice(0, 1000)
    });
    const populated = await comment.populate('author', 'name email');
    res.status(201).json(populated);
  } catch (err) {
    console.error('addComment error:', err.message);
    res.status(500).json({ message: 'Failed to add comment' });
  }
};

exports.editComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const comment = await CanvasComment.findById(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.author.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the author can edit' });
    }
    comment.content = (content || '').trim().slice(0, 1000);
    comment.isEdited = true;
    await comment.save();
    const populated = await comment.populate('author', 'name email');
    res.json(populated);
  } catch (err) {
    console.error('editComment error:', err.message);
    res.status(500).json({ message: 'Failed to edit comment' });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const comment = await CanvasComment.findById(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.author.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the author can delete' });
    }
    await comment.deleteOne();
    res.json({ ok: true, commentId });
  } catch (err) {
    console.error('deleteComment error:', err.message);
    res.status(500).json({ message: 'Failed to delete comment' });
  }
};
