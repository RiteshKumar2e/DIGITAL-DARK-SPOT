import test from 'node:test';
import assert from 'node:assert/strict';
import { findDates, findYears } from '../src/utils/dates.js';
import { findMoney, findAges } from '../src/services/analysis/claims.js';
import { splitSentences } from '../src/utils/text.js';
import { analyzeSession } from '../src/services/analysis/index.js';
import { buildDemoSources } from '../src/services/demo.service.js';
import { buildTextSource } from '../src/services/source.service.js';
import { extractFromHtml } from '../src/services/extractor.service.js';

test('parses common date formats', () => {
  const dates = findDates('Apply by 31 December 2026 or March 5, 2027. Results on 2027-04-10, notice dated 05/06/2026, intake in July 2027.');
  assert.deepEqual(dates.map((d) => d.iso), ['2026-12-31', '2027-03-05', '2027-04-10', '2026-06-05', '2027-07']);
  assert.equal(dates[3].ambiguous, true);
  assert.deepEqual(findDates('31 February 2026').length, 0);
});

test('finds years including academic ranges', () => {
  assert.deepEqual(findYears('the 2024-25 cycle').sort(), [2024, 2025]);
});

test('extracts money with Indian units and ages', () => {
  const money = findMoney('Income below ₹2.5 lakh; award of Rs. 60,000 per year; fee USD 25.');
  assert.deepEqual(money.map((m) => [m.currency, m.amount]), [['INR', 250000], ['INR', 60000], ['USD', 25]]);
  assert.deepEqual(findAges('Candidates must be below 30 years of age')[0].max, 30);
});

test('sentence splitter keeps abbreviations together', () => {
  const parts = splitSentences('The amount is Rs. 50,000 per year. Apply online.');
  assert.deepEqual(parts, ['The amount is Rs. 50,000 per year.', 'Apply online.']);
});

test('HTML extraction reads declared dates and drops scripts', () => {
  const html = `<html><head><title>Notice</title><meta property="article:modified_time" content="2025-01-10T08:00:00Z">
  <script>var secret = "ignore me";</script></head><body><main><h1>Scholarship notice</h1><p>${'Eligibility details are listed here. '.repeat(20)}</p></main></body></html>`;
  const out = extractFromHtml(html);
  assert.equal(out.title, 'Notice');
  assert.equal(out.modified.value, '2025-01-10');
  assert.ok(!out.text.includes('secret'));
});

function demoSession(now) {
  const sources = buildDemoSources(now).map((sample, i) => {
    const source = { id: `src_${i}`, kind: 'sample' };
    buildTextSource(source, sample);
    source.published = sample.published;
    source.modified = sample.modified;
    return source;
  });
  return {
    question: 'Am I eligible for the Sunrise Merit Scholarship, what is the current deadline, and can it be renewed?',
    profile: 'scholarship',
    sources,
    checklist: [],
  };
}

test('demo analysis finds the planted gap, conflicts and stale signals', async () => {
  const now = new Date('2026-10-31T00:00:00Z');
  const { analysis, checklist } = await analyzeSession(demoSession(now), { now });

  assert.equal(analysis.profile.key, 'scholarship');
  assert.equal(analysis.ai.status, 'not_configured');
  assert.ok(analysis.gaps.some((g) => g.facet === 'renewal' && g.kind === 'missing'), 'renewal gap');

  const deadline = analysis.contradictions.find((c) => c.facet === 'deadline' && c.classification === 'possible_conflict');
  assert.ok(deadline, 'deadline conflict between the notice and the blog');
  const amount = analysis.contradictions.find((c) => c.facet === 'amount');
  assert.ok(amount, 'amount conflict');
  const income = analysis.contradictions.find((c) => c.facet === 'income');
  assert.equal(income?.classification, 'different_cycle', 'income difference explained by cycle');

  assert.ok(analysis.freshness.some((f) => f.kind === 'stale'), 'stale blog');
  assert.ok(analysis.freshness.some((f) => f.kind === 'past_deadline'), 'past deadline in forum');
  assert.ok(analysis.freshness.some((f) => f.sourceId === 'src_2' && (f.kind === 'old_years' || f.kind === 'undated')), 'undated forum');

  // Every claim cited by a finding is a verbatim sentence from its source.
  const sources = Object.fromEntries(demoSession(now).sources.map((s) => [s.id, s]));
  for (const claim of analysis.claims) assert.ok(sources[claim.sourceId].text.includes(claim.text));

  assert.ok(checklist.length > 0);
  assert.equal(checklist[0].priority, 'high');
});

test('checklist completion survives re-analysis', async () => {
  const now = new Date('2026-10-31T00:00:00Z');
  const session = demoSession(now);
  const first = await analyzeSession(session, { now });
  first.checklist[0].done = true;
  session.checklist = first.checklist;
  const second = await analyzeSession(session, { now });
  assert.equal(second.checklist.find((i) => i.key === first.checklist[0].key).done, true);
});

test('no contradictions or gaps are invented from nothing', async () => {
  const source = { id: 'src_x', kind: 'text' };
  buildTextSource(source, { title: 'Notes', text: 'This page talks about the weather in general terms and has nothing else of note to report for anyone at all today.' });
  const { analysis } = await analyzeSession({ question: 'What are the eligibility rules for the city library card?', profile: 'auto', sources: [source], checklist: [] });
  assert.equal(analysis.contradictions.length, 0);
  assert.ok(analysis.gaps.every((g) => g.scope.level === 'limited'));
});
