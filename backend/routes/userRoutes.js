const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

router.put('/profile', auth, userController.updateProfile);
router.get('/watchlist', auth, userController.getUserWatchlist);
router.get('/matching', auth, userController.getCoFounderMatches);

module.exports = router;
