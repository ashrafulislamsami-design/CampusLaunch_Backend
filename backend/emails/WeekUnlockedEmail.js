const React = require('react');
const { Heading, Text, Button } = require('@react-email/components');
const { EmailLayout, styles, h } = require('./shared/EmailLayout');

function WeekUnlockedEmail({
  userName, weekNumber, weekTitle, weekDescription, weekUrl, platformUrl
}) {
  return h(EmailLayout, {
    preview: `Week ${weekNumber} is now available: ${weekTitle}`,
    platformUrl
  },
    h(Heading, { as: 'h1', style: styles.h1 },
      `📚 Week ${weekNumber} unlocked!`
    ),
    h(Text, { style: styles.text },
      `Great progress, ${userName}. The next chapter is ready for you.`
    ),

    h('div', { style: styles.card },
      h(Text, { style: styles.cardTitle }, `Week ${weekNumber}: ${weekTitle}`),
      weekDescription
        ? h(Text, { style: styles.cardMeta }, weekDescription)
        : h(Text, { style: styles.cardMeta },
            'A new module with a video lesson, quiz, and assignment.')
    ),

    h(Button, { href: weekUrl, style: styles.button }, `Start Week ${weekNumber}`)
  );
}

module.exports = WeekUnlockedEmail;
