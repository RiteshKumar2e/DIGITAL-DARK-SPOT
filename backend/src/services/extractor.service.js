import * as cheerio from 'cheerio';
import { cleanText } from '../utils/text.js';
import { normalizeMetaDate } from '../utils/dates.js';

const REMOVE = 'script, style, noscript, template, svg, canvas, iframe, object, embed, form, button, select, nav, aside, [hidden], [aria-hidden="true"]';
const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, td, th, tr, dt, dd, blockquote, pre, section, article, div, br, caption, figcaption, address';

function jsonLdDates($) {
  const found = { published: null, modified: null };
  $('script[type="application/ld+json"]').each((_, el) => {
    let data;
    try {
      data = JSON.parse($(el).contents().text());
    } catch {
      return;
    }
    const stack = [data];
    let guard = 0;
    while (stack.length && guard < 500) {
      guard += 1;
      const node = stack.pop();
      if (Array.isArray(node)) stack.push(...node);
      else if (node && typeof node === 'object') {
        if (!found.published && typeof node.datePublished === 'string') found.published = node.datePublished;
        if (!found.modified && typeof node.dateModified === 'string') found.modified = node.dateModified;
        for (const value of Object.values(node)) if (value && typeof value === 'object') stack.push(value);
      }
    }
  });
  return found;
}

function firstMeta($, selectors) {
  for (const selector of selectors) {
    const value = $(selector).attr('content');
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function pickDate(candidates) {
  for (const [value, origin] of candidates) {
    const iso = normalizeMetaDate(value);
    if (iso) return { value: iso, origin, raw: String(value).slice(0, 80) };
  }
  return null;
}

/**
 * Converts an HTML document into readable text plus metadata.
 * Dates are only reported when the page itself declares them; their origin
 * is kept so the UI can explain where a date came from.
 */
export function extractFromHtml(html, { lastModifiedHeader } = {}) {
  const $ = cheerio.load(html);
  const ld = jsonLdDates($);

  const title = cleanText(
    firstMeta($, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) || $('title').first().text() || $('h1').first().text(),
  ).slice(0, 300);
  const description = cleanText(firstMeta($, ['meta[name="description"]', 'meta[property="og:description"]']) || '').slice(0, 500);
  const lang = ($('html').attr('lang') || '').slice(0, 12);

  const published = pickDate([
    [firstMeta($, ['meta[property="article:published_time"]']), 'Page metadata (article:published_time)'],
    [ld.published, 'Structured data (datePublished)'],
    [firstMeta($, ['meta[name="date"]', 'meta[name="DC.date.issued"]', 'meta[name="dcterms.created"]', 'meta[itemprop="datePublished"]', 'meta[name="publish-date"]']), 'Page metadata (date)'],
    [$('time[datetime]').first().attr('datetime'), 'Page <time> element'],
  ]);
  const modified = pickDate([
    [firstMeta($, ['meta[property="article:modified_time"]', 'meta[property="og:updated_time"]']), 'Page metadata (modified time)'],
    [ld.modified, 'Structured data (dateModified)'],
    [firstMeta($, ['meta[name="last-modified"]', 'meta[name="dcterms.modified"]', 'meta[itemprop="dateModified"]']), 'Page metadata (last-modified)'],
  ]);
  const serverDate = lastModifiedHeader ? pickDate([[lastModifiedHeader, 'Server Last-Modified header (may not reflect content changes)']]) : null;

  $(REMOVE).remove();
  // Prefer the main content region when it carries most of the text.
  let root = $('main').first();
  if (!root.length || root.text().trim().length < 400) root = $('article').first();
  if (!root.length || root.text().trim().length < 400) root = $('body');
  root.find('header, footer').each((_, el) => {
    if ($(el).text().trim().length < 600) $(el).remove();
  });
  root.find(BLOCKS).each((_, el) => {
    $(el).append('\n');
  });

  const text = cleanText(root.text());
  return { title, description, lang, text, published, modified, serverDate };
}

export function extractFromPlainText(body) {
  const text = cleanText(body);
  const firstLine = text.split('\n')[0] || '';
  return { title: firstLine.slice(0, 120), description: '', lang: '', text, published: null, modified: null, serverDate: null };
}
