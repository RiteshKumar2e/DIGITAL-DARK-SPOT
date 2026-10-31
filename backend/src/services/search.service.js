import { config } from '../config/index.js';
import { checkFetchableUrl, domainOf } from '../utils/url.js';
import { cleanText, truncate } from '../utils/text.js';
import { HttpError } from '../utils/httpError.js';

/**
 * Server-side web search through a licensed search API. Keys never leave the
 * server. Results are search snippets only: they are not evidence until the
 * user adds the page and it is retrieved in full.
 */
const PROVIDERS = {
  tavily: {
    label: 'Tavily',
    key: () => config.search.tavilyKey,
    async search(query, signal) {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.search.tavilyKey}` },
        body: JSON.stringify({ query, max_results: config.search.maxResults, search_depth: 'basic', include_answer: false }),
      });
      const data = await readJson(res);
      return (data.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.content, published: r.published_date || null }));
    },
  },
  serper: {
    label: 'Serper (Google results)',
    key: () => config.search.serperKey,
    async search(query, signal) {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': config.search.serperKey },
        body: JSON.stringify({ q: query, num: config.search.maxResults }),
      });
      const data = await readJson(res);
      return (data.organic || []).map((r) => ({ title: r.title, url: r.link, snippet: r.snippet, published: r.date || null }));
    },
  },
};

async function readJson(res) {
  if (res.status === 401 || res.status === 403) throw new HttpError(502, 'The search provider rejected the configured API key.', { code: 'search_auth' });
  if (res.status === 429) throw new HttpError(503, 'The search provider quota or rate limit was reached. Try again later or add URLs manually.', { code: 'search_rate_limited' });
  if (!res.ok) throw new HttpError(502, `The search provider returned an error (HTTP ${res.status}).`, { code: 'search_failed' });
  try {
    return await res.json();
  } catch {
    throw new HttpError(502, 'The search provider returned an unreadable response.', { code: 'search_failed' });
  }
}

export function activeSearchProvider() {
  const explicit = config.search.provider;
  if (explicit && PROVIDERS[explicit]?.key()) return explicit;
  if (explicit) return null;
  return Object.keys(PROVIDERS).find((name) => PROVIDERS[name].key()) || null;
}

export const searchStatus = () => {
  const name = activeSearchProvider();
  return { configured: Boolean(name), provider: name ? PROVIDERS[name].label : null };
};

const stripTags = (value) => cleanText(String(value || '').replace(/<[^>]*>/g, ''));

function dedupeKey(url) {
  const u = new URL(url);
  return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${u.search}`.toLowerCase();
}

export async function webSearch(query) {
  const name = activeSearchProvider();
  if (!name) {
    throw new HttpError(503, 'Web search is not configured on this server. Add page addresses manually, or ask the operator to set a search API key.', {
      code: 'search_not_configured',
    });
  }
  let raw;
  try {
    raw = await PROVIDERS[name].search(query, AbortSignal.timeout(config.search.timeoutMs));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new HttpError(504, 'The search provider took too long to respond.', { code: 'search_timeout' });
    }
    throw new HttpError(502, 'The search provider could not be reached.', { code: 'search_failed' });
  }

  const seen = new Set();
  const results = [];
  for (const item of raw) {
    const check = checkFetchableUrl(String(item.url || ''));
    if (!check.ok) continue; // never offer unsafe or non-http destinations
    const key = dedupeKey(check.url.toString());
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      title: truncate(stripTags(item.title) || domainOf(check.url.toString()), 200),
      url: check.url.toString(),
      domain: domainOf(check.url.toString()),
      snippet: truncate(stripTags(item.snippet), 320),
      published: typeof item.published === 'string' ? item.published.slice(0, 40) : null,
    });
  }
  return { provider: PROVIDERS[name].label, query, results };
}
