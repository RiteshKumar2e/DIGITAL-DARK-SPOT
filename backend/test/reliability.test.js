import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dds-rel-'));
process.env.DATA_FILE = path.join(dir, 'sessions.json');
process.env.GROQ_API_KEY = '';

const { validateAiOutput } = await import('../src/services/ai.service.js');
const { runEvaluation } = await import('./evaluate.js');

test('corrupted data file is preserved and the store starts empty', async () => {
  await fs.writeFile(process.env.DATA_FILE, '{ this is not json');
  const { loadStore, getSession } = await import('../src/services/store.service.js');
  await loadStore();
  const files = await fs.readdir(dir);
  assert.ok(files.some((f) => f.startsWith('sessions.json.corrupt-')), 'corrupt file kept for inspection');
  assert.equal(getSession('AAAAAAAAAAAAAAAAAAAAAA'), null);
});

test('AI output validation drops unverifiable and malformed content', () => {
  const sourcesById = { s1: { id: 's1', text: 'The last date to apply is 31 December 2026. The amount is Rs. 60,000 per year.' } };
  const contradictionIds = new Set(['con_deadline_1']);

  const empty = validateAiOutput(null, { sourcesById, contradictionIds });
  assert.deepEqual(empty.keyPoints, []);

  const out = validateAiOutput(
    {
      overview: 'Summary.',
      key_points: [
        { statement: 'Deadline is 31 December', source_id: 's1', quote: 'The last date to apply is 31 December 2026.' },
        { statement: 'Invented fact', source_id: 's1', quote: 'Renewal is automatic every year.' },
        { statement: 'Unknown source', source_id: 'nope', quote: 'The amount is Rs. 60,000 per year.' },
        { statement: 'No quote', source_id: 's1' },
      ],
      additional_gaps: [{ topic: 'Renewal', why_it_matters: 'x', next_step: 'Check renewal' }, { topic: '' }],
      contradiction_reviews: [
        { finding_id: 'con_deadline_1', assessment: 'likely_conflict', explanation: 'ok' },
        { finding_id: 'con_made_up', assessment: 'likely_conflict' },
        { finding_id: 'con_deadline_1', assessment: 'definitely_true' },
      ],
    },
    { sourcesById, contradictionIds },
  );
  assert.equal(out.keyPoints.length, 1);
  assert.equal(out.keyPoints[0].quoteVerified, true);
  assert.equal(out.discardedStatements, 3);
  assert.equal(out.additionalGaps.length, 1);
  assert.equal(out.contradictionReviews.length, 1);
});

test('evaluation fixtures: every expected finding, no forbidden finding, valid references', async () => {
  const results = await runEvaluation();
  for (const r of results) {
    assert.deepEqual(r.missed, [], `${r.name}: missed findings`);
    assert.deepEqual(r.falsePositives, [], `${r.name}: false positives`);
    assert.deepEqual(r.referenceErrors, [], `${r.name}: reference errors`);
  }
});

test('rate limiting returns 429 with a JSON message', async () => {
  const { createApp } = await import('../src/app.js');
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/research`;
  let last;
  for (let i = 0; i < 31; i += 1) {
    last = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: `Rate limit check question number ${i}` }) });
  }
  server.close();
  assert.equal(last.status, 429);
  assert.equal((await last.json()).error.code, 'rate_limited');
  await fs.rm(dir, { recursive: true, force: true });
});
