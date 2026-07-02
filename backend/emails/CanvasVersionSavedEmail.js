const React = require('react');
const { Heading, Text, Button } = require('@react-email/components');
const { EmailLayout, styles, h } = require('./shared/EmailLayout');

function CanvasVersionSavedEmail({
  recipientName, savedByName, teamName, versionNumber,
  versionLabel, canvasUrl, platformUrl
}) {
  return h(EmailLayout, {
    preview: `${savedByName} saved a new version of your Business Model Canvas`,
    platformUrl
  },
    h(Heading, { as: 'h1', style: styles.h1 },
      `🎨 New canvas version saved`
    ),
    h(Text, { style: styles.text },
      `Hi ${recipientName}, ${savedByName} just saved a new version of ` +
      `Team ${teamName}'s Business Model Canvas.`
    ),

    h('div', { style: styles.card },
      h(Text, { style: styles.cardTitle }, `Version #${versionNumber}`),
      versionLabel
        ? h(Text, { style: styles.cardMeta }, versionLabel)
        : h(Text, { style: styles.cardMeta }, 'No label provided')
    ),

    h(Button, { href: canvasUrl, style: styles.button }, 'Open Canvas')
  );
}

module.exports = CanvasVersionSavedEmail;
