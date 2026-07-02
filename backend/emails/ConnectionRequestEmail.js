const React = require('react');
const { Heading, Text, Button } = require('@react-email/components');
const { EmailLayout, styles, h } = require('./shared/EmailLayout');

function ConnectionRequestEmail({
  recipientName, senderName, senderUniversity,
  senderSkills = [], senderMessage, profileUrl, platformUrl
}) {
  return h(EmailLayout, {
    preview: `${senderName} wants to connect on CampusLaunch`,
    platformUrl
  },
    h(Heading, { as: 'h1', style: styles.h1 },
      `${senderName} wants to connect 🤝`
    ),
    h(Text, { style: styles.text },
      `Hi ${recipientName}, you've received a new co-founder connection request.`
    ),

    h('div', { style: styles.card },
      h(Text, { style: styles.cardTitle }, senderName),
      senderUniversity
        ? h(Text, { style: styles.cardMeta }, senderUniversity)
        : null,
      senderSkills.length > 0
        ? h('div', { style: { marginTop: '8px' } },
            senderSkills.slice(0, 3).map((s, i) =>
              h('span', { key: `skill-${i}`, style: styles.badge }, s)
            )
          )
        : null
    ),

    senderMessage
      ? h('div', { style: styles.quote }, `"${senderMessage}"`)
      : null,

    h(Button, { href: profileUrl, style: styles.button }, 'View Profile & Respond')
  );
}

module.exports = ConnectionRequestEmail;
