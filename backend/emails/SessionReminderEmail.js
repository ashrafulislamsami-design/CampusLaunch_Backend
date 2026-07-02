const React = require('react');
const { Heading, Text, Button } = require('@react-email/components');
const { EmailLayout, styles, h } = require('./shared/EmailLayout');

function SessionReminderEmail({
  recipientName, otherPartyName, otherPartyRole,
  sessionDate, sessionTime, meetingLink, hoursUntil, platformUrl
}) {
  const isSoon = hoursUntil <= 1;
  return h(EmailLayout, {
    preview: isSoon
      ? `Starting in 1 hour: your session with ${otherPartyName}`
      : `Reminder: your session with ${otherPartyName} is tomorrow`,
    platformUrl
  },
    h(Heading, { as: 'h1', style: styles.h1 },
      isSoon ? '⏰ Starting in 1 hour!' : '⏰ Session tomorrow'
    ),
    h(Text, { style: styles.text },
      `Hi ${recipientName}, a quick reminder that your session with ` +
      `${otherPartyName}${otherPartyRole ? ` (${otherPartyRole})` : ''} ` +
      (isSoon ? 'begins in about 1 hour.' : 'is happening tomorrow.')
    ),

    h('div', { style: styles.card },
      h(Text, { style: styles.cardTitle }, `📆 ${sessionDate} at ${sessionTime}`),
      h(Text, { style: styles.cardMeta }, `With: ${otherPartyName}`)
    ),

    h(Heading, { as: 'h2', style: styles.h2 }, '✅ Quick checklist'),
    h(Text, { style: styles.text },
      '• Test your camera & mic', h('br'),
      '• Have your notes ready', h('br'),
      '• Find a quiet, well-lit spot'
    ),

    meetingLink
      ? h(Button, { href: meetingLink, style: styles.button }, 'Join Meeting')
      : null
  );
}

module.exports = SessionReminderEmail;
