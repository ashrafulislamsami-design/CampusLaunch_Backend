const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const adminController = require('../controllers/adminController');

// All routes below require a valid JWT + Admin role.
// auth populates req.user; isAdmin enforces role === 'Admin'.
const guard = [auth, isAdmin];

// ── Platform Stats ────────────────────────────────────────────────────────
router.get('/stats', guard, adminController.getPlatformStats);

// ── Mentor Verification ───────────────────────────────────────────────────
router.get('/mentors/pending', guard, adminController.getPendingMentors);
router.get('/mentors', guard, adminController.getAllMentors);
router.patch('/mentors/:mentorId/verify', guard, adminController.verifyMentor);

// ── Organizer Verification ────────────────────────────────────────────────
router.get('/organizers', guard, adminController.getOrganizers);
router.patch('/organizers/:userId/verify', guard, adminController.verifyOrganizer);

// ── Featured Content ──────────────────────────────────────────────────────
router.get('/featured', guard, adminController.getFeaturedContent);
router.post('/featured', guard, adminController.addFeaturedContent);
router.patch('/featured/:id', guard, adminController.updateFeaturedContent);
router.delete('/featured/:id', guard, adminController.deleteFeaturedContent);

// ── Profile Reports ───────────────────────────────────────────────────────
// Users can submit reports (auth only, no admin required)
router.post('/reports', auth, adminController.submitProfileReport);
// Admin-only: view and act on reports
router.get('/reports', guard, adminController.getProfileReports);
router.patch('/reports/:reportId/action', guard, adminController.actOnReport);

// ── User Management ───────────────────────────────────────────────────────
router.get('/users', guard, adminController.getUsers);
router.patch('/users/:userId/suspend', guard, adminController.toggleUserSuspension);

module.exports = router;
