const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const curriculumController = require('../controllers/curriculumController');
const progressController = require('../controllers/curriculumProgressController');

router.get('/modules', curriculumController.getAllModules);
router.get('/modules/:weekNumber', curriculumController.getModuleByWeek);

router.post('/modules', auth, curriculumController.createModule);
router.put('/modules/:weekNumber', auth, curriculumController.updateModule);
router.delete('/modules/:weekNumber', auth, curriculumController.deleteModule);

router.get('/progress', auth, progressController.getStudentProgress);
router.post('/progress/video', auth, progressController.markVideoWatched);
router.post('/progress/quiz', auth, progressController.submitQuiz);
router.post('/progress/assignment', auth, progressController.submitAssignment);
router.get('/progress/certificate', auth, progressController.getCertificateEligibility);

module.exports = router;
