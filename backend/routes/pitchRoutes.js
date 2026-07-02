const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const eventCtrl = require('../controllers/pitchEventController');
const scoringCtrl = require('../controllers/pitchScoringController');
const voteCtrl = require('../controllers/pitchVoteController');
const resultsCtrl = require('../controllers/pitchResultsController');

// Multer setup for pitch deck uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'pitchdecks'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `deck-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Event management
router.get('/events', eventCtrl.listEvents);
router.get('/events/:eventId', eventCtrl.getEvent);
router.post('/events', auth, eventCtrl.createEvent);
router.put('/events/:eventId', auth, eventCtrl.updateEvent);
// router.delete('/events/:eventId', auth, eventCtrl.deleteEvent); // TODO: Implement deleteEvent
// router.post('/events/:eventId/start', auth, eventCtrl.startEvent); // TODO: Implement startEvent
// router.post('/events/:eventId/next', auth, eventCtrl.nextPresenter); // TODO: Implement nextPresenter
// router.post('/events/:eventId/end', auth, eventCtrl.endEvent); // TODO: Implement endEvent
router.post('/events/:eventId/publish', auth, resultsCtrl.publishResults);

// Registration
router.post('/events/:eventId/register', auth, eventCtrl.registerTeam);
router.get('/events/:eventId/registrations', eventCtrl.getRegistrations);
// router.put('/registrations/:regId/approve', auth, eventCtrl.approveRegistration); // TODO: Implement approveRegistration
// router.put('/registrations/:regId/reject', auth, eventCtrl.rejectRegistration); // TODO: Implement rejectRegistration
router.get('/my-events', auth, eventCtrl.getMyEvents);

// Pitch deck upload
router.post('/upload-deck', auth, upload.single('pitchDeck'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.json({
    url: `/uploads/pitchdecks/${req.file.filename}`,
    originalName: req.file.originalname
  });
});

// Scoring
router.post('/scores', auth, scoringCtrl.submitScore);
router.get('/events/:eventId/scores', auth, scoringCtrl.getEventScores);
router.get('/events/:eventId/leaderboard', scoringCtrl.getLeaderboard);

// Voting
router.post('/votes', auth, voteCtrl.submitVote);
router.get('/events/:eventId/votes', voteCtrl.getVoteCounts);

// Results & Stats
router.get('/events/:eventId/results', resultsCtrl.getResults);
router.get('/events/:eventId/stats', resultsCtrl.getEventStats);

module.exports = router;
