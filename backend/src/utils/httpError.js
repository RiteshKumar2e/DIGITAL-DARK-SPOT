export class HttpError extends Error {
  constructor(status, message, { code = 'error', fields } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const badRequest = (message, fields) =>
  new HttpError(400, message, { code: 'validation_error', fields });

export const notFound = (message = 'Not found') => new HttpError(404, message, { code: 'not_found' });

export const conflict = (message) => new HttpError(409, message, { code: 'conflict' });
