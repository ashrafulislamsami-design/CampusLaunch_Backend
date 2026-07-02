const React = require('react');
const { Heading, Text, Button } = require('@react-email/components');
const { EmailLayout, styles, h } = require('./shared/EmailLayout');

function WelcomeEmail({ userName, dashboardUrl, platformUrl }) {
  return h(EmailLayout, {
    preview: `Welcome to CampusLaunch, ${userName}!`,
    platformUrl
  },
    h(Heading, { as: 'h1', style: styles.h1 }, `Welcome, ${userName}! 👋`),
    h(Text, { style: styles.text },
      "You've joined 10,000+ students building startups across Bangladesh. " +
      "CampusLaunch gives you every tool you need — mentors, funding, teammates, " +
      "and a 12-week curriculum — all in one place."
    ),
    h(Heading, { as: 'h2', style: styles.h2 }, "Here's how to get started:"),
    h(Text, { style: styles.text },
      '✅ Complete your profile', h('br'),
      '✅ Find a co-founder match', h('br'),
      '✅ Start the 12-week Startup Curriculum', h('br'),
      '✅ Explore funding opportunities in your field'
    ),
    h(Button, { href: dashboardUrl, style: styles.button }, 'Go to Dashboard')
  );
}

module.exports = WelcomeEmail;
