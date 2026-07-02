const React = require('react');
const { Heading, Text, Button } = require('@react-email/components');
const { EmailLayout, styles, h } = require('./shared/EmailLayout');

function SessionBookingStudentEmail({
  studentName, mentorName, mentorBio, sessionDate, sessionTime,
  sessionDuration, meetingLink, sessionUrl, platformUrl
}) {
  return h(EmailLayout, {
    preview: `Session confirmed with ${mentorName} on ${sessionDate}`,
    platformUrl
  },
    h(Heading, { as: 'h1', style: styles.h1 }, `Your session is confirmed, ${studentName}! 📅`),
    h(Text, { style: styles.text },
      `You're all set to meet with ${mentorName}. Here are the details:`
    ),

    h('div', { style: styles.card },
      h(Text, { style: styles.cardTitle }, `📆 ${sessionDate} at ${sessionTime}`),
      h(Text, { style: styles.cardMeta }, `Duration: ${sessionDuration || 30} minutes`),
      h(Text, { style: styles.cardMeta }, `Mentor: ${mentorName}`),
      mentorBio ? h(Text, { style: styles.cardMeta }, mentorBio) : null
    ),

    h(Heading, { as: 'h2', style: styles.h2 }, '💡 Preparation Tips'),
    h(Text, { style: styles.text },
      '1. Write down 2–3 specific questions you want to ask', h('br'),
      '2. Share any relevant links (pitch deck, product demo) in advance', h('br'),
      '3. Test your mic & camera 5 minutes before the session'
    ),

    meetingLink
      ? h(Button, { href: meetingLink, style: styles.button }, 'Join Meeting')
      : null,
    h(Button, { href: sessionUrl, style: styles.buttonSecondary }, 'View Session Details')
  );
}

module.exports = SessionBookingStudentEmail;
