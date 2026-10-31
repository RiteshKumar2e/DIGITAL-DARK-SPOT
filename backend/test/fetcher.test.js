import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { fetchPublicPage, safeLookup, FetchError } from '../src/services/fetcher.service.js';
import { looksLikeInterstitial } from '../src/services/source.service.js';

/** Fake transport: maps a URL to a scripted response, so no network is used. */
function fakeRequest(routes) {
  return async (url) => {
    const route = routes[url.toString()];
    if (!route) throw new Error(`unexpected request to ${url}`);
    const res = Readable.from(route.body ? [Buffer.from(route.body)] : []);
    res.statusCode = route.status;
    res.headers = route.headers || {};
    return { res };
  };
}

const expectFetchError = async (promise, code) => {
  await assert.rejects(promise, (err) => err instanceof FetchError && err.code === code);
};

test('a redirect to a cloud-metadata address is blocked on that hop', async () => {
  const request = fakeRequest({
    'https://example.org/start': { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } },
  });
  await assert.rejects(fetchPublicPage(new URL('https://example.org/start'), { request }), (err) => {
    assert.equal(err.code, 'blocked_url');
    assert.match(err.message, /Redirect blocked/);
    return true;
  });
});

test('redirects to localhost and non-http schemes are blocked', async () => {
  for (const location of ['http://localhost/admin', 'file:///etc/passwd', 'http://10.0.0.5/']) {
    const request = fakeRequest({ 'https://example.org/a': { status: 301, headers: { location } } });
    await expectFetchError(fetchPublicPage(new URL('https://example.org/a'), { request }), 'blocked_url');
  }
});

test('redirect loops stop after the limit', async () => {
  const request = fakeRequest({
    'https://example.org/a': { status: 302, headers: { location: '/b' } },
    'https://example.org/b': { status: 302, headers: { location: '/a' } },
  });
  await expectFetchError(fetchPublicPage(new URL('https://example.org/a'), { request }), 'too_many_redirects');
});

test('HTTP errors and unsupported content types give actionable errors', async () => {
  const cases = [
    [403, {}, 'access_denied'],
    [404, {}, 'not_found'],
    [429, {}, 'rate_limited'],
    [500, {}, 'http_error'],
    [200, { 'content-type': 'image/png' }, 'unsupported_type'],
  ];
  for (const [status, headers, code] of cases) {
    const request = fakeRequest({ 'https://example.org/x': { status, headers, body: 'x' } });
    await expectFetchError(fetchPublicPage(new URL('https://example.org/x'), { request }), code);
  }
});

test('a redirect to a safe page is followed and recorded', async () => {
  const request = fakeRequest({
    'https://example.org/old': { status: 301, headers: { location: 'https://example.org/new' } },
    'https://example.org/new': { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: '<p>Hello</p>' },
  });
  const page = await fetchPublicPage(new URL('https://example.org/old'), { request });
  assert.equal(page.finalUrl, 'https://example.org/new');
  assert.deepEqual(page.redirects, ['https://example.org/new']);
  assert.equal(page.body, '<p>Hello</p>');
});

test('oversized HTML is truncated rather than read without limit; empty bodies are allowed', async () => {
  const big = 'a'.repeat(3 * 1024 * 1024 + 50_000);
  const request = fakeRequest({
    'https://example.org/big': { status: 200, headers: { 'content-type': 'text/html' }, body: big },
    'https://example.org/empty': { status: 200, headers: { 'content-type': 'text/html' } },
  });
  const page = await fetchPublicPage(new URL('https://example.org/big'), { request });
  assert.equal(page.truncated, true);
  assert.ok(page.body.length <= 3 * 1024 * 1024);
  const empty = await fetchPublicPage(new URL('https://example.org/empty'), { request });
  assert.equal(empty.body, '');
});

test('DNS check at connection time rejects names that resolve to loopback', async () => {
  const error = await new Promise((resolve) => safeLookup('localhost', {}, (err) => resolve(err)));
  assert.ok(error instanceof FetchError);
  assert.equal(error.code, 'blocked_address');
});

test('cookie walls, JavaScript notices and bot checks are not treated as content', () => {
  assert.equal(looksLikeInterstitial({ wordCount: 40, text: 'We use cookies to improve your experience. Accept all cookies to continue.' }), true);
  assert.equal(looksLikeInterstitial({ wordCount: 30, text: 'Please enable JavaScript to view this page.' }), true);
  assert.equal(looksLikeInterstitial({ wordCount: 25, text: 'Checking your browser before accessing the site.' }), true);
  // A full article that merely mentions cookies in its footer is real content.
  assert.equal(looksLikeInterstitial({ wordCount: 900, text: 'Long article text… We use cookies.' }), false);
});

test('a slow download reports a timeout, not a decoding error', async () => {
  const { config } = await import('../src/config/index.js');
  const saved = config.limits.fetchTimeoutMs;
  config.limits.fetchTimeoutMs = 150;
  try {
    const request = async () => {
      const res = new Readable({ read() {} }); // never ends
      res.statusCode = 200;
      res.headers = { 'content-type': 'text/html' };
      res.push(Buffer.from('<p>partial'));
      return { res };
    };
    await assert.rejects(fetchPublicPage(new URL('https://example.org/slow'), { request }), (err) => {
      assert.equal(err.code, 'timeout');
      assert.doesNotMatch(err.message, /decode/);
      return true;
    });
  } finally {
    config.limits.fetchTimeoutMs = saved;
  }
});

test('a connection reset during download is reported as an interrupted connection', async () => {
  const request = async () => {
    const res = new Readable({ read() {} });
    res.statusCode = 200;
    res.headers = { 'content-type': 'application/pdf' };
    setTimeout(() => res.destroy(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })), 20);
    return { res };
  };
  await assert.rejects(fetchPublicPage(new URL('https://example.org/doc.pdf'), { request }), (err) => {
    assert.equal(err.code, 'network_error');
    assert.match(err.message, /interrupted/);
    return true;
  });
});
