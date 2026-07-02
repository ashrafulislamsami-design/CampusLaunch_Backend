const React = require('react');
const { Heading, Text, Button, Hr } = require('@react-email/components');
const { EmailLayout, styles, h } = require('./shared/EmailLayout');

const renderCard = (title, meta, key) =>
  h('div', { style: styles.card, key },
    h(Text, { style: styles.cardTitle }, title),
    meta ? h(Text, { style: styles.cardMeta }, meta) : null
  );

function WeeklyDigestEmail({
  userName,
  coFounderMatches = [],
  upcomingEvents = [],
  fundingDeadlines = [],
  curriculumWeek,
  dashboardUrl,
  platformUrl
}) {
  return h(EmailLayout, {
    preview: 'Your CampusLaunch Weekly Update',
    platformUrl
  },
    h(Heading, { as: 'h1', style: styles.h1 }, `Hi ${userName}, here's your week at a glance 📊`),
    h(Text, { style: styles.text },
      "A curated snapshot of what's worth your attention this week."
    ),

    // Co-Founder Matches
    h(Heading, { as: 'h2', style: styles.h2 }, '🤝 New Co-Founder Matches'),
    coFounderMatches.length > 0
      ? coFounderMatches.slice(0, 3).map((m, i) =>
          renderCard(m.name || 'Suggested match', `${m.matchPercent || 0}% match · ${m.university || ''}`, `m${i}`)
        )
      : h(Text, { style: styles.small }, 'No new matches this week — try broadening your skills or interests.'),

    // Upcoming Events
    h(Heading, { as: 'h2', style: styles.h2 }, '🎤 Upcoming Events This Week'),
    upcomingEvents.length > 0
      ? upcomingEvents.slice(0, 3).map((e, i) =>
          renderCard(e.title || 'Event', e.eventDate ? new Date(e.eventDate).toLocaleDateString() : '', `e${i}`)
        )
      : h(Text, { style: styles.small }, 'No events scheduled this week.'),

    // Funding Deadlines
    h(Heading, { as: 'h2', style: styles.h2 }, '⚡ Funding Deadlines Closing Soon'),
    fundingDeadlines.length > 0
      ? fundingDeadlines.slice(0, 3).map((f, i) =>
          renderCard(f.title || 'Funding', `${f.amount || ''} · Deadline ${f.deadline ? new Date(f.deadline).toLocaleDateString() : ''}`, `f${i}`)
        )
      : h(Text, { style: styles.small }, 'No urgent funding deadlines this week.'),

    // Curriculum
    h(Heading, { as: 'h2', style: styles.h2 }, '📚 Continue Your Learning'),
    h(Text, { style: styles.text },
      curriculumWeek
        ? `You're currently on Week ${curriculumWeek}. Keep going — consistency wins.`
        : 'You haven\'t started the curriculum yet. It takes 12 weeks to go from idea to MVP.'
    ),

    h(Button, { href: dashboardUrl, style: styles.button }, 'View Full Dashboard')
  );
}

module.exports = WeeklyDigestEmail;
