/** Brand mark: a dark spot with two bold brows and a small red dot. */
export function LogoMark({ size = 32, title }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <circle cx="30" cy="34" r="26" fill="#211D1A" />
      <path d="M15 27.5c3.4-2.6 7.6-3.4 11.6-2.2" stroke="#FAF6EE" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M33.4 25.3c4-1.2 8.2-.4 11.6 2.2" stroke="#FAF6EE" strokeWidth="6" strokeLinecap="round" fill="none" />
      <circle cx="52" cy="52" r="9" fill="#C21F2F" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="brand">
      <LogoMark size={30} />
      <span className="brand-name">
        Digital <span>Dark Spot</span>
      </span>
    </span>
  );
}
