const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const multer  = require('multer');
const path    = require('path');
const ctrl    = require('../controllers/deckController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/pitchdecks')),
  filename:    (req, file, cb) => cb(null, `deck-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
  limits: { fileSize: 20 * 1024 * 1024 }
});

router.get('/',            auth, ctrl.listDecks);
router.get('/my',          auth, ctrl.myDecks);
router.get('/:id',         auth, ctrl.getDeck);
router.get('/:id/reviews', auth, ctrl.getReviews);
router.get('/:id/report',  auth, ctrl.getDeckReport);

router.post('/',               auth, upload.single('pdf'), ctrl.uploadDeck);
router.post('/:id/version',    auth, upload.single('pdf'), ctrl.uploadVersion);
router.post('/:id/reviews',    auth, ctrl.submitReview);
router.delete('/:id',          auth, ctrl.deleteDeck);

module.exports = router;