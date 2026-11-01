import test from 'node:test';
import assert from 'node:assert/strict';

process.env.GROQ_API_KEY = '';
const { analyzeSession } = await import('../src/services/analysis/index.js');
const { buildDemoSources } = await import('../src/services/demo.service.js');
const { buildTextSource } = await import('../src/services/source.service.js');
const { splitSentences } = await import('../src/utils/text.js');

const now = new Date('2026-10-31T00:00:00Z');

function demoSession() {
  const sources = buildDemoSources(now).map((sample, i) => {
    const source = { id: `src_${i}`, kind: 'sample' };
    buildTextSource(source, sample);
    source.published = sample.published;
    source.modified = sample.modified;
    return source;
  });
  return { question: 'Can I apply for the Sunrise Merit Scholarship and what is the deadline?', profile: 'scholarship', sources, checklist: [] };
}

const sentenceWith = (source, needle) => splitSentences(source.text).find((s) => s.includes(needle));

/** A stand-in for the Groq client that returns a fixed reply, or throws. */
function fakeClient(reply) {
  const calls = [];
  return {
    calls,
    chat: {
      completions: {
        create: async (body) => {
          calls.push(body);
          if (reply instanceof Error) throw reply;
          return { choices: [{ message: { content: typeof reply === 'string' ? reply : JSON.stringify(reply) }, finish_reason: 'stop' }] };
        },
      },
    },
  };
}

test('AI runs first and its verified findings are used', async () => {
  const session = demoSession();
  const [notice, blog] = session.sources;
  const quoteA = sentenceWith(notice, '31 December 2026');
  const quoteB = sentenceWith(blog, '15 December 2026');
  assert.ok(quoteA && quoteB, 'fixture sentences exist');

  const client = fakeClient({
    overview: 'Two sources disagree on the deadline.',
    key_points: [{ statement: 'Official deadline', source_id: notice.id, quote: quoteA }],
    gaps: [{ topic_key: 'renewal', kind: 'missing', importance: 'important', why_it_matters: 'Funding after year one.', next_step: 'Ask the trust about renewal.', evidence: [] }],
    contradictions: [{
      topic_key: 'deadline', classification: 'possible_conflict',
      a: { source_id: notice.id, quote: quoteA, value: '31 December 2026' },
      b: { source_id: blog.id, quote: quoteB, value: '15 December 2026' },
      explanation: 'Different deadlines for the same cycle.', possible_reasons: ['The blog may be out of date.'], recommendation: 'Check the official page.',
    }],
  });
  const { analysis, checklist } = await analyzeSession(session, { now, aiClient: client });

  assert.equal(client.calls.length, 1);
  assert.equal(analysis.method, 'ai');
  assert.equal(analysis.ai.status, 'ok');
  assert.deepEqual(analysis.gaps.map((g) => [g.facet, g.kind, g.origin]), [['renewal', 'missing', 'ai']]);
  assert.equal(analysis.contradictions.length, 1);
  const [con] = analysis.contradictions;
  assert.equal(con.origin, 'ai');
  assert.ok(analysis.claims.some((c) => c.id === con.claimA.claimId), 'evidence claim is stored so the UI can open it');
  assert.ok(checklist.some((item) => item.relatedId === con.id), 'AI findings feed the checklist');
  assert.equal(analysis.coverage.find((r) => r.facet === 'deadline').status, 'conflict');
  assert.ok(analysis.freshness.length > 0, 'freshness is still computed from the dates');
  assert.equal(analysis.quality.factors.find((f) => f.key === 'method').value, 'AI, quotes verified');
  // Untrusted source text stays in the user message, never in the system prompt.
  assert.ok(!client.calls[0].messages[0].content.includes(quoteA));
});

test('rule engine takes over when the AI call fails', async () => {
  const client = fakeClient(Object.assign(new Error('boom'), { name: 'Error' }));
  const { analysis } = await analyzeSession(demoSession(), { now, aiClient: client });
  assert.equal(analysis.method, 'rules');
  assert.equal(analysis.ai.status, 'error');
  assert.ok(analysis.gaps.some((g) => g.facet === 'renewal' && g.kind === 'missing' && !g.origin), 'rule-based renewal gap');
  assert.ok(analysis.contradictions.some((c) => c.facet === 'deadline' && c.classification === 'possible_conflict'));
  assert.equal(analysis.quality.factors.find((f) => f.key === 'method').value, 'Rule-based fallback');
});

test('rule engine takes over when the AI reply is not JSON or cannot be verified', async () => {
  for (const reply of ['this is not json', { gaps: [{ topic_key: 'deadline', kind: 'unspecified', evidence: [{ source_id: 'src_0', quote: 'Words that are not in any source.' }] }], contradictions: [] }]) {
    const { analysis } = await analyzeSession(demoSession(), { now, aiClient: fakeClient(reply) });
    assert.equal(analysis.method, 'rules');
    assert.equal(analysis.ai.status, 'error');
    assert.ok(analysis.ai.message);
    assert.ok(analysis.contradictions.length > 0, 'rule findings are present');
  }
});

test('rule engine is used when no AI provider is configured', async () => {
  const { analysis } = await analyzeSession(demoSession(), { now });
  assert.equal(analysis.method, 'rules');
  assert.equal(analysis.ai.status, 'not_configured');
});
