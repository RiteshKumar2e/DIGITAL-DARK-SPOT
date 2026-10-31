import { HttpError } from '../utils/httpError.js';
import { StorageError } from '../services/store.service.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: 'This API route does not exist.' } });
}

// Session ids act as access keys (there are no accounts), so they are never written to logs.
export const redactPath = (path) => String(path).replace(/\/research\/[A-Za-z0-9_-]{22}/g, '/research/:id');

// Centralised error responses. Internal details are logged, never returned.
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, fields: err.fields } });
  }
  if (err instanceof StorageError) {
    return res.status(503).json({ error: { code: 'storage_failed', message: err.message } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'payload_too_large', message: 'The request is too large.' } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'invalid_json', message: 'The request body is not valid JSON.' } });
  }
  if (err?.message?.startsWith('CORS')) {
    return res.status(403).json({ error: { code: 'cors', message: 'This origin is not allowed to use the API.' } });
  }
  console.error(`[error] ${req.method} ${redactPath(req.path)}:`, err?.stack || err);
  return res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong on the server. Please try again.' } });
}
