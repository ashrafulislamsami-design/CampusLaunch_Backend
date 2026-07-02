const React = require('react');
const { Heading, Text, Button } = require('@react-email/components');
const { EmailLayout, styles, h } = require('./shared/EmailLayout');

const scoreRow = (label, value) =>
  h('tr', { key: label },
    h('td', { style: { padding: '8px 12px', color: '#4b5563', fontSize: '14px' } }, label),
    h('td', { style: { padding: '8px 12px', color: '#111827', fontSize: '14px', fontWeight: 600, textAlign: 'right' } },
      value != null ? value : '—'
    )
  );

function PitchResultsEmail({
  userName, teamName, eventName, teamRank, totalTeams,
  scores, badgeEarned, prizeAmount, resultsUrl, platformUrl
}) {
  const sc = scores || {};
  return h(EmailLayout, {
    preview: `Results are in for ${eventName}`,
    platformUrl
  },
    h(Heading, { as: 'h1', style: styles.h1 }, `Results are in for ${eventName} 🏆`),
    h(Text, { style: styles.text },
      `Hi ${userName}, here's how Team ${teamName} did.`
    ),

    h('div', {
      style: Object.assign({}, styles.card, {
        textAlign: 'center',
        backgroundColor: badgeEarned ? '#fef3c7' : '#f9fafb'
      })
    },
      h(Text, {
        style: { fontSize: '48px', margin: 0, lineHeight: '1' }
      }, teamRank === 1 ? '🥇' : teamRank === 2 ? '🥈' : teamRank === 3 ? '🥉' : '🎯'),
      h(Text, {
        style: { fontSize: '20px', fontWeight: 700, color: '#111827', margin: '8px 0 0' }
      }, `Rank #${teamRank || '—'} of ${totalTeams || '—'}`),
      badgeEarned
        ? h(Text, {
            style: { fontSize: '14px', color: '#92400e', margin: '4px 0 0', fontWeight: 600 }
          }, `🎖️ ${badgeEarned}`)
        : null,
      prizeAmount
        ? h(Text, {
            style: { fontSize: '14px', color: '#166534', margin: '4px 0 0', fontWeight: 600 }
          }, `💰 Prize: ${prizeAmount}`)
        : null
    ),

    h(Heading, { as: 'h2', style: styles.h2 }, '📊 Score Breakdown'),
    h('table', {
      style: {
        width: 'calc(100% - 80px)',
        margin: '12px 40px',
        borderCollapse: 'collapse',
        border: '1px solid #e5e7eb',
        borderRadius: '8px'
      }
    },
      h('tbody', null,
        scoreRow('Problem Clarity', sc.problemClarity),
        scoreRow('Solution Viability', sc.solutionViability),
        scoreRow('Team Strength', sc.teamStrength),
        scoreRow('Market Potential', sc.marketPotential),
        scoreRow('Total', sc.total)
      )
    ),

    h(Button, { href: resultsUrl, style: styles.button }, 'View Full Results')
  );
}

module.exports = PitchResultsEmail;
