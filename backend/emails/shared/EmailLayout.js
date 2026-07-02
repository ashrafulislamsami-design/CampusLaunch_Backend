/**
 * EmailLayout — shared wrapper (brand header + footer) used by all templates.
 *
 * Note on file format:
 *   We use plain `.js` files with React.createElement (aliased as `h`) rather
 *   than `.jsx` so this backend does not require a JSX/Babel build step.
 *   The rendered output is byte-for-byte identical to JSX, and every component
 *   here is still a normal React component that Resend renders server-side.
 */
const React = require('react');
const {
  Html, Head, Body, Container, Heading, Text, Hr, Section, Link
} = require('@react-email/components');

const h = React.createElement;

// ───────── Shared styles ─────────
const styles = {
  body: {
    backgroundColor: '#f4f4f5',
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    margin: 0,
    padding: 0
  },
  container: {
    maxWidth: '600px',
    margin: '40px auto',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  header: {
    backgroundColor: '#16a34a',
    padding: '28px 40px'
  },
  logo: {
    color: '#ffffff',
    fontSize: '22px',
    fontWeight: 700,
    margin: 0
  },
  tagline: {
    color: '#bbf7d0',
    fontSize: '12px',
    margin: '4px 0 0',
    letterSpacing: '1px',
    textTransform: 'uppercase'
  },
  h1: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
    padding: '32px 40px 0',
    margin: 0
  },
  h2: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#111827',
    padding: '24px 40px 0',
    margin: 0
  },
  text: {
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#4b5563',
    padding: '0 40px',
    margin: '16px 0'
  },
  small: {
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#6b7280',
    padding: '0 40px',
    margin: '8px 0'
  },
  button: {
    backgroundColor: '#16a34a',
    color: '#ffffff',
    padding: '14px 28px',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '16px',
    textDecoration: 'none',
    display: 'inline-block',
    margin: '8px 40px 24px'
  },
  buttonSecondary: {
    backgroundColor: '#ffffff',
    color: '#16a34a',
    border: '2px solid #16a34a',
    padding: '12px 26px',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '15px',
    textDecoration: 'none',
    display: 'inline-block',
    margin: '8px 40px 24px'
  },
  hr: {
    borderColor: '#f3f4f6',
    margin: '0 40px'
  },
  footer: {
    fontSize: '12px',
    color: '#9ca3af',
    padding: '20px 40px 28px',
    lineHeight: '1.6'
  },
  card: {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px 20px',
    margin: '12px 40px'
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 6px'
  },
  cardMeta: {
    fontSize: '13px',
    color: '#6b7280',
    margin: 0
  },
  badge: {
    display: 'inline-block',
    backgroundColor: '#dcfce7',
    color: '#166534',
    fontSize: '12px',
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: '999px',
    margin: '2px 4px 2px 0'
  },
  quote: {
    borderLeft: '4px solid #16a34a',
    backgroundColor: '#f0fdf4',
    fontStyle: 'italic',
    color: '#374151',
    padding: '12px 16px',
    margin: '12px 40px',
    fontSize: '15px',
    lineHeight: '1.5'
  }
};

// ───────── Shared building blocks ─────────

function Header() {
  return h(Section, { style: styles.header },
    h(Heading, { as: 'h1', style: styles.logo }, '🚀 CampusLaunch'),
    h(Text, { style: styles.tagline }, 'Launch your startup')
  );
}

function Footer({ platformUrl }) {
  const base = platformUrl || 'http://localhost:5173';
  return h(React.Fragment, null,
    h(Hr, { style: styles.hr }),
    h(Text, { style: styles.footer },
      `© ${new Date().getFullYear()} CampusLaunch · Bangladesh`,
      h('br'),
      'Student-powered startup incubation platform.',
      h('br'),
      h(Link, { href: `${base}/settings/email-preferences`, style: { color: '#16a34a' } },
        'Manage email preferences'
      ),
      ' · ',
      h(Link, { href: `${base}/home`, style: { color: '#16a34a' } }, 'Visit CampusLaunch')
    )
  );
}

function EmailLayout({ preview, children, platformUrl }) {
  return h(Html, { lang: 'en' },
    h(Head, null,
      preview ? h('meta', { name: 'description', content: preview }) : null
    ),
    h(Body, { style: styles.body },
      h(Container, { style: styles.container },
        h(Header),
        children,
        h(Footer, { platformUrl })
      )
    )
  );
}

module.exports = { EmailLayout, styles, h };
