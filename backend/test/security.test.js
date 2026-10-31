import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicAddress } from '../src/utils/ip.js';
import { checkFetchableUrl } from '../src/utils/url.js';

test('blocks private, loopback, link-local and metadata addresses', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '64:ff9b::a9fe:a9fe', '2002:7f00:1::']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
});

test('allows public addresses', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
    assert.equal(isPublicAddress(ip), true, ip);
  }
});

test('rejects unsafe URLs before any request', () => {
  const bad = [
    'ftp://example.org/file',
    'file:///etc/passwd',
    'http://localhost:4000/api',
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data/',
    'http://user:pass@example.org/',
    'http://example.org:8080/',
    'http://intranet/',
    'http://printer.local/',
    'http://2130706433/',
    'http://0x7f000001/',
    'javascript:alert(1)',
  ];
  for (const url of bad) assert.equal(checkFetchableUrl(url).ok, false, url);
});

test('accepts and normalises public URLs', () => {
  const result = checkFetchableUrl('example.org/path#section');
  assert.equal(result.ok, true);
  assert.equal(result.url.toString(), 'https://example.org/path');
  assert.equal(checkFetchableUrl('https://www.gov.example/page?x=1').ok, true);
});
