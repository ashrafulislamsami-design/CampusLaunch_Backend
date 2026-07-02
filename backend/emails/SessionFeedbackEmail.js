const React = require('react');
const { Heading, Text, Button } = require('@react-email/components');
const { EmailLayout, styles, h } = require('./shared/EmailLayout');

function SessionFeedbackEmail({
  recipientName, otherPartyName, sessionDate, feedbackUrl, platformUrl
}) {
  return h(EmailLayout, {
    preview: `How was your session${otherPartyName ? ` with ${otherPartyName}` : ''}?`,
    platformUrl
  },
    h(Heading, { as: 'h1', style: styles.h1 }, `Thanks for joining, ${recipientName}!`),
    h(Text, { style: styles.text },
      `Hope your session${otherPartyName ? ` with ${otherPartyName}` : ''}` +
      `${sessionDate ? ` on ${sessionDate}` : ''} was valuable. ` +
      'Your feedback helps the CampusLaunch community keep improving.'
    ),

    h(Text, { style: Object.assign({}, styles.text, { textAlign: 'center', fontSize: '40px', margin: '20px 0' }) },
      '⭐ ⭐ ⭐ ⭐ ⭐'
    ),

    h(Text, { style: styles.small },
      'It only takes 30 seconds — rate the session and leave a short note.'
    ),

    h(Button, { href: feedbackUrl, style: styles.button }, 'Leave Feedback')
  );
}

module.exports = SessionFeedbackEmail;
