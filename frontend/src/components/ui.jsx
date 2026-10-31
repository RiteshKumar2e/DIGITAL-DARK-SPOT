import { LogoMark } from './Logo.jsx';

export function Alert({ tone = 'info', title, children, role }) {
  // Errors interrupt (role=alert); other messages are announced politely.
  const ariaRole = role ?? (tone === 'error' ? 'alert' : 'status');
  return (
    <div className={`alert alert-${tone}`} role={ariaRole}>
      {title && <p className="alert-title">{title}</p>}
      {children && <div>{children}</div>}
    </div>
  );
}

export function Tag({ tone, children, plain = false, title }) {
  return (
    <span className={`tag${tone ? ` tag-${tone}` : ''}${plain ? ' tag-plain' : ''}`} title={title}>
      {children}
    </span>
  );
}

export function Spinner({ label }) {
  return (
    <span className="row" role="status">
      <span className="spinner" aria-hidden="true" />
      {label ? <span>{label}</span> : <span className="visually-hidden">Loading</span>}
    </span>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <LogoMark size={40} />
      <h3>{title}</h3>
      {children && <div className="small">{children}</div>}
      {action}
    </div>
  );
}

export function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p className="field-error" id={id}>
      {message}
    </p>
  );
}

export function SkeletonLines({ count = 3 }) {
  return (
    <div className="stack-sm" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="skeleton" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}
