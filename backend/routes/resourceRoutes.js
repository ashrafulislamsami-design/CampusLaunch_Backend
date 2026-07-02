const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const resourceController = require('../controllers/resourceController');

// Multer setup for resource file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'resources'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `resource-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

router.get('/', resourceController.getResources);
router.get('/:id', resourceController.getResource);
router.get('/:id/download', auth, resourceController.downloadResource);
router.post('/', auth, upload.single('file'), resourceController.createResource);
router.put('/:id', auth, upload.single('file'), resourceController.updateResource);
router.delete('/:id', auth, resourceController.deleteResource);
router.post('/:id/vote', auth, resourceController.voteResource);

module.exports = router;