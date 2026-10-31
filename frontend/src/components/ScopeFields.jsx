import { useId } from 'react';

export const SCOPE_LABELS = { situation: 'Your situation', location: 'Country or region', period: 'Time period' };

const HINTS = {
  situation: 'e.g. second-year engineering student, SC category',
  location: 'e.g. India, Maharashtra',
  period: 'e.g. 2026-27, current application cycle',
};

/**
 * Optional research scope. Only filled fields are used: a year in the time
 * period is checked against the sources, and a place is checked for mentions.
 */
export default function ScopeFields({ value, onChange, open = false }) {
  const baseId = useId();
  const filled = Object.values(value).filter(Boolean).length;
  return (
    <details className="disclosure scope-fields" open={open || filled > 0}>
      <summary>Add scope (optional){filled ? ` · ${filled} set` : ''}</summary>
      <div className="disclosure-body">
        <p className="hint">Only fill in what affects your question. A year here is checked against the sources.</p>
        {Object.entries(SCOPE_LABELS).map(([key, label]) => (
          <div className="field" key={key}>
            <label className="label" htmlFor={`${baseId}-${key}`}>
              {label}
            </label>
            <input
              id={`${baseId}-${key}`}
              className="input"
              type="text"
              maxLength={120}
              placeholder={HINTS[key]}
              value={value[key] || ''}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </details>
  );
}
