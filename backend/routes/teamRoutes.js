const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createTeam, getTeam, addMember, removeMember, createTask, updateTaskStatus, deleteTask, getUserTeams, getPublicTeamDetails, getAllTeams, updatePortfolio, updateMemberRole, getCanvas, updateCanvas, updateTeamDetails, addMessage, deleteMessage, addDocument, deleteDocument, acceptInvite } = require('../controllers/teamController');

// Public routes (NO AUTH REQUIRED)
router.get('/public', getAllTeams);
router.get('/public/:id', getPublicTeamDetails);

// All routes below require auth
router.use(auth);

router.post('/', createTeam);
router.get('/user/me', getUserTeams);
router.get('/:id', getTeam);
router.patch('/:id/details', updateTeamDetails);
router.put('/:id/portfolio', updatePortfolio);
router.post('/:id/members', addMember);
router.put('/:id/invites/accept', acceptInvite);
router.delete('/:id/members/:userId', removeMember);
router.put('/:id/members/:userId/role', updateMemberRole);
router.post('/:id/tasks', createTask);
router.put('/:id/tasks/:taskId', updateTaskStatus);
router.delete('/:id/tasks/:taskId', deleteTask);

// Collaboration Routes
router.post('/:id/messages', addMessage);
router.delete('/:id/messages/:msgId', deleteMessage);
router.post('/:id/documents', addDocument);
router.delete('/:id/documents/:docId', deleteDocument);

// Canvas Routes
router.get('/:id/canvas', getCanvas);
router.put('/:id/canvas', updateCanvas);

module.exports = router;
