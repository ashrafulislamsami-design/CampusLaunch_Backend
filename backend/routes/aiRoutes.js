const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

// @route   POST /api/ai/validate
// @desc    Validate startup idea using AI
// @access  Private
router.post('/validate', auth, checkRole('Student'), aiController.validateIdea);

// @route   GET /api/ai/reports/:id
// @desc    Retrieve saved AI report details
// @access  Private
router.get('/reports/:id', auth, aiController.getReportById);

// @route   GET /api/ai/reports/team/:teamId
// @desc    Retrieve all AI reports for a specific team
router.get('/reports/team/:teamId', auth, aiController.getTeamReports);

module.exports = router;