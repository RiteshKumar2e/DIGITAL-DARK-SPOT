import { config } from '../config/index.js';
import { fetchPublicPage, FetchError } from './fetcher.service.js';
import { extractFromHtml, extractFromPlainText } from './extractor.service.js';
import { domainOf } from '../utils/url.js';
import { cleanText, truncate } from '../utils/text.js';

const wordCount = (text) => (text.match(/\S+/g) || []).length;
const MIN_USEFUL_WORDS = 40;

function applyExtraction(source, extracted) {
  const { maxStoredTextLength } = config.limits;
  const text = extracted.text || '';
  source.title = extracted.title || source.title || source.domain || 'Untitled source';
  source.description = extracted.description || '';
  source.lang = extracted.lang || '';
  source.published = extracted.published;
  source.modified = extracted.modified;
  source.serverDate = extracted.serverDate;
  source.textTruncated = text.length > maxStoredTextLength || Boolean(source.textTruncated);
  source.text = text.slice(0, maxStoredTextLength);
  source.wordCount = wordCount(source.text);
  source.excerpt = truncate(source.text.replace(/\n+/g, ' '), 320);
}

/** Retrieves a URL source and fills in its content. Mutates and returns the source. */
export async function retrieveUrlSource(source) {
  source.status = 'retrieving';
  source.error = null;
  try {
    const page = await fetchPublicPage(new URL(source.url));
    source.finalUrl = page.finalUrl;
    source.domain = domainOf(page.finalUrl);
    source.httpStatus = page.status;
    source.contentType = page.contentType;
    source.textTruncated = page.truncated;
    source.redirected = page.redirects.length > 0;
    const extracted =
      page.contentType === 'text/plain'
        ? extractFromPlainText(page.body)
        : extractFromHtml(page.body, { lastModifiedHeader: page.lastModified });
    applyExtraction(source, extracted);
    source.retrievedAt = new Date().toISOString();

    if (source.wordCount < MIN_USEFUL_WORDS) {
      source.status = 'failed';
      source.error = {
        code: 'little_content',
        message:
          'Very little readable text was found. The page may load its content with JavaScript or require a login. Try pasting the relevant text instead.',
      };
    } else {
      source.status = 'retrieved';
    }
  } catch (error) {
    source.status = 'failed';
    source.title = source.title || source.domain || 'Unavailable page';
    source.text = '';
    source.wordCount = 0;
    source.error =
      error instanceof FetchError
        ? { code: error.code, message: error.message }
        : { code: 'unexpected', message: 'The page could not be processed.' };
    if (!(error instanceof FetchError)) console.error('[sources] unexpected retrieval error:', error.message);
  }
  return source;
}

export function buildTextSource(source, { title, text }) {
  const cleaned = cleanText(text);
  source.domain = null;
  applyExtraction(source, { ...extractFromPlainText(cleaned), title: cleanText(title) || 'Pasted text' });
  source.retrievedAt = new Date().toISOString();
  source.status = source.wordCount >= 15 ? 'retrieved' : 'failed';
  source.error = source.status === 'failed' ? { code: 'little_content', message: 'The pasted text is too short to analyse (at least 15 words).' } : null;
  return source;
}

/** Public view of a source: the full text is only returned by the source detail endpoint. */
export function publicSource(source, { includeText = false } = {}) {
  const { text, ...rest } = source;
  return includeText ? { ...rest, text } : rest;
}
