import { stableKey } from '../../utils/ids.js';

const GAP_PRIORITY = { critical: 'high', important: 'medium', useful: 'low' };

/**
 * Builds verification tasks from findings. Each task keeps a stable key so
 * completion state survives re-analysis; user-added items are always kept.
 */
export function buildChecklist({ gaps, contradictions, freshness, sourcesById, previous = [], searchHint = '' }) {
  const items = [];
  const official = Object.values(sourcesById).find((s) => s.officialSignal);
  // Where to verify: an official-domain source already in the session, otherwise a suggested search.
  const destinationFor = (topic) =>
    official
      ? { type: 'source', sourceId: official.id, note: 'Compare against the official-domain source already in this session.' }
      : { type: 'search', query: `${searchHint} ${topic} official`.replace(/\s+/g, ' ').trim(), note: 'No official-domain source was reviewed. Look for the issuing organisation’s own page.' };
  const add = (item) => {
    const key = stableKey(item.relatedType, item.relatedId, item.text);
    items.push({ ...item, id: `chk_${key}`, key, origin: 'analysis', done: false, doneAt: null, destination: destinationFor(item.topic || '') });
  };

  for (const gap of gaps) {
    let priority = GAP_PRIORITY[gap.importance] || 'medium';
    if (gap.kind === 'single_source') priority = 'low';
    if (gap.kind === 'unspecified' && gap.importance === 'critical') priority = 'high';
    const rationale = {
      missing: `${gap.label} was not found in the reviewed sources. ${gap.whyItMatters}`,
      unspecified: `${gap.label} is mentioned without a specific value. ${gap.whyItMatters}`,
      single_source: `Only one source covers ${gap.label.toLowerCase()}, so it has not been corroborated.`,
      question_term: gap.whyItMatters,
      scope_mismatch: gap.whyItMatters,
    }[gap.kind];
    add({
      text: gap.kind === 'single_source' ? `Corroborate ${gap.label.toLowerCase()} with a second, official source.` : gap.nextStep,
      priority,
      rationale,
      relatedType: 'gap',
      relatedId: gap.id,
      topic: gap.label,
      sourceIds: ['missing', 'question_term', 'scope_mismatch'].includes(gap.kind) ? [] : [...new Set(gap.evidenceClaimIds.map((id) => id.slice(0, id.lastIndexOf('_c'))))],
    });
  }

  for (const finding of contradictions) {
    const nameA = sourcesById[finding.claimA.sourceId]?.domain || 'source A';
    const nameB = sourcesById[finding.claimB.sourceId]?.domain || 'source B';
    add({
      text:
        finding.classification === 'list_difference'
          ? `Confirm the official document list: ${nameA} mentions ${finding.claimA.value}; ${nameB} mentions ${finding.claimB.value}.`
          : `Resolve ${finding.subject.toLowerCase()}: ${finding.claimA.value} (${nameA}) vs ${finding.claimB.value} (${nameB}).`,
      priority: ['possible_conflict', 'list_difference'].includes(finding.classification) ? 'high' : 'medium',
      rationale:
        finding.classification === 'possible_conflict'
          ? 'Sources state different values with no obvious difference in scope.'
          : 'Sources state different values; this may be a difference in cycle, unit or category, which still needs confirming.',
      relatedType: 'contradiction',
      relatedId: finding.id,
      topic: finding.subject,
      sourceIds: [finding.claimA.sourceId, finding.claimB.sourceId],
    });
  }

  for (const warning of freshness) {
    if (warning.kind === 'undated' && warning.severity === 'info') {
      const domain = sourcesById[warning.sourceId]?.domain || 'this source';
      add({
        text: `Find when ${domain} was last updated, or confirm its details on a dated official page.`,
        priority: 'low',
        rationale: 'No publication or update date was found, so its currency is unknown.',
        relatedType: 'freshness',
        relatedId: warning.id,
        sourceIds: [warning.sourceId],
      });
      continue;
    }
    const topicFor = { past_deadline: 'deadline', stale: '', aging: '', old_years: '' };
    const text = {
      past_deadline: 'Confirm the current deadline; a deadline stated in a source has already passed.',
      stale: 'Check for a more recent version of an outdated source.',
      aging: 'Confirm that a source updated over a year ago still reflects current rules.',
      old_years: 'Check whether a source that only mentions older years is still current.',
    }[warning.kind];
    add({
      text,
      topic: topicFor[warning.kind] || '',
      priority: warning.kind === 'past_deadline' ? 'high' : warning.severity === 'high' ? 'medium' : 'low',
      rationale: warning.explanation,
      relatedType: 'freshness',
      relatedId: warning.id,
      sourceIds: [warning.sourceId],
    });
  }

  // De-duplicate identical tasks, then restore completion state.
  const byKey = new Map();
  for (const item of items) if (!byKey.has(item.key)) byKey.set(item.key, item);
  const previousByKey = new Map(previous.map((item) => [item.key, item]));
  const merged = [...byKey.values()].map((item) => {
    const old = previousByKey.get(item.key);
    return old ? { ...item, done: old.done, doneAt: old.doneAt } : item;
  });
  const userItems = previous.filter((item) => item.origin === 'user');

  const order = { high: 0, medium: 1, low: 2 };
  return [...merged.sort((a, b) => order[a.priority] - order[b.priority]), ...userItems];
}
