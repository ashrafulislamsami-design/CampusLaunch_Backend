const React = require('react');
const { Heading, Text, Button } = require('@react-email/components');
const { EmailLayout, styles, h } = require('./shared/EmailLayout');

function FundingReminderEmail({
  userName, fundingName, fundingAmount, deadline,
  daysUntil, applyUrl, fundingUrl, platformUrl
}) {
  const urgencyColor = daysUntil <= 3 ? '#dc2626' : '#ea580c';
  return h(EmailLayout, {
    preview: `${daysUntil} days left: ${fundingName} deadline`,
    platformUrl
  },
    h(Heading, { as: 'h1', style: styles.h1 },
      `⚡ ${daysUntil} day${daysUntil === 1 ? '' : 's'} left to apply, ${userName}`
    ),
    h(Text, { style: styles.text },
      `The deadline for ${fundingName} is approaching. Don't let this opportunity slip.`
    ),

    h('div', { style: styles.card },
      h(Text, { style: styles.cardTitle }, fundingName),
      fundingAmount
        ? h(Text, { style: styles.cardMeta }, `💰 ${fundingAmount}`)
        : null,
      h(Text, { style: styles.cardMeta }, `📅 Deadline: ${deadline}`),
      h(Text, {
        style: {
          fontSize: '13px',
          fontWeight: 700,
          color: urgencyColor,
          margin: '6px 0 0'
        }
      }, `⏳ ${daysUntil} day${daysUntil === 1 ? '' : 's'} remaining`)
    ),

    // Simple urgency bar
    h('div', {
      style: {
        margin: '8px 40px 16px',
        backgroundColor: '#f3f4f6',
        height: '8px',
        borderRadius: '999px',
        overflow: 'hidden'
      }
    },
      h('div', {
        style: {
          width: `${Math.max(5, Math.min(100, (daysUntil / 7) * 100))}%`,
          height: '100%',
          backgroundColor: urgencyColor
        }
      })
    ),

    applyUrl
      ? h(Button, { href: applyUrl, style: styles.button }, 'Apply Now')
      : null,
    h(Button, {
      href: fundingUrl,
      style: applyUrl ? styles.buttonSecondary : styles.button
    }, 'View Details')
  );
}

module.exports = FundingReminderEmail;
