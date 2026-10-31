const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'error', fields = null } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** JSON request helper. All network access to the backend goes through here. */
export async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/api${path}`, {
      method,
      signal,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach the Digital Dark Spot server. Check your connection, or try again in a moment.', {
      code: 'network_error',
    });
  }

  if (response.status === 204) return null;

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON responses are handled below.
  }

  if (!response.ok) {
    const err = data?.error;
    throw new ApiError(err?.message || `The server responded with an error (${response.status}).`, {
      status: response.status,
      code: err?.code || 'http_error',
      fields: err?.fields || null,
    });
  }
  if (data === null) throw new ApiError('The server sent an unexpected response.', { status: response.status, code: 'bad_response' });
  return data;
}
