const React = require('react');
const { Heading, Text, Button } = require('@react-email/components');
const { EmailLayout, styles, h } = require('./shared/EmailLayout');

function PitchRegistrationEmail({
  userName, teamName, eventName, eventDate, eventTime,
  presentationOrder, pitchDeckUploaded, eventUrl, platformUrl
}) {
  return h(EmailLayout, {
    preview: `You're registered for ${eventName}!`,
    platformUrl
  },
    h(Heading, { as: 'h1', style: styles.h1 }, `You're in, ${userName}! 🎤`),
    h(Text, { style: styles.text },
      `Team ${teamName} is officially registered for ${eventName}.`
    ),

    h('div', { style: styles.card },
      h(Text, { style: styles.cardTitle }, `📅 ${eventDate}${eventTime ? ` at ${eventTime}` : ''}`),
      h(Text, { style: styles.cardMeta }, `Team: ${teamName}`),
      presentationOrder
        ? h(Text, { style: styles.cardMeta }, `Presentation order: #${presentationOrder}`)
        : null,
      h(Text, { style: styles.cardMeta },
        pitchDeckUploaded
          ? '✅ Pitch deck uploaded'
          : '⚠️ Pitch deck not uploaded yet — upload before the deadline!'
      )
    ),

    h(Heading, { as: 'h2', style: styles.h2 }, 'What to do next'),
    h(Text, { style: styles.text },
      '1. Finalize your pitch deck (5 slides max)', h('br'),
      '2. Rehearse — aim for 4 minutes, leave 1 for Q&A', h('br'),
      '3. Confirm your team\'s presenter on event day'
    ),

    h(Button, { href: eventUrl, style: styles.button }, 'View Event Details')
  );
}

module.exports = PitchRegistrationEmail;
