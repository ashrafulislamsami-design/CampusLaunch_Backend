const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getAllFunding, toggleWatchlist } = require('../controllers/fundingController');

// All funding routes require auth
router.use(auth);

// @route   GET /api/funding
router.get('/', getAllFunding);

// @route   POST /api/funding/watchlist
router.post('/watchlist', toggleWatchlist);

module.exports = router;
