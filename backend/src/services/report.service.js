/**
 * Builds an exportable report of the current session's actual results.
 * Markdown is the canonical form; the HTML version is rendered from the same
 * structure with every value escaped.
 */
const CLASS_LABEL = {
  possible_conflict: 'Possible contradiction',
  list_difference: 'Document lists differ',
  scope_difference: 'May differ in scope',
  unit_difference: 'May use different units',
  different_cycle: 'May be a different cycle',
  inconclusive: 'Inconclusive',
  not_comparable: 'Not directly comparable',
};

const sourceName = (s, i) => `S${i + 1}`;

function collect(session) {
  const { analysis } = session;
  const labels = Object.fromEntries(session.sources.map((s, i) => [s.id, sourceName(s, i)]));
  const claims = Object.fromEntries((analysis.claims || []).map((c) => [c.id, c]));
  return { analysis, labels, claims };
}

const mdEscape = (text) => String(text ?? '').replace(/([\\`*_[\]<>|])/g, '\\$1').replace(/\n+/g, ' ');
const quoteMd = (text) => `> ${mdEscape(text)}`;

export function buildMarkdown(session) {
  const { analysis, labels, claims } = collect(session);
  const L = [];
  const push = (...lines) => L.push(...lines);
  const cite = (claim) => `${labels[claim.sourceId] || 'source'}${claim.page ? `, page ${claim.page}` : ''}`;

  push('# Digital Dark Spot research report', '');
  if (session.demo) push('**SAMPLE DATA:** this report was generated from simulated demonstration sources, not real pages.', '');
  push(`**Research question:** ${mdEscape(session.question)}`, '');
  const ctx = session.context || {};
  const scopeBits = [ctx.situation && `Situation: ${ctx.situation}`, ctx.location && `Location: ${ctx.location}`, ctx.period && `Period: ${ctx.period}`].filter(Boolean);
  if (scopeBits.length) push(`**Scope:** ${mdEscape(scopeBits.join(' · '))}`, '');
  push(
    `**Research type:** ${analysis.profile.label}  `,
    `**Analysis run:** ${analysis.runAt} (engine ${analysis.engine})  `,
    `**Method:** ${analysis.method === 'ai'
      ? 'AI analysis; every quoted passage was checked word for word against the source'
      : `rule-based${analysis.ai?.status === 'error' ? ` fallback (AI analysis failed: ${mdEscape(analysis.ai.message)})` : ' (AI not configured)'}`}  `,
    ...(session.analysisStale ? ['**Note:** sources or the question changed after this analysis; re-run it for current results.  '] : []),
    `**Report generated:** ${new Date().toISOString()}  `,
    `**Evidence reviewed:** ${analysis.scope.sourceCount} of ${session.sources.length} sources, ${analysis.scope.wordCount} words`,
    '',
    `> Findings describe only the sources listed below. “Not found in the sources reviewed” does not mean the information does not exist.`,
    '',
  );

  push('## Sources', '');
  session.sources.forEach((s, i) => {
    const where = s.finalUrl || s.url || (s.kind === 'pdf' ? `Uploaded PDF: ${s.fileName}` : s.kind === 'sample' ? 'Simulated sample document' : 'Pasted text');
    const date = s.modified ? `updated ${s.modified.value}` : s.published ? `published ${s.published.value}` : 'publication date not established';
    const status = s.status === 'retrieved' ? 'reviewed' : `NOT reviewed (${s.error?.message || 'not retrieved'})`;
    const fingerprint = analysis.sourceSnapshot?.[s.id]?.contentHash ? ` | fingerprint ${analysis.sourceSnapshot[s.id].contentHash.slice(0, 10)}` : '';
    push(`- **${sourceName(s, i)}** ${mdEscape(s.title)} | ${mdEscape(where)} | ${date} | retrieved ${s.retrievedAt || 'n/a'} | ${status}${fingerprint}`);
  });
  push('');

  push('## What was checked', '');
  for (const row of analysis.coverage || []) {
    const found = Object.entries(row.bySource).filter(([, n]) => n > 0).map(([id]) => labels[id]);
    push(`- **${row.label}** (${row.importance}): ${row.statusLabel || (found.length ? 'covered' : 'not found')}${found.length ? ` — found in ${found.join(', ')}` : ''}`);
  }
  push('');

  push('## What remains unknown', '');
  const unknown = [];
  for (const g of analysis.gaps.filter((x) => x.kind !== 'single_source')) unknown.push(`- ${mdEscape(g.title)}`);
  for (const c of analysis.contradictions.filter((x) => ['possible_conflict', 'list_difference', 'inconclusive'].includes(x.classification))) {
    unknown.push(`- Unresolved: ${mdEscape(c.subject)} (${mdEscape(c.claimA.value)} vs ${mdEscape(c.claimB.value)})`);
  }
  for (const id of analysis.scope.notReviewedSourceIds) unknown.push(`- Source ${labels[id]} could not be retrieved, so its content is unknown`);
  for (const id of analysis.timeline?.undatedSourceIds || []) unknown.push(`- Publication date of ${labels[id]} not established`);
  push(...(unknown.length ? unknown : ['- Nothing flagged within the reviewed sources.']), '');

  push('## Potential information gaps', '');
  if (!analysis.gaps.length) push('No potential gaps were detected within the reviewed sources.', '');
  for (const g of analysis.gaps) {
    push(`### ${mdEscape(g.title)}`, '', `- Priority: ${g.importance}`, `- Why it matters: ${mdEscape(g.whyItMatters)}`, `- Next step: ${mdEscape(g.nextStep)}`,
      `- Sources searched: ${g.reviewedSourceIds.map((id) => labels[id]).join(', ')}`,
      g.origin === 'ai' ? '- Found by: AI reading of the full source text' : `- Looked for: ${g.searchedFor.map(mdEscape).join(', ')}`, '');
    for (const id of g.evidenceClaimIds) if (claims[id]) push(quoteMd(claims[id].text), `> (${cite(claims[id])})`, '');
  }

  push('## Possible contradictions and differences', '');
  if (!analysis.contradictions.length) push('No conflicting values were detected between sources.', '');
  for (const c of analysis.contradictions) {
    push(`### ${CLASS_LABEL[c.classification] || c.classification}: ${mdEscape(c.subject)}`, '', mdEscape(c.explanation), '');
    push(`**${labels[c.claimA.sourceId]}** (${mdEscape(c.claimA.value)}):`, quoteMd(c.claimA.text), '');
    push(`**${labels[c.claimB.sourceId]}** (${mdEscape(c.claimB.value)}):`, quoteMd(c.claimB.text), '');
    push('Why they may differ:', ...c.possibleReasons.map((r) => `- ${mdEscape(r)}`), '', `Recommendation: ${mdEscape(c.recommendation)}`, '');
  }

  push('## Freshness', '', `Freshness threshold for this research type: ${analysis.freshnessThresholdMonths} months.`, '');
  if (!analysis.freshness.length) push('No freshness warnings.', '');
  for (const f of analysis.freshness) push(`- **${mdEscape(f.title)}** (${labels[f.sourceId]}): ${mdEscape(f.explanation)}`);
  push('');

  if (analysis.timeline?.events?.length) {
    push('## Timeline', '');
    for (const e of analysis.timeline.events) push(`- ${e.date}: ${e.label} (${labels[e.sourceId]}; ${mdEscape(e.origin)})${e.past ? ' (in the past)' : ''}`);
    push('');
  }

  push('## Verification checklist', '');
  for (const item of session.checklist) {
    push(`- [${item.done ? 'x' : ' '}] **${item.priority.toUpperCase()}** ${mdEscape(item.text)}${item.done ? ' (marked done by the user; not independently verified)' : ''}`);
    push(`  - Why: ${mdEscape(item.rationale)}`);
  }
  push('');

  if (analysis.ai?.status === 'ok') {
    push('## AI summary', '', '_Written by a language model. Key points are kept only when their quote was found word for word in the source._', '');
    if (analysis.ai.overview) push(mdEscape(analysis.ai.overview), '');
    for (const p of analysis.ai.keyPoints || []) push(`- ${mdEscape(p.statement)} (${labels[p.sourceId]}, quote: “${mdEscape(p.quote)}”)`);
    push('');
  }

  push('## Method and limitations', '',
    '- Sources are retrieved on the server; pages behind logins, paywalls or bot protection are not read.',
    '- Gaps and contradictions are found by an AI model first; any finding whose quote is not found word for word in the source is dropped. If the AI is unavailable, keyword rules are used instead, which can miss information phrased differently.',
    '- Contradictions are reported only where each source states an explicit value; differences explained by year, unit or group are labelled separately.',
    '- Dates come only from what each source declares; undated sources are not assumed to be outdated. Freshness thresholds are warning rules, not proof of error.',
    '- Checklist items marked done were ticked by the user and are not independently verified by this tool.', '');
  return L.join('\n');
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Minimal Markdown-to-HTML for the report's own constructs; all text is escaped first. */
export function markdownToHtml(md) {
  const out = [];
  let list = null;
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  const inline = (text) =>
    esc(text.replace(/\\([\\`*_[\]<>|])/g, '$1'))
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\s)_(.+?)_(?=\s|$)/g, '$1<em>$2</em>');
  for (const line of md.split('\n')) {
    if (/^#{1,3} /.test(line)) {
      closeList();
      const level = line.match(/^#+/)[0].length;
      out.push(`<h${level}>${inline(line.slice(level + 1))}</h${level}>`);
    } else if (/^> /.test(line)) {
      closeList();
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    } else if (/^\s*- \[[ x]\] /.test(line)) {
      if (list !== 'ul') { closeList(); out.push('<ul class="checks">'); list = 'ul'; }
      const done = /^\s*- \[x\]/.test(line);
      out.push(`<li>${done ? '☑' : '☐'} ${inline(line.replace(/^\s*- \[[ x]\] /, ''))}</li>`);
    } else if (/^\s*- /.test(line)) {
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li${/^\s{2,}/.test(line) ? ' class="sub"' : ''}>${inline(line.replace(/^\s*- /, ''))}</li>`);
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line.replace(/ {2}$/, ''))}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}

export function buildReport(session, format = 'markdown') {
  const md = buildMarkdown(session);
  if (format !== 'html') return md;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Research report · Digital Dark Spot</title>
<style>
body{font:16px/1.6 Georgia,'Palatino Linotype',serif;color:#211d1a;background:#fffdf9;max-width:48rem;margin:2rem auto;padding:0 1.25rem}
h1,h2,h3{font-family:'Segoe UI',Arial,sans-serif;line-height:1.25}h1{font-size:1.8rem;border-bottom:3px solid #c21f2f;padding-bottom:.4rem}
h2{font-size:1.3rem;margin-top:2rem;border-bottom:1px solid #e3d9ca;padding-bottom:.25rem}h3{font-size:1.05rem;margin-top:1.4rem}
blockquote{margin:.5rem 0;padding:.4rem .9rem;border-left:3px solid #e9b949;background:#fcf1d2}
ul{padding-left:1.2rem}li.sub{list-style:none;margin-left:1rem;color:#463f39}ul.checks{list-style:none;padding-left:0}
p,li{overflow-wrap:anywhere}@media print{body{margin:0;background:#fff}h2{break-after:avoid}blockquote{break-inside:avoid}}
</style></head><body>
${markdownToHtml(md)}
</body></html>`;
}
