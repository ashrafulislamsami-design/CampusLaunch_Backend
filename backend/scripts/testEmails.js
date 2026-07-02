/**
 * testEmails.js — send one of each email template to a test recipient.
 *
 * Usage:
 *   node scripts/testEmails.js
 *
 * Requires in .env:
 *   RESEND_API_KEY   Resend key (starts with re_)
 *   TEST_EMAIL_RECIPIENT  The email address to deliver all tests to.
 */

require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run test script in production.');
  process.exit(1);
}

const RECIPIENT = process.env.TEST_EMAIL_RECIPIENT;
if (!RECIPIENT) {
  console.error('Set TEST_EMAIL_RECIPIENT in .env to run the test script.');
  process.exit(1);
}
if (!process.env.RESEND_API_KEY) {
  console.error('Set RESEND_API_KEY in .env to run the test script.');
  process.exit(1);
}

const emailService = require('../services/emailService');

const fakeUser = {
  _id: '000000000000000000000001',
  name: 'Testing McTest',
  email: RECIPIENT,
  university: 'BRAC University',
  skills: ['React', 'Node.js', 'Product Design']
};

const fakePartner = {
  _id: '000000000000000000000002',
  name: 'Riya Rahman',
  email: RECIPIENT,
  university: 'BUET',
  skills: ['Marketing', 'UX Research', 'Sales']
};

const fakeBooking = {
  _id: '000000000000000000000010',
  sessionDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
  startTime: '15:00',
  durationMinutes: 30,
  meetingLink: 'https://meet.google.com/demo-link',
  agenda: 'Discuss go-to-market strategy and founder-market fit.'
};

const fakeMentor = {
  _id: '000000000000000000000011',
  name: 'Dr. Kamal Hossain',
  email: RECIPIENT,
  userId: null,
  bio: '20+ years leading tech startups in Dhaka & Singapore.'
};

const fakeEvent = {
  _id: '000000000000000000000020',
  title: 'CampusLaunch Spring Finals',
  eventDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  judges: [1, 2, 3, 4]
};

const fakeTeam = {
  _id: '000000000000000000000030',
  name: 'EduFlow'
};

const fakeRegistration = {
  _id: '000000000000000000000031',
  presentationOrder: 3,
  pitchDeckUrl: 'https://example.com/deck.pdf'
};

const fakeFunding = {
  _id: '000000000000000000000040',
  title: 'Bangladesh Angels Seed Grant 2026',
  amount: '10 Lakh BDT',
  deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  applyLink: 'https://example.com/apply'
};

const fakeVersion = {
  _id: '000000000000000000000050',
  versionNumber: 7,
  label: 'After customer interviews'
};

const tests = [
  ['1. Welcome', () => emailService.sendWelcomeEmail(fakeUser)],
  ['2. Weekly digest', () => emailService.sendWeeklyDigest(fakeUser, {
    matches: [{ name: 'Ayesha Khan', university: 'NSU', matchPercent: 92 }],
    events: [{ title: 'Pitch Night Dhaka', eventDate: new Date() }],
    funding: [{ title: 'Startup Bangladesh Grant', amount: '5 Lakh BDT', deadline: new Date() }],
    curriculumWeek: 3
  })],
  ['3. Booking (student + mentor)', () => emailService.sendMentorBookingConfirmation(fakeBooking, fakeUser, fakeMentor)],
  ['4. Reminder — 24h', () => emailService.sendSessionReminder(fakeBooking, fakeUser, fakeMentor, 24)],
  ['5. Reminder — 1h', () => emailService.sendSessionReminder(fakeBooking, fakeUser, fakeMentor, 1)],
  ['6. Feedback request', () => emailService.sendSessionFeedbackRequest(fakeBooking, fakeUser, fakeMentor)],
  ['7. Pitch registration', () => emailService.sendPitchRegistrationConfirmation(fakeEvent, fakeTeam, fakeUser, fakeRegistration)],
  ['8. Pitch 2-day reminder', () => emailService.sendPitchEventReminder(fakeEvent, fakeTeam, fakeUser, 2)],
  ['9. Pitch results', () => emailService.sendPitchResults(fakeEvent, fakeTeam, {
    rank: 1,
    totalTeams: 10,
    scores: { problemClarity: 9.1, solutionViability: 8.5, teamStrength: 9.2, marketPotential: 8.9, total: 35.7 },
    badge: '🏆 Pitch Champion',
    prizeAmount: '1 Lakh BDT'
  }, fakeUser)],
  ['10. Funding reminder — 3d', () => emailService.sendFundingDeadlineReminder(fakeFunding, fakeUser, 3)],
  ['11. Curriculum certificate', () => emailService.sendCurriculumCertificate(fakeUser)],
  ['12. Week unlocked', () => emailService.sendWeekUnlocked(fakeUser, 4, 'Customer Discovery', 'Interview 15 potential users and find signal.')],
  ['13. Connection request', () => emailService.sendConnectionRequest(fakePartner, fakeUser, 'Love your profile — want to team up?')],
  ['14. Connection accepted', () => emailService.sendConnectionAccepted(fakePartner, fakeUser)],
  ['15. Canvas version saved', () => emailService.sendCanvasVersionSaved(fakeUser, fakePartner, fakeTeam, fakeVersion)]
];

(async () => {
  console.log(`\nSending ${tests.length} test emails to ${RECIPIENT}...\n`);
  for (const [label, run] of tests) {
    try {
      const result = await run();
      const ok = result?.success !== false && !result?.error;
      const id = result?.id || result?.studentResult?.id || '';
      console.log(`${ok ? '[OK]' : '[FAIL]'} ${label}${id ? ` — id=${id}` : ''}`);
    } catch (err) {
      console.log(`[FAIL] ${label} — ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log('\nDone. Check your Resend dashboard at https://resend.com/emails');
  process.exit(0);
})();
