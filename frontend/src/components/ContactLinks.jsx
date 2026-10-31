const CONTACTS = [
  {
    label: 'Email Ritesh Kumar',
    href: 'mailto:riteshkumar90359@gmail.com',
    viewBox: '0 0 24 24',
    icon: (
      <path
        d="M3 5.5h18v13H3z M3.5 6l8.5 7 8.5-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    ),
  },
  {
    label: 'Ritesh Kumar on LinkedIn',
    href: 'https://www.linkedin.com/in/riteshkumar-tech/',
    viewBox: '0 0 24 24',
    icon: (
      <path
        fill="currentColor"
        d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"
      />
    ),
  },
  {
    label: 'Ritesh Kumar on GitHub',
    href: 'https://github.com/RiteshKumar2e',
    viewBox: '0 0 16 16',
    icon: (
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    ),
  },
];

/** Contact icon links for the footer. Each has an accessible name and a tooltip. */
export default function ContactLinks() {
  return (
    <ul className="contact-links" aria-label="Contact">
      {CONTACTS.map(({ label, href, viewBox, icon }) => {
        const external = href.startsWith('http');
        return (
          <li key={href}>
            <a
              href={href}
              title={label}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              <svg viewBox={viewBox} width="18" height="18" aria-hidden="true" focusable="false">
                {icon}
              </svg>
              <span className="visually-hidden">
                {label}
                {external ? ' (opens in a new tab)' : ''}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
