const React = require('react');
const { Heading, Text, Button } = require('@react-email/components');
const { EmailLayout, styles, h } = require('./shared/EmailLayout');

const DEFAULT_TIPS = [
  'Open with the problem — make the judges feel it.',
  'Show a crisp demo or mock in under 60 seconds.',
  'Close with a clear, specific ask.'
];

function PitchEventReminderEmail({
  userName, teamName, eventName, eventDate,
  presentationOrder, judgesCount, eventUrl,
  pitchTips, daysUntil, platformUrl
}) {
  const tips = Array.isArray(pitchTips) && pitchTips.length > 0 ? pitchTips : DEFAULT_TIPS;
  return h(EmailLayout, {
    preview: `${daysUntil || 2} days until ${eventName}`,
    platformUrl
  },
    h(Heading, { as: 'h1', style: styles.h1 },
      `${daysUntil || 2} days to go, ${userName} 🚀`
    ),
    h(Text, { style: styles.text },
      `${eventName} is around the corner. Make sure Team ${teamName} is ready.`
    ),

    h('div', { style: styles.card },
      h(Text, { style: styles.cardTitle }, `📅 ${eventDate}`),
      presentationOrder
        ? h(Text, { style: styles.cardMeta }, `Your presentation order: #${presentationOrder}`)
        : null,
      typeof judgesCount === 'number'
        ? h(Text, { style: styles.cardMeta }, `${judgesCount} judges scheduled`)
        : null
    ),

    h(Heading, { as: 'h2', style: styles.h2 }, '🎯 3 things to nail your pitch'),
    h(Text, { style: styles.text },
      ...tips.slice(0, 3).flatMap((tip, i) => [`${i + 1}. ${tip}`, h('br', { key: `br${i}` })])
    ),

    h(Button, { href: eventUrl, style: styles.button }, 'View Event Details')
  );
}

module.exports = PitchEventReminderEmail;
