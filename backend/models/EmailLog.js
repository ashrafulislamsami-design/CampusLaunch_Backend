const mongoose = require('mongoose');

const EMAIL_TYPES = [
  'welcome',
  'weekly_digest',
  'session_booking_student',
  'session_booking_mentor',
  'session_reminder',
  'session_feedback',
  'pitch_registration',
  'pitch_reminder',
  'pitch_results',
  'funding_reminder',
  'curriculum_certificate',
  'week_unlocked',
  'connection_request',
  'connection_accepted',
  'canvas_version_saved'
];

const emailLogSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  recipientEmail: { type: String, required: true },
  emailType: { type: String, enum: EMAIL_TYPES, required: true },
  subject: { type: String, default: '' },
  status: { type: String, enum: ['sent', 'failed', 'skipped'], default: 'sent' },
  resendMessageId: { type: String, default: null },
  sentAt: { type: Date, default: Date.now },
  metadata: { type: Object, default: {} }
});

emailLogSchema.index({ recipient: 1, sentAt: -1 });
emailLogSchema.index({ emailType: 1, sentAt: -1 });

emailLogSchema.statics.EMAIL_TYPES = EMAIL_TYPES;

module.exports = mongoose.model('EmailLog', emailLogSchema);
