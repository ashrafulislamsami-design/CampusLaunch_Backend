const React = require('react');
const { Heading, Text, Button, Link } = require('@react-email/components');
const { EmailLayout, styles, h } = require('./shared/EmailLayout');

function CurriculumCertificateEmail({
  userName, completionDate, certificateUrl, platformUrl
}) {
  const linkedInShare =
    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(certificateUrl || platformUrl || '')}`;

  return h(EmailLayout, {
    preview: "You've completed the CampusLaunch Startup Curriculum!",
    platformUrl
  },
    h(Heading, { as: 'h1', style: Object.assign({}, styles.h1, { textAlign: 'center', fontSize: '28px' }) },
      '🎓 Congratulations!'
    ),
    h(Text, { style: Object.assign({}, styles.text, { textAlign: 'center' }) },
      `${userName}, you've officially completed all 12 weeks of the ` +
      'CampusLaunch Startup Curriculum. That puts you in the top tier ' +
      'of student founders in Bangladesh.'
    ),

    h('div', {
      style: Object.assign({}, styles.card, {
        textAlign: 'center',
        backgroundColor: '#f0fdf4',
        borderColor: '#16a34a',
        padding: '32px 20px'
      })
    },
      h(Text, { style: { fontSize: '56px', margin: 0, lineHeight: '1' } }, '🏆'),
      h(Text, {
        style: { fontSize: '18px', fontWeight: 700, color: '#111827', margin: '12px 0 4px' }
      }, 'Certificate of Completion'),
      h(Text, {
        style: { fontSize: '14px', color: '#4b5563', margin: 0 }
      }, `Awarded to ${userName}`),
      completionDate
        ? h(Text, {
            style: { fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }
          }, `Completed on ${completionDate}`)
        : null
    ),

    certificateUrl
      ? h(Button, { href: certificateUrl, style: styles.button }, 'Download Your Certificate')
      : null,
    h(Link, {
      href: linkedInShare,
      style: Object.assign({}, styles.buttonSecondary, { textAlign: 'center' })
    }, 'Share on LinkedIn')
  );
}

module.exports = CurriculumCertificateEmail;
