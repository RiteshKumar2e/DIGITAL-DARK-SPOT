import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dds-rel-'));
process.env.DATA_FILE = path.join(dir, 'sessions.json');
process.env.GROQ_API_KEY = '';

// Fail fast if this file would touch the real data store.
const { config: loadedConfig } = await import('../src/config/index.js');
if (loadedConfig.dataFile !== process.env.DATA_FILE) throw new Error('Test is not isolated: DATA_FILE was read before it was set.');

const { validateAiAnalysis } = await import('../src/services/ai.service.js');
const { runEvaluation } = await import('./evaluate.js');

test('corrupted data file is preserved and the store starts empty', async () => {
  await fs.writeFile(process.env.DATA_FILE, '{ this is not json');
  const { loadStore, getSession } = await import('../src/services/store.service.js');
  await loadStore();
  const files = await fs.readdir(dir);
  assert.ok(files.some((f) => f.startsWith('sessions.json.corrupt-')), 'corrupt file kept for inspection');
  assert.equal(getSession('AAAAAAAAAAAAAAAAAAAAAA'), null);
});

const PROFILE = { label: 'Scholarship', facets: [{ key: 'deadline', importance: 'critical', why: 'w', check: 'c' }, { key: 'renewal', importance: 'important', why: 'w', check: 'c' }] };
const SOURCES = [
  { id: 's1', text: 'The last date to apply is 31 December 2026. The amount is Rs. 60,000 per year.' },
  { id: 's2', text: 'Apply before 15 December 2026, so finish early.' },
];
const validate = (raw) => validateAiAnalysis(raw, { sources: SOURCES, profile: PROFILE, claims: [], scope: { level: 'moderate' } });

test('AI output validation drops unverifiable and malformed content', () => {
  assert.equal(validate(null).ok, false);
  assert.equal(validate({ key_points: [] }).ok, false, 'missing gaps/contradictions arrays is malformed');

  const out = validate({
    overview: 'Summary.',
    key_points: [
      { statement: 'Deadline is 31 December', source_id: 's1', quote: 'The last date to apply is 31 December 2026.' },
      { statement: 'Invented fact', source_id: 's1', quote: 'Renewal is automatic every year.' },
      { statement: 'Unknown source', source_id: 'nope', quote: 'The amount is Rs. 60,000 per year.' },
      { statement: 'No quote', source_id: 's1' },
    ],
    gaps: [
      { topic_key: 'renewal', kind: 'missing', evidence: [] },
      { topic_key: 'deadline', kind: 'unspecified', evidence: [{ source_id: 's1', quote: 'Deadline to be announced later.' }] },
      { topic_key: 'renewal', kind: 'made_up_kind' },
    ],
    contradictions: [
      { topic_key: 'deadline', classification: 'possible_conflict', a: { source_id: 's1', quote: 'The last date to apply is 31 December 2026', value: '31 December 2026' }, b: { source_id: 's2', quote: 'Apply before 15 December 2026', value: '15 December 2026' } },
      { topic_key: 'deadline', classification: 'possible_conflict', a: { source_id: 's1', quote: 'The last date to apply is 31 December 2026', value: '30 November 2026' }, b: { source_id: 's2', quote: 'Apply before 15 December 2026', value: '15 December 2026' } },
      { topic_key: 'deadline', classification: 'possible_conflict', a: { source_id: 's1', quote: 'The last date to apply is 31 December 2026', value: '31 December 2026' }, b: { source_id: 's1', quote: 'The amount is Rs. 60,000 per year', value: '60,000' } },
      { topic_key: 'deadline', classification: 'certainly_wrong', a: {}, b: {} },
    ],
  });
  assert.equal(out.ok, true);
  assert.equal(out.keyPoints.length, 1);
  assert.equal(out.keyPoints[0].quoteVerified, true);
  assert.deepEqual(out.gaps.map((g) => `${g.facet}:${g.kind}`), ['renewal:missing'], 'gap with an unfound quote and an unknown kind are dropped');
  assert.equal(out.contradictions.length, 1, 'invented value, same-source pair and unknown class are dropped');
  const [con] = out.contradictions;
  assert.equal(con.claimA.text, 'The last date to apply is 31 December 2026.', 'the full source sentence is cited');
  assert.equal(con.origin, 'ai');
  assert.equal(out.discardedStatements, 3 + 2 + 3);
});

test('AI output whose findings all fail verification is rejected', () => {
  const out = validate({
    gaps: [{ topic_key: 'deadline', kind: 'unspecified', evidence: [{ source_id: 's1', quote: 'Not in the text at all.' }] }],
    contradictions: [],
  });
  assert.equal(out.ok, false);
  assert.match(out.reason, /None of the AI findings could be matched/);
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

test('concurrent writes all land and the file stays valid JSON', async () => {
  await fs.mkdir(dir, { recursive: true });
  const { saveSession } = await import('../src/services/store.service.js');
  const ids = Array.from({ length: 25 }, (_, i) => `concurrent_${String(i).padStart(12, '0')}`);
  await Promise.all(ids.map((id) => saveSession({ id, createdAt: new Date().toISOString(), sources: [] })));
  const data = JSON.parse(await fs.readFile(process.env.DATA_FILE, 'utf8'));
  for (const id of ids) assert.ok(data.sessions.some((s) => s.id === id), id);
});

test('duplicate AI key points citing the same quote are kept once', () => {
  const quote = 'The last date to apply is 31 December 2026.';
  const out = validate({
    key_points: [
      { statement: 'Deadline', source_id: 's1', quote },
      { statement: 'Deadline again', source_id: 's1', quote: `  ${quote.toUpperCase()} ` },
    ],
    gaps: [],
    contradictions: [],
  });
  assert.equal(out.keyPoints.length, 1);
  assert.equal(out.discardedStatements, 0);
});
