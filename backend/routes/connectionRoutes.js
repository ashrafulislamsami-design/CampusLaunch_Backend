const express = require('express');
const {
  sendRequest,
  respondToRequest,
  getConnections,
  getPendingRequests,
  getActiveConnections
} = require('../controllers/connectionController');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// POST /api/connections/send - Send a connection request
router.post('/send', sendRequest);

// PATCH /api/connections/respond - Respond to a connection request
router.patch('/respond', respondToRequest);

// GET /api/connections - Get all connections
router.get('/', getConnections);

// GET /api/connections/pending - Get pending requests for current user
router.get('/pending', getPendingRequests);

// GET /api/connections/active - Get accepted connections for current user
router.get('/active', getActiveConnections);

module.exports = router;
