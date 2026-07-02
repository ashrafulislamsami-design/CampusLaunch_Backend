const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');
const auth = require('../middleware/auth');

// Public routes for viewing leaderboards
router.get('/university', leaderboardController.getUniversityRankings);
router.get('/individual', leaderboardController.getIndividualRankings);

// Protected route for ambassador nomination (could be refined with role check like 'Organizer')
router.patch('/ambassador/:id', auth, leaderboardController.nominateAmbassador);

module.exports = router;
