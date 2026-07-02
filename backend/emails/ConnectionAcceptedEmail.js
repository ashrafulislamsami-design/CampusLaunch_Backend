const React = require('react');
const { Heading, Text, Button } = require('@react-email/components');
const { EmailLayout, styles, h } = require('./shared/EmailLayout');

function ConnectionAcceptedEmail({
  recipientName, accepterName, accepterUniversity,
  chatUrl, profileUrl, platformUrl
}) {
  return h(EmailLayout, {
    preview: `${accepterName} accepted your connection!`,
    platformUrl
  },
    h(Heading, { as: 'h1', style: styles.h1 },
      `🎉 ${accepterName} accepted your connection!`
    ),
    h(Text, { style: styles.text },
      `Great news, ${recipientName} — you can now message each other directly on CampusLaunch.`
    ),

    h('div', { style: styles.card },
      h(Text, { style: styles.cardTitle }, accepterName),
      accepterUniversity
        ? h(Text, { style: styles.cardMeta }, accepterUniversity)
        : null
    ),

    h(Text, { style: styles.text },
      "Don't forget — great co-founder relationships start with a quick, genuine intro. " +
      "Send a 2-line message about what you're excited to build."
    ),

    chatUrl
      ? h(Button, { href: chatUrl, style: styles.button }, 'Start a Conversation')
      : null,
    profileUrl
      ? h(Button, { href: profileUrl, style: styles.buttonSecondary }, 'View Full Profile')
      : null
  );
}

module.exports = ConnectionAcceptedEmail;
