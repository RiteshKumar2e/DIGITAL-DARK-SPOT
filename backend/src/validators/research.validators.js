import { config } from '../config/index.js';
import { PROFILE_KEYS } from '../services/analysis/profiles.js';
import { checkFetchableUrl } from '../utils/url.js';
import { cleanText } from '../utils/text.js';
import { badRequest } from '../utils/httpError.js';

const { limits } = config;

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function requireBody(body) {
  if (!isPlainObject(body)) throw badRequest('Request body must be a JSON object.');
  return body;
}

function validateQuestion(value, fields) {
  if (typeof value !== 'string') {
    fields.question = 'Enter your research question.';
    return '';
  }
  const question = cleanText(value).replace(/\n+/g, ' ');
  if (question.length < limits.minQuestionLength) fields.question = `Describe your question in at least ${limits.minQuestionLength} characters.`;
  else if (question.length > limits.maxQuestionLength) fields.question = `Keep the question under ${limits.maxQuestionLength} characters.`;
  return question;
}

function validateProfile(value, fields) {
  if (value === undefined || value === null || value === '') return 'auto';
  if (value === 'auto' || PROFILE_KEYS.includes(value)) return value;
  fields.profile = 'Choose a valid research type.';
  return 'auto';
}

const CONTEXT_FIELDS = { situation: 'Your situation', location: 'Country or region', period: 'Time period' };

/** Optional research scope. Each field is short free text; empty fields are dropped. */
function validateContext(value, fields) {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) {
    fields.context = 'Scope must be an object.';
    return {};
  }
  const out = {};
  for (const [key, label] of Object.entries(CONTEXT_FIELDS)) {
    if (value[key] === undefined || value[key] === null || value[key] === '') continue;
    if (typeof value[key] !== 'string') {
      fields[key] = `${label} must be text.`;
      continue;
    }
    const cleaned = cleanText(value[key]).replace(/\n+/g, ' ');
    if (cleaned.length > 120) fields[key] = `${label} must be under 120 characters.`;
    else if (cleaned) out[key] = cleaned;
  }
  return out;
}

export function validateCreateSession(rawBody) {
  const body = requireBody(rawBody);
  const fields = {};
  // Honeypot: real users never see or fill this field.
  const isBot = typeof body.website === 'string' && body.website.trim() !== '';
  const question = validateQuestion(body.question, fields);
  const profile = validateProfile(body.profile, fields);
  const context = validateContext(body.context, fields);
  if (Object.keys(fields).length) throw badRequest('Please correct the highlighted fields.', fields);
  return { question, profile, context, isBot };
}

export function validateUpdateSession(rawBody) {
  const body = requireBody(rawBody);
  const fields = {};
  const out = {};
  if ('question' in body) out.question = validateQuestion(body.question, fields);
  if ('profile' in body) out.profile = validateProfile(body.profile, fields);
  if ('context' in body) out.context = validateContext(body.context, fields);
  if (!Object.keys(out).length && !Object.keys(fields).length) throw badRequest('Nothing to update.');
  if (Object.keys(fields).length) throw badRequest('Please correct the highlighted fields.', fields);
  return out;
}

export function validateAddSource(rawBody) {
  const body = requireBody(rawBody);
  const type = body.type ?? 'url';
  if (type === 'url') {
    const check = checkFetchableUrl(body.url, limits.maxUrlLength);
    if (!check.ok) throw badRequest(check.reason, { url: check.reason });
    return { type, url: check.url.toString() };
  }
  if (type === 'text') {
    const fields = {};
    const title = typeof body.title === 'string' ? cleanText(body.title).slice(0, 200) : '';
    const text = typeof body.text === 'string' ? body.text : '';
    if (!title) fields.title = 'Give the pasted text a short title, such as where it came from.';
    if (cleanText(text).length < 80) fields.text = 'Paste at least 80 characters of text.';
    else if (text.length > limits.maxPastedTextLength) fields.text = `Pasted text is limited to ${limits.maxPastedTextLength.toLocaleString('en')} characters.`;
    if (Object.keys(fields).length) throw badRequest('Please correct the highlighted fields.', fields);
    const originUrl = typeof body.originUrl === 'string' && body.originUrl.trim() ? checkFetchableUrl(body.originUrl) : null;
    if (originUrl && !originUrl.ok) throw badRequest('The optional source link is not a valid public URL.', { originUrl: originUrl.reason });
    return { type, title, text, originUrl: originUrl?.url.toString() || null };
  }
  throw badRequest('Source type must be "url" or "text".', { type: 'Unsupported source type.' });
}

export function validateChecklistPatch(rawBody) {
  const body = requireBody(rawBody);
  if (typeof body.done !== 'boolean') throw badRequest('"done" must be true or false.', { done: 'Must be a boolean.' });
  return { done: body.done };
}

export function validateChecklistCreate(rawBody) {
  const body = requireBody(rawBody);
  const text = typeof body.text === 'string' ? cleanText(body.text).replace(/\n+/g, ' ') : '';
  if (text.length < 5) throw badRequest('Describe the item to verify (at least 5 characters).', { text: 'At least 5 characters.' });
  if (text.length > 300) throw badRequest('Keep checklist items under 300 characters.', { text: 'Under 300 characters.' });
  const priority = ['high', 'medium', 'low'].includes(body.priority) ? body.priority : 'medium';
  return { text, priority };
}

export function validatePdfUpload(req) {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw badRequest('Upload a PDF file (Content-Type: application/pdf).', { file: 'No PDF file received.' });
  }
  let fileName = 'document.pdf';
  const header = req.get('X-File-Name');
  if (header) {
    try {
      fileName = decodeURIComponent(header);
    } catch {
      throw badRequest('The file name could not be read.', { file: 'Invalid file name.' });
    }
  }
  fileName = cleanText(fileName).replace(/[\\/:*?"<>|]/g, '_').slice(0, 150);
  if (!/\.pdf$/i.test(fileName)) throw badRequest('Only .pdf files can be uploaded.', { file: 'Only .pdf files can be uploaded.' });
  return { fileName, buffer: req.body };
}

export function validateSearch(rawBody) {
  const body = requireBody(rawBody);
  const query = typeof body.query === 'string' ? cleanText(body.query).replace(/\n+/g, ' ') : '';
  if (query.length < 3) throw badRequest('Enter at least 3 characters to search.', { query: 'At least 3 characters.' });
  if (query.length > 200) throw badRequest('Keep the search under 200 characters.', { query: 'Under 200 characters.' });
  return { query };
}
