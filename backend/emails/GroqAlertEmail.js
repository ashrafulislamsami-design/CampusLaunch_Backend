const React = require('react');
const { Heading, Text, Button } = require('@react-email/components');
const { EmailLayout, styles, h } = require('./shared/EmailLayout');

function GroqAlertEmail({ error, model, platformUrl }) {
  return h(EmailLayout, {
    preview: `Groq API Alert: ${error?.substring(0, 50)}...`,
    platformUrl
  },
    h(Heading, { as: 'h1', style: { ...styles.h1, color: '#dc2626' } }, `Groq API Alert 🚨`),
    h(Text, { style: styles.text },
      "An error occurred while calling the Groq API. This might be due to the API key being revoked, rate limits, or the model being deprecated."
    ),
    h(Heading, { as: 'h2', style: styles.h2 }, "Error Details:"),
    h(Text, { style: { ...styles.text, backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px' } },
      error
    ),
    h(Text, { style: styles.text },
      h('strong', null, 'Model used: '), model || 'N/A'
    ),
    h(Text, { style: styles.text },
      "Please check your Groq dashboard and update the environment variables if necessary."
    ),
    h(Button, { href: 'https://console.groq.com/keys', style: styles.button }, 'Groq Dashboard')
  );
}

module.exports = GroqAlertEmail;
