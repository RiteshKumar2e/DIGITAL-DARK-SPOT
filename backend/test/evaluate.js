import { analyzeSession } from '../src/services/analysis/index.js';
import { fixtureSource } from './helpers.js';
import { EVAL_CASES, NOW } from './fixtures/eval-cases.js';

function matches(analysis, rule) {
  switch (rule.type) {
    case 'gap':
      return analysis.gaps.some((g) => (!rule.facet || g.facet === rule.facet) && (!rule.kind || g.kind === rule.kind));
    case 'contradiction':
      return analysis.contradictions.some((c) => (!rule.facet || c.facet === rule.facet) && (!rule.classification || c.classification === rule.classification));
    case 'freshness':
      return analysis.freshness.some((f) => f.sourceId === rule.sourceId && (!rule.kind || f.kind === rule.kind));
    case 'notReviewed':
      return analysis.scope.notReviewedSourceIds.includes(rule.sourceId);
    case 'official':
      return analysis.quality.factors.some((f) => f.key === 'official' && f.value !== '0');
    default:
      return false;
  }
}

/** Every evidence reference must point to a reviewed source and quote its text verbatim. */
function referenceErrors(analysis, sources) {
  const byId = Object.fromEntries(sources.map((s) => [s.id, s]));
  const errors = [];
  for (const claim of analysis.claims) {
    const src = byId[claim.sourceId];
    if (!src || !src.text.includes(claim.text)) errors.push(`claim ${claim.id} is not verbatim in ${claim.sourceId}`);
  }
  for (const c of analysis.contradictions) {
    for (const side of [c.claimA, c.claimB]) {
      if (!byId[side.sourceId]?.text.includes(side.text)) errors.push(`contradiction ${c.id} quote not found in ${side.sourceId}`);
    }
  }
  return errors;
}

export async function runEvaluation() {
  const results = [];
  for (const testCase of EVAL_CASES) {
    const sources = testCase.sources.map((s) => fixtureSource(s.id, s));
    const fixtureErrors = sources
      .filter((s, i) => s.status !== (testCase.sources[i].status || 'retrieved'))
      .map((s) => `fixture ${s.id} was not retrieved as intended (${s.error?.message})`);
    const session = { question: testCase.question, profile: testCase.profile, context: {}, sources, checklist: [] };
    const { analysis } = await analyzeSession(session, { now: NOW });
    const missed = testCase.expect.filter((rule) => !matches(analysis, rule));
    const falsePositives = testCase.forbid.filter((rule) => matches(analysis, rule));
    results.push({ name: testCase.name, missed, falsePositives, referenceErrors: [...fixtureErrors, ...referenceErrors(analysis, sources)] });
  }
  return results;
}

// `npm run eval` prints a summary table.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const results = await runEvaluation();
  const expected = EVAL_CASES.reduce((n, c) => n + c.expect.length, 0);
  const forbidden = EVAL_CASES.reduce((n, c) => n + c.forbid.length, 0);
  const missed = results.reduce((n, r) => n + r.missed.length, 0);
  const fps = results.reduce((n, r) => n + r.falsePositives.length, 0);
  const refs = results.reduce((n, r) => n + r.referenceErrors.length, 0);
  for (const r of results) {
    const ok = !r.missed.length && !r.falsePositives.length && !r.referenceErrors.length;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.name}`);
    for (const m of r.missed) console.log(`      missed: ${JSON.stringify(m)}`);
    for (const f of r.falsePositives) console.log(`      false positive: ${JSON.stringify(f)}`);
    for (const e of r.referenceErrors) console.log(`      reference error: ${e}`);
  }
  console.log(`\n${EVAL_CASES.length} cases · expected findings detected: ${expected - missed}/${expected} · forbidden findings produced: ${fps}/${forbidden} · invalid evidence references: ${refs}`);
  process.exitCode = missed || fps || refs ? 1 : 0;
}
