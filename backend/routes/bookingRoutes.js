const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createBooking,
  getMyBookings,
  getMentorBookings,
  getMentorAvailability,
  cancelBooking,
  submitRating
} = require('../controllers/bookingController');

router.post('/', auth, createBooking);                      // Student: book session
router.get('/my', auth, getMyBookings);                     // Student: my bookings
router.get('/mentor', auth, getMentorBookings);             // Mentor: my sessions
router.get('/availability/:mentorId', getMentorAvailability); // Public: get booked slots
router.put('/:bookingId/cancel', auth, cancelBooking);      // Cancel booking
router.post('/:bookingId/rate', auth, submitRating);        // Submit rating

module.exports = router;