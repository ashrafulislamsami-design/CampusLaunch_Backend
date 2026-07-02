require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const { sendFundingDeadlineAlerts } = require('./controllers/fundingController');
const { sendPitchDeadlineAlerts } = require('./controllers/pitchNotificationController');
const { sendMentorSessionReminders } = require('./controllers/mentorNotificationController');

const app = express();

// Trust reverse proxy (Render load balancers) to get the actual client IP for rate limiting
app.set('trust proxy', 1);

// Rate Limiting Integration (Redis with Local Memory Fallback)
const rateLimit = require('express-rate-limit');
let rateLimitStore;

if (process.env.REDIS_URL) {
  try {
    const { RedisStore } = require('rate-limit-redis');
    const { createClient } = require('redis');
    const redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.connect().then(() => {
      console.log('Redis rate-limiting store connected successfully.');
    }).catch((err) => {
      console.error('Redis client connection failed, falling back to local memory store:', err.message);
    });
    rateLimitStore = new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
    });
  } catch (err) {
    console.error('Failed to initialize Redis client, falling back to memory store:', err.message);
  }
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: rateLimitStore,
  message: {
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV === 'test' ? 100 : 5, // Strictly cap auth/login/register attempts at 5 per 15 minutes per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: rateLimitStore,
  message: {
    message: 'Too many authentication attempts, please try again after 15 minutes.'
  }
});

// Apply rate limiter to all API routes under /api
app.use('/api', apiLimiter);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50kb' }));

// Handle malformed JSON body parse errors gracefully
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Malformed JSON payload' });
  }
  next(err);
});

// Input validation and sanitization middleware (NoSQL/XSS/SSTI protection)
const sanitize = require('./middleware/sanitize');
app.use(sanitize);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ message: 'Backend is running correctly and connected!' });
});

// Profile Routes (Student Entrepreneur Profiles)
const profileRoutes = require('./routes/profileRoutes');
app.use('/api/profiles', profileRoutes);

// Mentor Routes
const mentorRoutes = require('./routes/mentorRoutes');
app.use('/api/mentors', mentorRoutes);

// Booking Routes
const bookingRoutes = require('./routes/bookingRoutes');
app.use('/api/bookings', bookingRoutes);

// Auth Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authLimiter, authRoutes);

// Team Routes
const teamRoutes = require('./routes/teamRoutes');
app.use('/api/teams', teamRoutes);

// Event Routes
const eventRoutes = require('./routes/eventRoutes');
app.use('/api/events', eventRoutes);

// User Routes
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

// Funding Routes
const fundingRoutes = require('./routes/fundingRoutes');
app.use('/api/funding', fundingRoutes);

// Curriculum Routes
const curriculumRoutes = require('./routes/curriculumRoutes');
app.use('/api/curriculum', curriculumRoutes);

// Pitch Arena Routes
const pitchRoutes = require('./routes/pitchRoutes');
app.use('/api/pitch', pitchRoutes);

// Notification Routes
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);

// Message Routes
const messageRoutes = require('./routes/messageRoutes');
app.use('/api/messages', messageRoutes);

// Match Routes
const matchRoutes = require('./routes/matchRoutes');
app.use('/api/match', matchRoutes);

// Connection Routes
const connectionRoutes = require('./routes/connectionRoutes');
app.use('/api/connections', connectionRoutes);

// Private Message Routes
const privateMessageRoutes = require('./routes/privateMessageRoutes');
app.use('/api/private-messages', privateMessageRoutes);

// AI Routes
const aiRoutes = require('./routes/aiRoutes');
app.use('/api/ai', aiRoutes);

// Leaderboard Routes
const leaderboardRoutes = require('./routes/leaderboardRoutes');
app.use('/api/leaderboard', leaderboardRoutes);

// Resource Routes
const resourceRoutes = require('./routes/resourceRoutes');
app.use('/api/resources', resourceRoutes);

// =========================================================================
// Canvas Builder (Business Model Canvas) — additive, namespaced under /canvas
// =========================================================================
const canvasRoutes = require('./routes/canvasRoutes');
app.use('/api/canvas', canvasRoutes);

// =========================================================================
// Automated Email Communication System (Resend) — additive, /api/email
// =========================================================================
const emailRoutes = require('./routes/emailRoutes');
app.use('/api/email', emailRoutes);

// =========================================================================
// Event Discovery & Registration Hub — additive, namespaced /api/hub
// =========================================================================
const eventHubRoutes = require('./routes/eventHubRoutes');
app.use('/api/hub', eventHubRoutes);

// =========================================================================
// Pitch Deck Feedback & Scoring System — additive, /api/decks
// =========================================================================
const deckRoutes = require('./routes/deckRoutes');
app.use('/api/decks', deckRoutes);

// =========================================================================
// Admin Panel & Verification System — /api/admin
// =========================================================================
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

// Connect to MongoDB (with dynamic fallback to MongoMemoryServer if remote connection fails)
const connectDatabase = async () => {
  try {
    console.log('Connecting to remote MongoDB cluster...');
    // Set a lower timeout for remote connection so the fallback triggers quickly
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      enableUtf8Validation: true,
    });
    console.log('MongoDB connected successfully to remote cluster.');
  } catch (err) {
    console.error('MongoDB connection error. Trying to spin up local in-memory MongoDB...', err.message);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();
      console.log('In-memory MongoDB started at:', mongoUri);
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        enableUtf8Validation: true,
      });
      console.log('Connected to local in-memory MongoDB successfully!');
    } catch (memErr) {
      console.error('Failed to start in-memory MongoDB:', memErr.message);
    }
  }

  // Drop old non-sparse firebaseUid index if it exists, so Mongoose can recreate it with sparse: true
  try {
    if (mongoose.connection.db) {
      await mongoose.connection.db.collection('users').dropIndex('firebaseUid_1');
      console.log('Dropped old non-sparse firebaseUid index.');
    }
  } catch (e) {
    // Index might not exist or collection not created yet, which is fine
  }
};
connectDatabase();

const PORT = process.env.PORT || 3001;

// =========================================================================
// Canvas Builder: HTTP server + Socket.io initialization (additive).
// Wraps the express app so Socket.io can attach. The listen call below
// replaces the original app.listen() by necessity (socket.io requires a raw
// http.Server). Everything else is unchanged.
// =========================================================================
const http = require('http');
const { Server: IOServer } = require('socket.io');
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', methods: ['GET', 'POST'] }
});
const initCanvasSocket = require('./sockets/canvasSocket');
initCanvasSocket(io);

// =========================================================================
// Global Error Handler Middleware
// =========================================================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  console.error(err.stack);
  
  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ message: messages.join(', ') });
  }
  
  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID format' });
  }
  
  // Handle MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ message: `${field} already exists` });
  }
  
  res.status(500).json({ message: 'Server Error' });
});

// =========================================================================
// SERVER LISTEN BLOCK (Required for Render)
// =========================================================================
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Run funding watchlist deadline alerts every hour.
cron.schedule('0 * * * *', async () => {
  try {
    await sendFundingDeadlineAlerts();
    await sendPitchDeadlineAlerts();
    await sendMentorSessionReminders();
  } catch (error) {
    console.error('Notification cron error:', error.message);
  }
});

setTimeout(() => {
  sendFundingDeadlineAlerts().catch((error) => {
    console.error('Initial funding alert scan error:', error.message);
  });
  sendPitchDeadlineAlerts().catch((error) => {
    console.error('Initial pitch deadline scan error:', error.message);
  });
  sendMentorSessionReminders().catch((error) => {
    console.error('Initial mentor reminder scan error:', error.message);
  });
}, 15000);

// =========================================================================
// Email Cron Jobs (Automated Email Communication System) — additive block
// =========================================================================
try {
  const { scheduleWeeklyDigest } = require('./jobs/weeklyDigestJob');
  const { scheduleSessionReminders } = require('./jobs/sessionReminderJob');
  const { scheduleFundingReminders } = require('./jobs/fundingReminderJob');
  const { schedulePitchEventReminders } = require('./jobs/pitchEventReminderJob');
  scheduleWeeklyDigest();
  scheduleSessionReminders();
  scheduleFundingReminders();
  schedulePitchEventReminders();
} catch (err) {
  console.error('Failed to schedule email cron jobs:', err.message);
}
