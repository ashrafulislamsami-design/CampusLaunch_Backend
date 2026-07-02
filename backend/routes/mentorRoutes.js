const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  registerMentor, listMentors, getMentor, updateMentor
} = require('../controllers/mentorController');

router.get('/', listMentors);               // Public: browse mentors
router.get('/:mentorId', getMentor);        // Public: view one mentor
router.post('/register', auth, registerMentor);   // Mentor: create profile
router.put('/me', auth, updateMentor);             // Mentor: update profile

module.exports = router;