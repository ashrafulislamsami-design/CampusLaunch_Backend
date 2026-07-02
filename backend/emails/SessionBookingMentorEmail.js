const React = require('react');
const { Heading, Text, Button } = require('@react-email/components');
const { EmailLayout, styles, h } = require('./shared/EmailLayout');

function SessionBookingMentorEmail({
  mentorName, studentName, studentUniversity, sessionDate,
  sessionTime, sessionTopic, studentQuestions, meetingLink,
  sessionUrl, platformUrl
}) {
  return h(EmailLayout, {
    preview: `New session booked: ${studentName} on ${sessionDate}`,
    platformUrl
  },
    h(Heading, { as: 'h1', style: styles.h1 }, `New session booked, ${mentorName}`),
    h(Text, { style: styles.text },
      `A student just booked a session with you. Here's what to know:`
    ),

    h('div', { style: styles.card },
      h(Text, { style: styles.cardTitle }, `👤 ${studentName}`),
      studentUniversity
        ? h(Text, { style: styles.cardMeta }, studentUniversity)
        : null,
      h(Text, { style: styles.cardMeta }, `📆 ${sessionDate} at ${sessionTime}`)
    ),

    sessionTopic
      ? h(React.Fragment, null,
          h(Heading, { as: 'h2', style: styles.h2 }, 'Session Topic'),
          h(Text, { style: styles.text }, sessionTopic)
        )
      : null,

    studentQuestions
      ? h(React.Fragment, null,
          h(Heading, { as: 'h2', style: styles.h2 }, "Student's Pre-written Questions"),
          h('div', { style: styles.quote }, studentQuestions)
        )
      : null,

    meetingLink
      ? h(Button, { href: meetingLink, style: styles.button }, 'Join Meeting')
      : null,
    h(Button, { href: sessionUrl, style: styles.buttonSecondary }, 'View Session Details')
  );
}

module.exports = SessionBookingMentorEmail;
