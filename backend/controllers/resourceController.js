const Resource = require('../models/Resource');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// @route   GET /api/resources
// @desc    Get all resources, optionally filtered by stage
exports.getResources = async (req, res) => {
  try {
    const { stage, type, sortBy = 'createdAt', order = 'desc' } = req.query;
    const filter = {};
    if (stage) filter.stage = stage;
    if (type) filter.type = type;

    const sort = {};
    sort[sortBy] = order === 'desc' ? -1 : 1;

    const resources = await Resource.find(filter)
      .populate('author', 'name email')
      .sort(sort);

    res.json(resources);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   GET /api/resources/:id
// @desc    Get a single resource
exports.getResource = async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id)
      .populate('author', 'name email');
    if (!resource) return res.status(404).json({ message: 'Resource not found' });

    res.json(resource);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   POST /api/resources
// @desc    Create a new resource
exports.createResource = async (req, res) => {
  try {
    const { title, description, type, content, stage, instructions, tags } = req.body;
    let filePath = null;

    console.log('Creating resource with data:', { title, description, type, stage, instructions });
    console.log('User ID:', req.user?.id);

    if (type === 'doc' || type === 'pdf') {
      if (!req.file) return res.status(400).json({ message: 'File is required for doc/pdf resources' });
      filePath = req.file.path;
    }

    // Validate content for text and link types
    if ((type === 'text' || type === 'link') && !content) {
      return res.status(400).json({ message: `Content is required for ${type} resources` });
    }

    const resource = new Resource({
      title,
      description,
      type,
      content: type === 'text' || type === 'link' ? content : null,
      filePath,
      stage,
      instructions,
      author: req.user.id,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    });

    console.log('Resource object before save:', resource);

    await resource.save();
    await resource.populate('author', 'name email');
    res.status(201).json(resource);
  } catch (err) {
    console.error('Resource creation error:', err);
    // Send more specific error message
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: err.message || 'Server Error' });
  }
};

// @route   PUT /api/resources/:id
// @desc    Update a resource
exports.updateResource = async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ message: 'Resource not found' });
    if (resource.author.toString() !== req.user.id && req.user.role !== 'Organizer') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { title, description, type, content, stage, instructions, tags } = req.body;

    if (title) resource.title = title;
    if (description) resource.description = description;
    if (stage) resource.stage = stage;
    if (instructions) resource.instructions = instructions;
    if (tags) resource.tags = tags.split(',').map(tag => tag.trim());

    if (type && type !== resource.type) {
      // Type changed, handle accordingly
      resource.type = type;
      if (type === 'text' || type === 'link') {
        resource.content = content;
        if (resource.filePath) {
          fs.unlinkSync(resource.filePath);
          resource.filePath = null;
        }
      } else if (type === 'doc' || type === 'pdf') {
        if (req.file) {
          if (resource.filePath) fs.unlinkSync(resource.filePath);
          resource.filePath = req.file.path;
        }
        resource.content = null;
      }
    } else {
      // Same type
      if (type === 'text' || type === 'link') {
        if (content) resource.content = content;
      } else if ((type === 'doc' || type === 'pdf') && req.file) {
        if (resource.filePath) fs.unlinkSync(resource.filePath);
        resource.filePath = req.file.path;
      }
    }

    await resource.save();
    await resource.populate('author', 'name email');
    res.json(resource);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   DELETE /api/resources/:id
// @desc    Delete a resource
exports.deleteResource = async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ message: 'Resource not found' });
    if (resource.author.toString() !== req.user.id && req.user.role !== 'Organizer') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (resource.filePath) {
      fs.unlinkSync(resource.filePath);
    }

    await Resource.findByIdAndDelete(req.params.id);
    res.json({ message: 'Resource deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   POST /api/resources/:id/vote
// @desc    Vote on a resource (like/dislike)
exports.voteResource = async (req, res) => {
  try {
    const { vote } = req.body; // 'like' or 'dislike'
    if (!['like', 'dislike'].includes(vote)) {
      return res.status(400).json({ message: 'Invalid vote type' });
    }

    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ message: 'Resource not found' });

    const existingVote = resource.voters.find(v => v.user.toString() === req.user.id);

    if (existingVote) {
      if (existingVote.vote === vote) {
        return res.status(400).json({ message: 'Already voted' });
      }
      // Change vote
      if (existingVote.vote === 'like') resource.votes.likes--;
      else resource.votes.dislikes--;
      existingVote.vote = vote;
      if (vote === 'like') resource.votes.likes++;
      else resource.votes.dislikes++;
    } else {
      // New vote
      resource.voters.push({ user: req.user.id, vote });
      if (vote === 'like') resource.votes.likes++;
      else resource.votes.dislikes++;
    }

    await resource.save();
    res.json({ likes: resource.votes.likes, dislikes: resource.votes.dislikes });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   GET /api/resources/:id/download
// @desc    Download a resource file
exports.downloadResource = async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ message: 'Resource not found' });

    if (!resource.filePath) {
      return res.status(400).json({ message: 'This resource does not have a file to download' });
    }

    const filePath = path.resolve(resource.filePath);
    
    // Security check: ensure the file is within the uploads directory
    const uploadsDir = path.resolve(path.join(__dirname, '..', 'uploads'));
    if (!filePath.startsWith(uploadsDir)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Increment download count
    resource.downloads++;
    await resource.save();

    // Set appropriate headers for file download
    const fileName = path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Send the file
    res.sendFile(filePath);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};