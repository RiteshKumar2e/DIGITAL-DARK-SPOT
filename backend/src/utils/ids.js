import crypto from 'node:crypto';

// Session ids are unguessable (128 bits) because possession of the id is the
// only access control for a session.
export const newSessionId = () => crypto.randomBytes(16).toString('base64url');

export const newId = (prefix) => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;

// Stable short hash used to keep checklist completion state across re-analysis.
export const stableKey = (...parts) =>
  crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);

export const isSessionId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{22}$/.test(value);
