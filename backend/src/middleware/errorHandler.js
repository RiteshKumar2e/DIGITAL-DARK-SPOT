import { HttpError } from '../utils/httpError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: 'This API route does not exist.' } });
}

// Centralised error responses. Internal details are logged, never returned.
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, fields: err.fields } });
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
  console.error(`[error] ${req.method} ${req.path}:`, err?.stack || err);
  return res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong on the server. Please try again.' } });
}
