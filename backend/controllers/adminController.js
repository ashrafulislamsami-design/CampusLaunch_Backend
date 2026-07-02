const User = require('../models/User');
const Mentor = require('../models/Mentor');
const Team = require('../models/Team');
const Booking = require('../models/Booking');
const PitchEvent = require('../models/PitchEvent');
const ProfileReport = require('../models/ProfileReport');
const FeaturedContent = require('../models/FeaturedContent');
const Event = require('../models/Event');

// ─────────────────────────────────────────────
// 1. PLATFORM STATISTICS
// ─────────────────────────────────────────────

/**
 * GET /api/admin/stats
 * Returns live platform-wide statistics.
 */
exports.getPlatformStats = async (req, res) => {
  try {
    const [
      totalStudents,
      totalTeams,
      completedSessions,
      totalPitchEvents,
      fundingAggregate,
      pendingMentors,
      pendingOrganizers,
      pendingReports,
    ] = await Promise.all([
      User.countDocuments({ role: 'Student' }),
      Team.countDocuments({}),
      Booking.countDocuments({ status: 'completed' }),
      PitchEvent.countDocuments({}),
      // Sum all student funding fields
      User.aggregate([
        { $match: { role: 'Student' } },
        { $group: { _id: null, total: { $sum: '$funding' } } },
      ]),
      // Pending mentor verifications
      Mentor.countDocuments({ verificationStatus: 'pending' }),
      // Pending organizer verifications
      User.countDocuments({ role: 'Organizer', organizerVerified: 'pending' }),
      // Open profile reports
      ProfileReport.countDocuments({ status: 'pending' }),
    ]);

    const totalFundingRaised = fundingAggregate[0]?.total || 0;

    res.json({
      totalStudents,
      totalTeams,
      completedSessions,
      totalPitchEvents,
      totalFundingRaised,
      pendingMentors,
      pendingOrganizers,
      pendingReports,
    });
  } catch (err) {
    console.error('Admin stats error:', err.message);
    res.status(500).json({ message: 'Server error fetching statistics' });
  }
};

// ─────────────────────────────────────────────
// 2. MENTOR VERIFICATION
// ─────────────────────────────────────────────

/**
 * GET /api/admin/mentors/pending
 * Lists all mentor profiles awaiting verification.
 */
exports.getPendingMentors = async (req, res) => {
  try {
    const mentors = await Mentor.find({ verificationStatus: 'pending' })
      .populate('userId', 'name email linkedinUrl jobDetails createdAt')
      .sort({ createdAt: -1 });

    res.json({ mentors, total: mentors.length });
  } catch (err) {
    console.error('getPendingMentors error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/admin/mentors
 * Lists ALL mentors with optional status filter.
 * Query: ?status=pending|approved|rejected&page=1&limit=20
 */
exports.getAllMentors = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.verificationStatus = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [mentors, total] = await Promise.all([
      Mentor.find(query)
        .populate('userId', 'name email linkedinUrl jobDetails createdAt isSuspended')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Mentor.countDocuments(query),
    ]);

    res.json({ mentors, total, page: Number(page) });
  } catch (err) {
    console.error('getAllMentors error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PATCH /api/admin/mentors/:mentorId/verify
 * Approve or reject a mentor application.
 * Body: { action: 'approve' | 'reject', note?: string }
 */
exports.verifyMentor = async (req, res) => {
  try {
    const { action, note } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action must be "approve" or "reject"' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const mentor = await Mentor.findByIdAndUpdate(
      req.params.mentorId,
      {
        $set: {
          verificationStatus: newStatus,
          verificationNote: note || '',
          verifiedAt: new Date(),
          // Only activate if approved
          isActive: action === 'approve',
        },
      },
      { new: true }
    ).populate('userId', 'name email');

    if (!mentor) return res.status(404).json({ message: 'Mentor not found' });

    res.json({ message: `Mentor ${newStatus} successfully`, mentor });
  } catch (err) {
    console.error('verifyMentor error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// 3. ORGANIZER VERIFICATION
// ─────────────────────────────────────────────

/**
 * GET /api/admin/organizers
 * Lists all organizer accounts with optional status filter.
 * Query: ?status=pending|approved|rejected&page=1&limit=20
 */
exports.getOrganizers = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const query = { role: 'Organizer' };
    if (status !== 'all') query.organizerVerified = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [organizers, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(query),
    ]);

    res.json({ organizers, total, page: Number(page) });
  } catch (err) {
    console.error('getOrganizers error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PATCH /api/admin/organizers/:userId/verify
 * Approve or reject an organizer account.
 * Body: { action: 'approve' | 'reject', note?: string }
 */
exports.verifyOrganizer = async (req, res) => {
  try {
    const { action } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action must be "approve" or "reject"' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'Organizer') {
      return res.status(400).json({ message: 'User is not an Organizer' });
    }

    user.organizerVerified = action === 'approve' ? 'approved' : 'rejected';
    await user.save();

    const result = user.toObject();
    delete result.password;
    res.json({ message: `Organizer ${user.organizerVerified} successfully`, organizer: result });
  } catch (err) {
    console.error('verifyOrganizer error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// 4. FEATURED CONTENT MANAGEMENT
// ─────────────────────────────────────────────

// Map contentType → Mongoose model name
const CONTENT_TYPE_MODEL_MAP = {
  mentor: 'Mentor',
  startup: 'Team',
  event: 'Event',
  success_story: 'User',
};

/**
 * GET /api/admin/featured
 * Lists all featured content entries.
 * Query: ?type=mentor|startup|event|success_story&active=true
 */
exports.getFeaturedContent = async (req, res) => {
  try {
    const { type, active } = req.query;
    const query = {};
    if (type) query.contentType = type;
    if (active !== undefined) query.isActive = active === 'true';

    const items = await FeaturedContent.find(query)
      .populate('refId')
      .populate('featuredBy', 'name email')
      .sort({ sortOrder: 1, createdAt: -1 });

    res.json({ items, total: items.length });
  } catch (err) {
    console.error('getFeaturedContent error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /api/admin/featured
 * Add a new featured content item.
 * Body: { contentType, refId, title?, description?, sortOrder? }
 */
exports.addFeaturedContent = async (req, res) => {
  try {
    const { contentType, refId, title, description, sortOrder } = req.body;

    if (!CONTENT_TYPE_MODEL_MAP[contentType]) {
      return res.status(400).json({ message: `Invalid contentType: ${contentType}` });
    }
    if (!refId) {
      return res.status(400).json({ message: 'refId is required' });
    }

    // Prevent duplicates
    const existing = await FeaturedContent.findOne({ contentType, refId });
    if (existing) {
      return res.status(409).json({ message: 'This item is already featured' });
    }

    const item = new FeaturedContent({
      contentType,
      refId,
      refModel: CONTENT_TYPE_MODEL_MAP[contentType],
      title: title || '',
      description: description || '',
      sortOrder: sortOrder || 0,
      featuredBy: req.user.id,
      isActive: true,
    });

    await item.save();
    res.status(201).json({ message: 'Featured content added', item });
  } catch (err) {
    console.error('addFeaturedContent error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PATCH /api/admin/featured/:id
 * Update or toggle a featured content item.
 * Body: { isActive?, title?, description?, sortOrder? }
 */
exports.updateFeaturedContent = async (req, res) => {
  try {
    const { isActive, title, description, sortOrder } = req.body;
    const updates = {};
    if (isActive !== undefined) updates.isActive = isActive;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    const item = await FeaturedContent.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Featured content not found' });

    res.json({ message: 'Featured content updated', item });
  } catch (err) {
    console.error('updateFeaturedContent error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * DELETE /api/admin/featured/:id
 * Remove a featured content entry entirely.
 */
exports.deleteFeaturedContent = async (req, res) => {
  try {
    const item = await FeaturedContent.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Featured content not found' });
    res.json({ message: 'Featured content removed' });
  } catch (err) {
    console.error('deleteFeaturedContent error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// 5. PROFILE REPORTS
// ─────────────────────────────────────────────

/**
 * GET /api/admin/reports
 * Lists profile reports. Query: ?status=pending|dismissed|suspended|investigating
 */
exports.getProfileReports = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const query = {};
    if (status !== 'all') query.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [reports, total] = await Promise.all([
      ProfileReport.find(query)
        .populate('reportedBy', 'name email role')
        .populate('reportedUser', 'name email role isSuspended')
        .populate('resolvedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ProfileReport.countDocuments(query),
    ]);

    res.json({ reports, total, page: Number(page) });
  } catch (err) {
    console.error('getProfileReports error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PATCH /api/admin/reports/:reportId/action
 * Take action on a profile report.
 * Body: { action: 'dismiss' | 'suspend' | 'investigate', adminNote?: string }
 */
exports.actOnReport = async (req, res) => {
  try {
    const { action, adminNote } = req.body;
    const validActions = ['dismiss', 'suspend', 'investigate'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ message: `action must be one of: ${validActions.join(', ')}` });
    }

    const report = await ProfileReport.findById(req.params.reportId).populate('reportedUser');
    if (!report) return res.status(404).json({ message: 'Report not found' });

    // Map action → status
    const statusMap = {
      dismiss: 'dismissed',
      suspend: 'suspended',
      investigate: 'investigating',
    };
    report.status = statusMap[action];
    report.adminNote = adminNote || '';
    report.resolvedAt = new Date();
    report.resolvedBy = req.user.id;
    await report.save();

    // If suspending — also mark the reported user as suspended
    if (action === 'suspend') {
      await User.findByIdAndUpdate(report.reportedUser._id, {
        $set: {
          isSuspended: true,
          suspendedAt: new Date(),
          suspensionReason: adminNote || 'Suspended following profile report investigation',
        },
      });
    }

    res.json({ message: `Report marked as ${report.status}`, report });
  } catch (err) {
    console.error('actOnReport error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /api/admin/reports
 * (Public-ish) Any authenticated user can submit a profile report.
 * Body: { reportedUser: userId, reason, details? }
 */
exports.submitProfileReport = async (req, res) => {
  try {
    const { reportedUser, reason, details } = req.body;

    if (!reportedUser || !reason) {
      return res.status(400).json({ message: 'reportedUser and reason are required' });
    }

    // Prevent self-reporting
    if (reportedUser === req.user.id) {
      return res.status(400).json({ message: 'You cannot report yourself' });
    }

    const targetUser = await User.findById(reportedUser).select('_id');
    if (!targetUser) return res.status(404).json({ message: 'Target user not found' });

    const report = new ProfileReport({
      reportedBy: req.user.id,
      reportedUser,
      reason,
      details: details || '',
    });
    await report.save();

    res.status(201).json({ message: 'Report submitted successfully', reportId: report._id });
  } catch (err) {
    console.error('submitProfileReport error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// 6. GENERAL USER MANAGEMENT (admin helpers)
// ─────────────────────────────────────────────

/**
 * GET /api/admin/users
 * List all users with optional filter.
 * Query: ?role=Student|Mentor|Organizer|Admin&suspended=true&page=1&limit=20
 */
exports.getUsers = async (req, res) => {
  try {
    const { role, suspended, page = 1, limit = 20 } = req.query;
    const query = {};
    if (role) query.role = role;
    if (suspended !== undefined) query.isSuspended = suspended === 'true';

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(query),
    ]);

    res.json({ users, total, page: Number(page) });
  } catch (err) {
    console.error('getUsers error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PATCH /api/admin/users/:userId/suspend
 * Suspend or unsuspend a user.
 * Body: { suspend: boolean, reason?: string }
 */
exports.toggleUserSuspension = async (req, res) => {
  try {
    const { suspend, reason } = req.body;
    if (typeof suspend !== 'boolean') {
      return res.status(400).json({ message: '"suspend" field (boolean) is required' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent admin from suspending themselves or another admin
    if (user.role === 'Admin') {
      return res.status(403).json({ message: 'Cannot suspend an Admin account' });
    }

    user.isSuspended = suspend;
    user.suspendedAt = suspend ? new Date() : null;
    user.suspensionReason = suspend ? (reason || 'Suspended by admin') : '';
    await user.save();

    const result = user.toObject();
    delete result.password;
    res.json({
      message: suspend ? 'User suspended' : 'User unsuspended',
      user: result,
    });
  } catch (err) {
    console.error('toggleUserSuspension error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
