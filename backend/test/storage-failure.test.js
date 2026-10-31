import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// The data file's parent is a regular file, so every write must fail.
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dds-fail-'));
const blocker = path.join(dir, 'not-a-directory');
await fs.writeFile(blocker, 'x');
process.env.DATA_FILE = path.join(blocker, 'sessions.json');
process.env.GROQ_API_KEY = '';

const { saveSession, StorageError } = await import('../src/services/store.service.js');
const { createApp } = await import('../src/app.js');

test('a failed write is reported, not silently ignored', async () => {
  await assert.rejects(saveSession({ id: 'AAAAAAAAAAAAAAAAAAAAAA', createdAt: new Date().toISOString(), sources: [] }), StorageError);
});

test('the API answers 503 with a recoverable message when storage fails', async () => {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Does storage failure surface to the user?' }),
  });
  server.close();
  const body = await res.json();
  assert.equal(res.status, 503);
  assert.equal(body.error.code, 'storage_failed');
  assert.ok(!JSON.stringify(body).includes(dir), 'no file paths in the response');
  await fs.rm(dir, { recursive: true, force: true });
});
