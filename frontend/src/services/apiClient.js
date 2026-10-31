export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'error', fields = null } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/**
 * Request helper. All network access to the backend goes through here.
 * `body` is sent as JSON; `file` is sent as-is with its own content type.
 * `as: 'blob'` returns the response body as a Blob (used for report downloads).
 */
export async function request(path, { method = 'GET', body, file, headers = {}, signal, as = 'json' } = {}) {
  const init = { method, signal, headers: { ...headers } };
  if (file) {
    init.headers['Content-Type'] = file.type || 'application/octet-stream';
    init.body = file;
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, init);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach the Digital Dark Spot server. Check your connection, or try again in a moment.', {
      code: 'network_error',
    });
  }

  if (response.ok && as === 'blob') return response.blob();
  if (response.status === 204) return null;

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON responses are handled below.
  }

  if (!response.ok) {
    const err = data?.error;
    const fallback =
      response.status === 413 ? 'The file or request is too large.' : `The server responded with an error (${response.status}).`;
    throw new ApiError(err?.message || fallback, {
      status: response.status,
      code: err?.code || 'http_error',
      fields: err?.fields || null,
    });
  }
  if (data === null) throw new ApiError('The server sent an unexpected response.', { status: response.status, code: 'bad_response' });
  return data;
}
