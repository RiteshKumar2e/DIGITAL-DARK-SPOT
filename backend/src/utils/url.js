import net from 'node:net';
import { isPublicAddress } from './ip.js';

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.intranet', '.lan', '.home.arpa', '.corp'];
const ALLOWED_PORTS = new Set(['', '80', '443']);

/**
 * Validates a user-supplied URL for server-side retrieval.
 * Returns { ok: true, url } with a normalised URL object, or { ok: false, reason }.
 * DNS resolution is checked separately at connection time (see fetcher).
 */
export function checkFetchableUrl(input, maxLength = 2048) {
  if (typeof input !== 'string' || !input.trim()) return { ok: false, reason: 'Enter a URL.' };
  const raw = input.trim();
  if (raw.length > maxLength) return { ok: false, reason: `URL is longer than ${maxLength} characters.` };

  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, reason: 'This does not look like a valid web address.' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'Only http and https links can be retrieved.' };
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'Links containing a username or password are not accepted.' };
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    return { ok: false, reason: 'Only standard web ports (80 and 443) are supported.' };
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return { ok: false, reason: 'The URL has no host name.' };
  if (net.isIP(host)) {
    if (!isPublicAddress(host)) return { ok: false, reason: 'Private, local and reserved network addresses are not allowed.' };
  } else {
    if (host === 'localhost' || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
      return { ok: false, reason: 'Local and internal host names are not allowed.' };
    }
    if (!host.includes('.')) return { ok: false, reason: 'Use a full public domain name, for example example.org.' };
    // Numeric-looking hosts such as "2130706433" or "0x7f.1" are alternate IP spellings.
    if (/^[0-9.]+$/.test(host) || /^0x/i.test(host)) {
      return { ok: false, reason: 'This host name is not allowed.' };
    }
  }

  url.hash = '';
  return { ok: true, url };
}

export function domainOf(urlString) {
  try {
    return new URL(urlString).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
