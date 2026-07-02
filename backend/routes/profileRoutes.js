const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createProfile,
  getMyProfile,
  getProfileByUserId,
  updateProfile,
  deleteProfile,
  browseProfiles
} = require('../controllers/profileController');

// Public route — browse all profiles
router.get('/', browseProfiles);

// Public route — view one profile
router.get('/user/:userId', getProfileByUserId);

// Protected routes
router.get('/me', auth, getMyProfile);
router.post('/', auth, createProfile);
router.put('/', auth, updateProfile);
router.delete('/', auth, deleteProfile);

module.exports = router;