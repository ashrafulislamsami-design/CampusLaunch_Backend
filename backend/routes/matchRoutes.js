const express = require('express');
const { 
  generateMatches, 
  createConnection, 
  getConnections, 
  acceptConnection, 
  deleteConnection 
} = require('../controllers/matchController');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// GET /api/match - Generate AI matches
router.get('/', generateMatches);

// POST /api/match/connect - Create connection request
router.post('/connect', createConnection);

// GET /api/match/connections - Get all connections
router.get('/connections', getConnections);

// PATCH /api/match/connections/:id/accept - Accept connection
router.patch('/connections/:id/accept', acceptConnection);

// DELETE /api/match/connections/:id - Delete connection
router.delete('/connections/:id', deleteConnection);

module.exports = router;
