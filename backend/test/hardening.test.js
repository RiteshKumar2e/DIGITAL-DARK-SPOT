import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dds-hard-'));
process.env.DATA_FILE = path.join(dir, 'sessions.json');
process.env.GROQ_API_KEY = '';

const { makePdf } = await import('./helpers.js');
// Fail fast if this file would touch the real data store.
const { config: loadedConfig } = await import('../src/config/index.js');
if (loadedConfig.dataFile !== process.env.DATA_FILE) throw new Error('Test is not isolated: DATA_FILE was read before it was set.');

const { extractPdf, PdfError } = await import('../src/services/pdf.service.js');
const { errorHandler, redactPath } = await import('../src/middleware/errorHandler.js');
const store = await import('../src/services/store.service.js');

const rejectsWith = (promise, code) => assert.rejects(promise, (err) => err instanceof PdfError && err.code === code);

test('damaged, truncated and non-PDF files are rejected with clear errors', async () => {
  await rejectsWith(extractPdf(Buffer.from('%PDF-1.4\n not really a pdf')), 'malformed');
  await rejectsWith(extractPdf(makePdf(['Some text']).subarray(0, 120)), 'malformed');
  await rejectsWith(extractPdf(Buffer.from('<html>not a pdf</html>')), 'not_pdf');
});

test('PDFs over the page limit are refused before text extraction', async () => {
  await rejectsWith(extractPdf(makePdf(Array.from({ length: 201 }, (_, i) => `Page ${i + 1}`))), 'too_many_pages');
});

test('PDF file dates are labelled as file dates, not as publication dates', async () => {
  const out = await extractPdf(makePdf(['Some text on the page']));
  assert.match(out.published.origin, /file creation date/);
  assert.match(out.published.origin, /may differ/);
});

test('session ids never appear in error logs', () => {
  const id = 'AbCdEfGhIjKlMnOpQrStUv';
  assert.equal(redactPath(`/api/research/${id}/sources/src_1`), '/api/research/:id/sources/src_1');

  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.map(String).join(' '));
  try {
    const res = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    errorHandler(new Error('boom'), { method: 'GET', path: `/api/research/${id}` }, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.ok(!JSON.stringify(res.body).includes('boom'), 'internal message is not returned');
  } finally {
    console.error = original;
  }
  assert.ok(logged.length > 0);
  assert.ok(logged.every((line) => !line.includes(id)), 'session id was logged');
});

test('retention purge deletes only sessions older than the retention period', async () => {
  await store.loadStore();
  const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  await store.saveSession({ id: 'OLDOLDOLDOLDOLDOLDOLD1', createdAt: old, sources: [] });
  await store.saveSession({ id: 'NEWNEWNEWNEWNEWNEWNEW1', createdAt: new Date().toISOString(), sources: [] });
  // saveSession stamps updatedAt with "now"; age the old one explicitly.
  store.getSession('OLDOLDOLDOLDOLDOLDOLD1').updatedAt = old;

  const removed = await store.purgeExpired(30);
  assert.equal(removed, 1);
  assert.equal(store.getSession('OLDOLDOLDOLDOLDOLDOLD1'), null);
  assert.ok(store.getSession('NEWNEWNEWNEWNEWNEWNEW1'));
  const onDisk = JSON.parse(await fs.readFile(process.env.DATA_FILE, 'utf8'));
  assert.ok(!onDisk.sessions.some((s) => s.id === 'OLDOLDOLDOLDOLDOLDOLD1'), 'purge is persisted');
  await fs.rm(dir, { recursive: true, force: true });
});
