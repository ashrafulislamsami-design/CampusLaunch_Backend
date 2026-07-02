const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const multer   = require('multer');
const path     = require('path');
const ctrl     = require('../controllers/eventHubController');

// Multer — reuse the existing pitchdecks folder for banner images
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/pitchdecks')),
  filename:    (req, file, cb) => cb(null, `event-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Public browse
router.get('/',            ctrl.listEvents);
router.get('/archive',     ctrl.archivedEvents);
router.get('/:id',         ctrl.getEvent);

// Auth required
router.post('/',            auth, upload.single('banner'), ctrl.createEvent);
router.put('/:id',          auth, upload.single('banner'), ctrl.updateEvent);
router.delete('/:id',       auth, ctrl.deleteEvent);

router.post('/:id/rsvp',        auth, ctrl.rsvp);
router.delete('/:id/rsvp',      auth, ctrl.cancelRsvp);
router.get('/my-registrations', auth, ctrl.myRegistrations);
router.get('/my-events',        auth, ctrl.myEvents);

router.get('/:id/registrations',        auth, ctrl.getRegistrations);
router.post('/:id/checkin/:userId',     auth, ctrl.checkIn);
router.post('/:id/archive',            auth, ctrl.archiveEvent);
router.post('/:id/feedback',           auth, ctrl.submitFeedback);

module.exports = router;