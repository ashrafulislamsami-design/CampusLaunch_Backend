const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const canvasCtrl = require('../controllers/canvasController');
const versionCtrl = require('../controllers/canvasVersionController');
const commentCtrl = require('../controllers/canvasCommentController');
const shareCtrl = require('../controllers/canvasShareController');

// Public share route (no auth) — placed first so it isn't shadowed by /:teamId.
router.get('/share/:shareToken', shareCtrl.getPublicCanvas);

// Canvas CRUD
router.get('/team/:teamId', auth, canvasCtrl.getOrCreateCanvas);
router.put('/team/:teamId/section', auth, canvasCtrl.updateSection);
router.post('/team/:teamId/card', auth, canvasCtrl.addCard);
router.put('/team/:teamId/card/:cardId', auth, canvasCtrl.updateCard);
router.delete('/team/:teamId/card/:cardId', auth, canvasCtrl.deleteCard);
router.put('/team/:teamId/section/:key/reorder', auth, canvasCtrl.reorderSection);
router.put('/team/:teamId/section/:key/lock', auth, canvasCtrl.toggleLock);

// Versions
router.get('/team/:teamId/versions', auth, versionCtrl.listVersions);
router.post('/team/:teamId/versions', auth, versionCtrl.createVersion);
router.get('/team/:teamId/versions/:vId', auth, versionCtrl.getVersion);
router.post('/team/:teamId/versions/:vId/restore', auth, versionCtrl.restoreVersion);

// Comments
router.get('/team/:teamId/comments/:section', auth, commentCtrl.listSectionComments);
router.post('/team/:teamId/comments', auth, commentCtrl.addComment);
router.put('/comments/:commentId', auth, commentCtrl.editComment);
router.delete('/comments/:commentId', auth, commentCtrl.deleteComment);

// Sharing
router.post('/team/:teamId/share/enable', auth, shareCtrl.enableShare);
router.post('/team/:teamId/share/disable', auth, shareCtrl.disableShare);

module.exports = router;
