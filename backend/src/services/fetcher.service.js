import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import zlib from 'node:zlib';
import { config } from '../config/index.js';
import { isPublicAddress } from '../utils/ip.js';
import { checkFetchableUrl } from '../utils/url.js';

const USER_AGENT = 'Mozilla/5.0 (compatible; DigitalDarkSpot/1.0; user-initiated research fetch)';

const SUPPORTED_TYPES = ['text/html', 'application/xhtml+xml', 'text/plain', 'application/pdf'];

export class FetchError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    Object.assign(this, extra);
  }
}

// Custom DNS lookup used for every outgoing connection. Because the socket
// connects to exactly the address validated here, DNS-rebinding tricks
// (public IP on check, private IP on connect) are not possible.
function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(new FetchError('dns_failed', `Could not resolve ${hostname}.`));
    const blocked = addresses.find((entry) => !isPublicAddress(entry.address));
    if (blocked || addresses.length === 0) {
      return callback(new FetchError('blocked_address', 'This host resolves to a private or reserved network address.'));
    }
    if (options && options.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
}

function requestOnce(url, deadline) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new FetchError('timeout', 'The page took too long to respond.'));

    const req = lib.request(
      url,
      {
        method: 'GET',
        lookup: safeLookup,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,application/pdf;q=0.8,*/*;q=0.1',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en;q=1, *;q=0.5',
        },
        timeout: remaining,
      },
      (res) => resolve({ req, res }),
    );
    const timer = setTimeout(() => req.destroy(new FetchError('timeout', 'The page took too long to respond.')), remaining);
    req.on('close', () => clearTimeout(timer));
    req.on('timeout', () => req.destroy(new FetchError('timeout', 'The page took too long to respond.')));
    req.on('error', (err) => {
      if (err instanceof FetchError) return reject(err);
      if (err.cause instanceof FetchError) return reject(err.cause);
      const code = err.code === 'ECONNREFUSED' ? 'connection_refused' : 'network_error';
      reject(new FetchError(code, 'The page could not be reached.', { detail: err.code }));
    });
    req.end();
  });
}

function decodeBody(buffer, contentType) {
  const charsetMatch = /charset=([\w-]+)/i.exec(contentType || '');
  let charset = charsetMatch ? charsetMatch[1].toLowerCase() : '';
  if (!charset) {
    const head = buffer.subarray(0, 2048).toString('latin1');
    const meta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head);
    charset = meta ? meta[1].toLowerCase() : 'utf-8';
  }
  try {
    return new TextDecoder(charset, { fatal: false }).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

function readBody(res, maxBytes) {
  return new Promise((resolve, reject) => {
    const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
    let stream = res;
    if (encoding.includes('br')) stream = res.pipe(zlib.createBrotliDecompress());
    else if (encoding.includes('gzip')) stream = res.pipe(zlib.createGunzip());
    else if (encoding.includes('deflate')) stream = res.pipe(zlib.createInflate());

    const chunks = [];
    let size = 0;
    let truncated = false;
    stream.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        truncated = true;
        chunks.push(chunk.subarray(0, Math.max(0, chunk.length - (size - maxBytes))));
        res.destroy();
        stream.destroy?.();
        resolve({ buffer: Buffer.concat(chunks), truncated });
        return;
      }
      chunks.push(chunk);
    });
    stream.on('end', () => resolve({ buffer: Buffer.concat(chunks), truncated }));
    stream.on('error', (err) => {
      if (truncated) return;
      reject(new FetchError('decode_failed', 'The page content could not be decoded.', { detail: err.code }));
    });
    res.on('error', (err) => {
      if (truncated) return;
      reject(err instanceof FetchError ? err : new FetchError('network_error', 'The connection was interrupted.'));
    });
  });
}

/**
 * Retrieves a public web page safely. Every redirect target is re-validated.
 * Resolves to { finalUrl, status, contentType, body, truncated, headers, redirects }.
 */
export async function fetchPublicPage(inputUrl) {
  const { limits } = config;
  const deadline = Date.now() + limits.fetchTimeoutMs;
  let current = inputUrl;
  const redirects = [];

  for (let hop = 0; hop <= limits.maxRedirects; hop += 1) {
    const check = checkFetchableUrl(current.toString(), limits.maxUrlLength);
    if (!check.ok) throw new FetchError('blocked_url', hop === 0 ? check.reason : `Redirect blocked: ${check.reason}`);
    const url = check.url;

    const { res } = await requestOnce(url, deadline);
    const status = res.statusCode || 0;

    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      let next;
      try {
        next = new URL(res.headers.location, url);
      } catch {
        throw new FetchError('bad_redirect', 'The page redirected to an invalid address.');
      }
      redirects.push(next.toString());
      current = next;
      continue;
    }

    if (status === 401 || status === 403) {
      res.resume();
      throw new FetchError('access_denied', `The site refused access (HTTP ${status}). Pages behind logins or bot protection are not retrieved.`, { httpStatus: status });
    }
    if (status === 404 || status === 410) {
      res.resume();
      throw new FetchError('not_found', `The page was not found (HTTP ${status}).`, { httpStatus: status });
    }
    if (status === 429) {
      res.resume();
      throw new FetchError('rate_limited', 'The site is rate limiting requests (HTTP 429). Try again later.', { httpStatus: status });
    }
    if (status < 200 || status >= 300) {
      res.resume();
      throw new FetchError('http_error', `The site responded with HTTP ${status}.`, { httpStatus: status });
    }

    const contentType = String(res.headers['content-type'] || '').toLowerCase();
    const mime = contentType.split(';')[0].trim();
    if (mime && !SUPPORTED_TYPES.includes(mime)) {
      res.resume();
      throw new FetchError('unsupported_type', `Unsupported content type (${mime}). Web pages, plain text and PDF files are supported.`, { httpStatus: status });
    }

    const isPdf = mime === 'application/pdf';
    const { buffer, truncated } = await readBody(res, isPdf ? limits.maxPdfBytes : limits.maxResponseBytes);
    if (isPdf && truncated) {
      throw new FetchError('too_large', `The PDF is larger than ${Math.round(limits.maxPdfBytes / 1048576)} MB.`, { httpStatus: status });
    }
    return {
      finalUrl: url.toString(),
      status,
      contentType: mime || 'text/html',
      buffer: isPdf ? buffer : null,
      body: isPdf ? '' : decodeBody(buffer, contentType),
      truncated,
      lastModified: res.headers['last-modified'] || null,
      redirects,
    };
  }
  throw new FetchError('too_many_redirects', 'The page redirected too many times.');
}
