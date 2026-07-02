/**
 * emailService.js
 *
 * Core Resend wrapper + all 15 email send functions for the Automated
 * Email Communication System in CampusLaunch.
 *
 * ── Sender identity ──────────────────────────────────────────────────
 * By default we send from `onboarding@resend.dev`, Resend's shared
 * development domain. This works immediately, with zero DNS setup, and
 * is perfect for development, testing, and grading.
 *
 * To switch to a custom domain in production:
 *   1. Go to https://resend.com/domains, add your domain, and follow
 *      the DNS verification (TXT / MX / DKIM records).
 *   2. Once verified, update the backend .env:
 *        EMAIL_FROM=noreply@yourdomain.com
 *        EMAIL_FROM_NAME=CampusLaunch
 *   3. No code changes required — this module reads from env at runtime.
 *
 * ── Design principles ────────────────────────────────────────────────
 *  • Fire-and-forget: every public function swallows its own errors.
 *    The API response path must NEVER wait on email delivery.
 *  • Graceful when unconfigured: if RESEND_API_KEY is missing, sends
 *    are logged to the console and recorded as "skipped" in EmailLog.
 *  • Preference-aware: per-user EmailPreference doc is consulted before
 *    every non-transactional send.
 *  • Observable: every attempt is logged to the EmailLog collection.
 */

const React = require('react');
const { Resend } = require('resend');

const EmailPreference = require('../models/EmailPreference');
const EmailLog = require('../models/EmailLog');

// Email templates
const WelcomeEmail = require('../emails/WelcomeEmail');
const WeeklyDigestEmail = require('../emails/WeeklyDigestEmail');
const SessionBookingStudentEmail = require('../emails/SessionBookingStudentEmail');
const SessionBookingMentorEmail = require('../emails/SessionBookingMentorEmail');
const SessionReminderEmail = require('../emails/SessionReminderEmail');
const SessionFeedbackEmail = require('../emails/SessionFeedbackEmail');
const PitchRegistrationEmail = require('../emails/PitchRegistrationEmail');
const PitchEventReminderEmail = require('../emails/PitchEventReminderEmail');
const PitchResultsEmail = require('../emails/PitchResultsEmail');
const FundingReminderEmail = require('../emails/FundingReminderEmail');
const CurriculumCertificateEmail = require('../emails/CurriculumCertificateEmail');
const WeekUnlockedEmail = require('../emails/WeekUnlockedEmail');
const ConnectionRequestEmail = require('../emails/ConnectionRequestEmail');
const ConnectionAcceptedEmail = require('../emails/ConnectionAcceptedEmail');
const CanvasVersionSavedEmail = require('../emails/CanvasVersionSavedEmail');
const GroqAlertEmail = require('../emails/GroqAlertEmail');


// ────────────────────────────────────────────────────────────────────
// Resend client — initialize lazily and gracefully.
// ────────────────────────────────────────────────────────────────────
let resend = null;
if (process.env.RESEND_API_KEY) {
  try {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log('[emailService] Resend client initialized');
  } catch (err) {
    console.error('[emailService] Failed to initialize Resend:', err.message);
    resend = null;
  }
} else {
  console.warn('⚠️  [emailService] RESEND_API_KEY not set — email service is in log-only mode');
}

const FROM_NAME = process.env.EMAIL_FROM_NAME || 'CampusLaunch';
const FROM_ADDR = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const FROM_FIELD = `${FROM_NAME} <${FROM_ADDR}>`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ────────────────────────────────────────────────────────────────────
// Email type → EmailPreference category key.
//   value `null` means the email is transactional/unconditional.
// ────────────────────────────────────────────────────────────────────
const EMAIL_PREFERENCE_MAP = {
  welcome: null,
  weekly_digest: 'weeklyDigest',
  session_booking_student: 'mentorSessions',
  session_booking_mentor: 'mentorSessions',
  session_reminder: 'mentorSessions',
  session_feedback: 'mentorSessions',
  pitch_registration: 'pitchEvents',
  pitch_reminder: 'pitchEvents',
  pitch_results: 'pitchEvents',
  funding_reminder: 'fundingOpportunities',
  curriculum_certificate: 'curriculumProgress',
  week_unlocked: 'curriculumProgress',
  connection_request: 'coFounderMatches',
  connection_accepted: 'coFounderMatches',
  canvas_version_saved: 'teamCanvasUpdates',
  groq_alert: null
};

const shouldSendEmail = async (userId, emailType) => {
  if (!userId) return true;
  const prefKey = EMAIL_PREFERENCE_MAP[emailType];
  if (!prefKey) return true;

  try {
    const pref = await EmailPreference.findOne({ user: userId });
    if (!pref) return true;
    if (pref.unsubscribedAll) return false;
    const cat = pref.preferences?.[prefKey];
    if (!cat) return true;
    if (cat.enabled === false) return false;
    if (cat.frequency === 'off') return false;
    return true;
  } catch (err) {
    console.error('[emailService] preference check failed:', err.message);
    return true;
  }
};

// ────────────────────────────────────────────────────────────────────
// Core send function (internal). Always resolves — never throws.
// ────────────────────────────────────────────────────────────────────
const _send = async ({
  to, toUserId, subject, emailType, component, props = {}, metadata = {}
}) => {
  const recipientEmail = Array.isArray(to) ? to[0] : to;

  // Gate 1: preferences
  if (toUserId) {
    const allowed = await shouldSendEmail(toUserId, emailType);
    if (!allowed) {
      console.log(`[emailService] Skipped (preference) ${emailType} → ${recipientEmail}`);
      await EmailLog.create({
        recipient: toUserId,
        recipientEmail,
        emailType,
        subject,
        status: 'skipped',
        metadata: { reason: 'user_preference', ...metadata }
      }).catch(() => {});
      return { skipped: true, reason: 'user_preference' };
    }
  }

  // Gate 2: Resend configured?
  if (!resend) {
    console.log(`[emailService] Skipped (no API key) ${emailType} → ${recipientEmail}`);
    await EmailLog.create({
      recipient: toUserId || null,
      recipientEmail,
      emailType,
      subject,
      status: 'skipped',
      metadata: { reason: 'no_api_key', ...metadata }
    }).catch(() => {});
    return { skipped: true, reason: 'no_api_key' };
  }

  try {
    const element = React.createElement(component, {
      ...props,
      platformUrl: props.platformUrl || FRONTEND_URL
    });

    const { data, error } = await resend.emails.send({
      from: FROM_FIELD,
      to: Array.isArray(to) ? to : [to],
      subject,
      react: element
    });

    if (error) throw new Error(error.message || JSON.stringify(error));

    await EmailLog.create({
      recipient: toUserId || null,
      recipientEmail,
      emailType,
      subject,
      status: 'sent',
      resendMessageId: data?.id || null,
      metadata
    }).catch(() => {});

    console.log(`[emailService] Sent ${emailType} → ${recipientEmail} | id=${data?.id}`);
    return { success: true, id: data?.id };

  } catch (error) {
    await EmailLog.create({
      recipient: toUserId || null,
      recipientEmail,
      emailType,
      subject,
      status: 'failed',
      metadata: { error: error.message, ...metadata }
    }).catch(() => {});

    console.error(`[emailService] Failed ${emailType} → ${recipientEmail}: ${error.message}`);
    return { success: false, error: error.message };
  }
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

// ────────────────────────────────────────────────────────────────────
// Public API — one function per email trigger.
// Each accepts the domain objects from existing controllers. Every
// function is safe to call without await (returns a Promise).
// ────────────────────────────────────────────────────────────────────
const emailService = {

  /** 1. Welcome — after user registration */
  sendWelcomeEmail: async (user) => {
    if (!user?.email) return { skipped: true, reason: 'no_email' };
    return _send({
      to: user.email,
      toUserId: user._id,
      subject: `Welcome to CampusLaunch, ${user.name}! 🚀`,
      emailType: 'welcome',
      component: WelcomeEmail,
      props: {
        userName: user.name,
        dashboardUrl: `${FRONTEND_URL}/home`
      },
      metadata: { userId: String(user._id) }
    });
  },

  /** 2. Weekly digest — Monday 9AM Bangladesh time */
  sendWeeklyDigest: async (user, digestData = {}) => {
    if (!user?.email) return { skipped: true, reason: 'no_email' };
    return _send({
      to: user.email,
      toUserId: user._id,
      subject: 'Your CampusLaunch Weekly Update 📊',
      emailType: 'weekly_digest',
      component: WeeklyDigestEmail,
      props: {
        userName: user.name,
        coFounderMatches: digestData.matches || [],
        upcomingEvents: digestData.events || [],
        fundingDeadlines: digestData.funding || [],
        curriculumWeek: digestData.curriculumWeek || null,
        dashboardUrl: `${FRONTEND_URL}/home`
      },
      metadata: { weekOf: new Date().toISOString() }
    });
  },

  /** 3 & 4. Booking confirmation — sends to both student and mentor */
  sendMentorBookingConfirmation: async (booking, student, mentor) => {
    if (!booking || !student || !mentor) return { skipped: true, reason: 'missing_args' };

    const sessionDate = fmtDate(booking.sessionDate);
    const sessionTime = booking.startTime || fmtTime(booking.sessionDate);
    const sessionUrl = `${FRONTEND_URL}/bookings/my`;

    // To student
    const studentResult = await _send({
      to: student.email,
      toUserId: student._id,
      subject: `Session Confirmed: ${mentor.name} on ${sessionDate} 📅`,
      emailType: 'session_booking_student',
      component: SessionBookingStudentEmail,
      props: {
        studentName: student.name,
        mentorName: mentor.name,
        mentorBio: mentor.bio || '',
        sessionDate,
        sessionTime,
        sessionDuration: booking.durationMinutes || 30,
        meetingLink: booking.meetingLink || '',
        sessionUrl
      },
      metadata: { bookingId: String(booking._id) }
    });

    // To mentor (if mentor has a linked user id)
    let mentorResult = { skipped: true, reason: 'no_mentor_email' };
    if (mentor.email) {
      mentorResult = await _send({
        to: mentor.email,
        toUserId: mentor.userId || null,
        subject: `New Session Booked: ${student.name} on ${sessionDate}`,
        emailType: 'session_booking_mentor',
        component: SessionBookingMentorEmail,
        props: {
          mentorName: mentor.name,
          studentName: student.name,
          studentUniversity: student.university || '',
          sessionDate,
          sessionTime,
          sessionTopic: booking.agenda || '',
          studentQuestions: booking.agenda || '',
          meetingLink: booking.meetingLink || '',
          sessionUrl
        },
        metadata: { bookingId: String(booking._id) }
      });
    }

    return { studentResult, mentorResult };
  },

  /** 5 & 6. Session reminder (24h or 1h) */
  sendSessionReminder: async (booking, user, otherParty, hoursUntil) => {
    if (!user?.email || !booking) return { skipped: true, reason: 'missing_args' };
    const isOneHour = hoursUntil <= 1;
    return _send({
      to: user.email,
      toUserId: user._id,
      subject: isOneHour
        ? `Starting in 1 hour: Your session with ${otherParty?.name || 'CampusLaunch'} ⏰`
        : 'Reminder: Your session is tomorrow ⏰',
      emailType: 'session_reminder',
      component: SessionReminderEmail,
      props: {
        recipientName: user.name,
        otherPartyName: otherParty?.name || '',
        otherPartyRole: otherParty?.role || '',
        sessionDate: fmtDate(booking.sessionDate),
        sessionTime: booking.startTime || '',
        meetingLink: booking.meetingLink || '',
        hoursUntil
      },
      metadata: { bookingId: String(booking._id), hoursUntil }
    });
  },

  /** 7. Post-session feedback request */
  sendSessionFeedbackRequest: async (booking, user, otherParty) => {
    if (!user?.email || !booking) return { skipped: true, reason: 'missing_args' };
    return _send({
      to: user.email,
      toUserId: user._id,
      subject: `How was your session${otherParty?.name ? ` with ${otherParty.name}` : ''}? ⭐`,
      emailType: 'session_feedback',
      component: SessionFeedbackEmail,
      props: {
        recipientName: user.name,
        otherPartyName: otherParty?.name || '',
        sessionDate: fmtDate(booking.sessionDate),
        feedbackUrl: `${FRONTEND_URL}/bookings/my`
      },
      metadata: { bookingId: String(booking._id) }
    });
  },

  /** 8. Pitch event registration confirmation */
  sendPitchRegistrationConfirmation: async (event, team, user, registration) => {
    if (!user?.email || !event) return { skipped: true, reason: 'missing_args' };
    return _send({
      to: user.email,
      toUserId: user._id,
      subject: `You're registered for ${event.title}! 🎤`,
      emailType: 'pitch_registration',
      component: PitchRegistrationEmail,
      props: {
        userName: user.name,
        teamName: team?.name || 'your team',
        eventName: event.title,
        eventDate: fmtDate(event.eventDate),
        eventTime: fmtTime(event.eventDate),
        presentationOrder: registration?.presentationOrder || null,
        pitchDeckUploaded: !!(registration?.pitchDeckUrl),
        eventUrl: `${FRONTEND_URL}/pitch-arena/event/${event._id}`
      },
      metadata: { eventId: String(event._id), teamId: team?._id ? String(team._id) : null }
    });
  },

  /** 9. Pitch event reminder (e.g. 48h before) */
  sendPitchEventReminder: async (event, team, user, daysUntil = 2) => {
    if (!user?.email || !event) return { skipped: true, reason: 'missing_args' };
    return _send({
      to: user.email,
      toUserId: user._id,
      subject: `${daysUntil} day${daysUntil === 1 ? '' : 's'} until ${event.title} — Are you ready? 🚀`,
      emailType: 'pitch_reminder',
      component: PitchEventReminderEmail,
      props: {
        userName: user.name,
        teamName: team?.name || 'your team',
        eventName: event.title,
        eventDate: fmtDate(event.eventDate),
        daysUntil,
        judgesCount: Array.isArray(event.judges) ? event.judges.length : 0,
        eventUrl: `${FRONTEND_URL}/pitch-arena/event/${event._id}`
      },
      metadata: { eventId: String(event._id), daysUntil }
    });
  },

  /** 10. Pitch event results */
  sendPitchResults: async (event, team, result, user) => {
    if (!user?.email || !event) return { skipped: true, reason: 'missing_args' };
    return _send({
      to: user.email,
      toUserId: user._id,
      subject: `Results are in for ${event.title} 🏆`,
      emailType: 'pitch_results',
      component: PitchResultsEmail,
      props: {
        userName: user.name,
        teamName: team?.name || 'your team',
        eventName: event.title,
        teamRank: result?.rank || null,
        totalTeams: result?.totalTeams || null,
        scores: result?.scores || {},
        badgeEarned: result?.badge || null,
        prizeAmount: result?.prizeAmount || null,
        resultsUrl: `${FRONTEND_URL}/pitch-arena/event/${event._id}/results`
      },
      metadata: { eventId: String(event._id), teamId: team?._id ? String(team._id) : null }
    });
  },

  /** 11. Funding deadline reminder (7 or 3 days) */
  sendFundingDeadlineReminder: async (funding, user, daysUntil) => {
    if (!user?.email || !funding) return { skipped: true, reason: 'missing_args' };
    return _send({
      to: user.email,
      toUserId: user._id,
      subject: `⚡ ${daysUntil} day${daysUntil === 1 ? '' : 's'} left: ${funding.title} deadline`,
      emailType: 'funding_reminder',
      component: FundingReminderEmail,
      props: {
        userName: user.name,
        fundingName: funding.title,
        fundingAmount: funding.amount || '',
        deadline: fmtDate(funding.deadline),
        daysUntil,
        applyUrl: funding.applyLink || '',
        fundingUrl: `${FRONTEND_URL}/funding`
      },
      metadata: { fundingId: String(funding._id), daysUntil }
    });
  },

  /** 12. Curriculum certificate (all 12 weeks completed) */
  sendCurriculumCertificate: async (user) => {
    if (!user?.email) return { skipped: true, reason: 'no_email' };
    return _send({
      to: user.email,
      toUserId: user._id,
      subject: "🎓 Congratulations! You've completed the Startup Curriculum",
      emailType: 'curriculum_certificate',
      component: CurriculumCertificateEmail,
      props: {
        userName: user.name,
        completionDate: new Date().toLocaleDateString(),
        certificateUrl: `${FRONTEND_URL}/curriculum/certificate`
      },
      metadata: { userId: String(user._id) }
    });
  },

  /** 13. New curriculum week unlocked */
  sendWeekUnlocked: async (user, weekNumber, weekTitle, weekDescription = '') => {
    if (!user?.email) return { skipped: true, reason: 'no_email' };
    return _send({
      to: user.email,
      toUserId: user._id,
      subject: `Week ${weekNumber} is now available: ${weekTitle} 📚`,
      emailType: 'week_unlocked',
      component: WeekUnlockedEmail,
      props: {
        userName: user.name,
        weekNumber,
        weekTitle,
        weekDescription,
        weekUrl: `${FRONTEND_URL}/curriculum/week/${weekNumber}`
      },
      metadata: { weekNumber }
    });
  },

  /** 14. Co-founder connection request */
  sendConnectionRequest: async (sender, recipient, message = '') => {
    if (!recipient?.email || !sender) return { skipped: true, reason: 'missing_args' };
    return _send({
      to: recipient.email,
      toUserId: recipient._id,
      subject: `${sender.name} wants to connect on CampusLaunch 🤝`,
      emailType: 'connection_request',
      component: ConnectionRequestEmail,
      props: {
        recipientName: recipient.name,
        senderName: sender.name,
        senderUniversity: sender.university || '',
        senderSkills: Array.isArray(sender.skills) ? sender.skills.slice(0, 3) : [],
        senderMessage: message,
        profileUrl: `${FRONTEND_URL}/requests`
      },
      metadata: {
        senderId: String(sender._id),
        recipientId: String(recipient._id)
      }
    });
  },

  /** 15. Co-founder connection accepted */
  sendConnectionAccepted: async (accepter, requester) => {
    if (!requester?.email || !accepter) return { skipped: true, reason: 'missing_args' };
    return _send({
      to: requester.email,
      toUserId: requester._id,
      subject: `${accepter.name} accepted your connection! 🎉`,
      emailType: 'connection_accepted',
      component: ConnectionAcceptedEmail,
      props: {
        recipientName: requester.name,
        accepterName: accepter.name,
        accepterUniversity: accepter.university || '',
        chatUrl: `${FRONTEND_URL}/connections`,
        profileUrl: `${FRONTEND_URL}/startup/${accepter._id}`
      },
      metadata: {
        accepterId: String(accepter._id),
        requesterId: String(requester._id)
      }
    });
  },

  /** 16 (bonus). Canvas version saved — owned canvas feature */
  sendCanvasVersionSaved: async (recipient, savedBy, team, version) => {
    if (!recipient?.email) return { skipped: true, reason: 'no_email' };
    return _send({
      to: recipient.email,
      toUserId: recipient._id,
      subject: `🎨 ${savedBy?.name || 'A teammate'} saved a new canvas version`,
      emailType: 'canvas_version_saved',
      component: CanvasVersionSavedEmail,
      props: {
        recipientName: recipient.name,
        savedByName: savedBy?.name || 'A teammate',
        teamName: team?.name || 'your team',
        versionNumber: version?.versionNumber || 0,
        versionLabel: version?.label || '',
        canvasUrl: `${FRONTEND_URL}/canvas/${team?._id || ''}`
      },
      metadata: {
        teamId: team?._id ? String(team._id) : null,
        versionId: version?._id ? String(version._id) : null
      }
    });
  },

  /** 17. Groq API Alert — sends to the admin */
  sendGroqAlert: async (errorMsg, modelName) => {
    const adminEmail = 'ashraful.islam.sami@g.bracu.ac.bd';
    return _send({
      to: adminEmail,
      subject: `🚨 Groq API Failure: ${modelName || 'Unknown Model'}`,
      emailType: 'groq_alert',
      component: GroqAlertEmail,
      props: {
        error: errorMsg,
        model: modelName
      },
      metadata: { error: errorMsg, model: modelName }
    });
  },

  // Expose internal helpers for tests and cron jobs
  _internal: {
    EMAIL_PREFERENCE_MAP,
    shouldSendEmail,
    isConfigured: () => !!resend
  }
};

module.exports = emailService;
