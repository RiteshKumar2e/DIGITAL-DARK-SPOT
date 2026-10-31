import { FACETS } from './profiles.js';
import { findYears, toEndDate, monthsBetween } from '../../utils/dates.js';
import { normalizeForMatch } from '../../utils/text.js';

const STATUS_LABEL = {
  conflict: 'Conflicting values',
  difference: 'Differs (cycle or scope)',
  missing: 'Not found',
  unspecified: 'Mentioned, no specifics',
  single: 'One source only',
  covered: 'Covered',
};

/** Per-facet status combining coverage, gaps and contradictions. */
export function coverageRows(profile, claims, sources, gaps, contradictions) {
  return profile.facets.map((spec) => {
    const facetClaims = claims.filter((c) => c.facets.includes(spec.key));
    const bySource = {};
    const firstClaimBySource = {};
    for (const s of sources) {
      const own = facetClaims.filter((c) => c.sourceId === s.id);
      bySource[s.id] = own.length;
      if (own.length) {
        const best = [...own].sort((a, b) => Object.keys(b.values).length - Object.keys(a.values).length || b.relevance - a.relevance)[0];
        firstClaimBySource[s.id] = best.id;
      }
    }
    const top = [...facetClaims]
      .sort((a, b) => Object.keys(b.values).length - Object.keys(a.values).length || b.relevance - a.relevance)
      .slice(0, 4)
      .map((c) => c.id);

    const facetCons = contradictions.filter((c) => c.facet === spec.key);
    const gap = gaps.find((g) => g.facet === spec.key);
    let status = 'covered';
    if (facetCons.some((c) => ['possible_conflict', 'list_difference'].includes(c.classification))) status = 'conflict';
    else if (facetCons.length) status = 'difference';
    else if (gap?.kind === 'missing') status = 'missing';
    else if (gap?.kind === 'unspecified') status = 'unspecified';
    else if (Object.values(bySource).filter(Boolean).length === 1 && sources.length > 1) status = 'single';

    return {
      facet: spec.key,
      label: FACETS[spec.key].label,
      importance: spec.importance,
      bySource,
      firstClaimBySource,
      topClaimIds: top,
      status,
      statusLabel: STATUS_LABEL[status],
      relatedFindingId: facetCons[0]?.id || gap?.id || null,
    };
  });
}

/**
 * Gaps caused by the research scope: a year or place the user asked about
 * that no reviewed source mentions.
 */
export function scopeGaps({ question, context, sources, scope }) {
  const gaps = [];
  if (!sources.length) return gaps;
  const corpus = sources.map((s) => s.text || '').join('\n');
  const corpusYears = new Set(findYears(corpus));
  for (const s of sources) {
    const best = s.dateInfo?.best?.value;
    if (best) corpusYears.add(Number(best.slice(0, 4)));
  }
  const wanted = findYears(`${question} ${context?.period || ''}`);
  const missingYears = wanted.filter((y) => !corpusYears.has(y));
  if (wanted.length && missingYears.length === wanted.length) {
    gaps.push({
      id: 'gap_scope_period',
      kind: 'scope_mismatch',
      facet: null,
      label: 'Time period',
      importance: 'critical',
      title: `The period you asked about (${missingYears.join(', ')}) is not mentioned in the sources reviewed`,
      detail: `None of the reviewed sources mention ${missingYears.join(' or ')}, or are dated in it. They may describe a different year or cycle.`,
      whyItMatters: 'Rules, dates and amounts often change from one year or cycle to the next.',
      nextStep: `Find information that explicitly covers ${missingYears.join(', ')}, preferably from the issuing organisation.`,
      reviewedSourceIds: sources.map((s) => s.id),
      searchedFor: missingYears.map(String),
      scope,
      evidenceClaimIds: [],
    });
  }

  const place = context?.location?.trim();
  if (place && place.length >= 2) {
    const norm = normalizeForMatch(corpus);
    const words = normalizeForMatch(place).split(/[\s,]+/).filter((w) => w.length >= 3);
    if (words.length && !words.some((w) => norm.includes(w))) {
      gaps.push({
        id: 'gap_scope_location',
        kind: 'scope_mismatch',
        facet: null,
        label: 'Location',
        importance: 'useful',
        title: `Your location (${place}) is not mentioned in the sources reviewed`,
        detail: 'The sources may still apply to you, but none of them says so explicitly.',
        whyItMatters: 'Eligibility, fees and procedures often differ by country, state or region.',
        nextStep: `Confirm that the information applies to ${place}.`,
        reviewedSourceIds: sources.map((s) => s.id),
        searchedFor: words,
        scope,
        evidenceClaimIds: [],
      });
    }
  }
  return gaps;
}

/** Dated events from source metadata and from dates stated in key claims. */
export function buildTimeline({ sources, claims, now }) {
  const events = [];
  for (const s of sources) {
    if (s.published) events.push({ date: s.published.value, kind: 'published', label: 'Published', origin: s.published.origin, sourceId: s.id });
    if (s.modified) events.push({ date: s.modified.value, kind: 'updated', label: 'Last updated', origin: s.modified.origin, sourceId: s.id });
  }
  const seen = new Set();
  for (const c of claims) {
    if (!c.values.date) continue;
    if (!c.facets.some((f) => f === 'deadline' || f === 'dates')) continue;
    for (const d of c.values.date) {
      const key = `${c.sourceId}|${d.iso}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({
        date: d.iso,
        kind: c.facets.includes('deadline') ? 'deadline' : 'stated',
        label: c.facets.includes('deadline') ? 'Deadline stated' : 'Date stated',
        origin: 'Stated in source text',
        sourceId: c.sourceId,
        claimId: c.id,
        raw: d.raw,
        ambiguous: d.ambiguous || false,
      });
    }
  }
  for (const e of events) e.past = toEndDate(e.date) < now;
  events.sort((a, b) => a.date.localeCompare(b.date));
  const undatedSourceIds = sources.filter((s) => !s.published && !s.modified).map((s) => s.id);
  return { events: events.slice(0, 60), undatedSourceIds, analysisDate: now.toISOString().slice(0, 10) };
}

/**
 * An explained assessment of the investigation itself. Deliberately not a
 * single score: each factor is shown with the reason it matters.
 */
export function qualityReport({ allSources, reviewed, coverage, gaps, freshness, staleMonths, now, ai }) {
  const factors = [];
  const add = (key, label, value, ok, explanation) => factors.push({ key, label, value, ok, explanation });

  const failed = allSources.length - reviewed.length;
  add('reviewed', 'Sources reviewed', `${reviewed.length} of ${allSources.length}`, reviewed.length >= 2,
    failed ? `${failed} source(s) could not be retrieved and contribute no evidence.` : 'Every added source was retrieved and read.');

  const origins = new Set(reviewed.map((s) => s.domain || `${s.kind}:${s.id}`));
  add('diversity', 'Independent publishers', String(origins.size), origins.size >= 2,
    origins.size >= 2 ? 'More than one publisher lets claims be cross-checked.' : 'All evidence comes from one publisher, so claims cannot be cross-checked.');

  const covered = coverage.filter((r) => Object.values(r.bySource).some(Boolean)).length;
  add('dimensions', 'Research topics covered', `${covered} of ${coverage.length}`, covered === coverage.length,
    'Topics this type of research usually needs that at least one source mentions.');

  const criticalOpen = gaps.filter((g) => g.importance === 'critical' && g.kind !== 'single_source').length;
  add('critical_gaps', 'Critical gaps open', String(criticalOpen), criticalOpen === 0,
    'Missing information that would block a decision, such as eligibility or the current deadline.');

  const single = coverage.filter((r) => r.importance === 'critical' && Object.values(r.bySource).filter(Boolean).length === 1).length;
  add('single_source', 'Critical topics with one source', String(single), single === 0,
    'Claims supported by a single source have not been corroborated.');

  const official = reviewed.filter((s) => s.officialSignal);
  add('official', 'Official-domain sources', String(official.length), official.length > 0,
    official.length
      ? 'Based on reserved domains such as .gov.in or .edu. This shows the publisher type, not that the content is current.'
      : 'No reviewed source is on a government or academic domain. The issuing organisation’s own page may not be included.');

  const current = reviewed.filter((s) => s.dateInfo?.best && monthsBetween(toEndDate(s.dateInfo.best.value), now) <= staleMonths).length;
  const undated = reviewed.filter((s) => !s.dateInfo?.best).length;
  add('current', `Dated within ${staleMonths} months`, `${current} of ${reviewed.length}`, current > 0,
    undated ? `${undated} source(s) declare no publication or update date.` : 'Every reviewed source declares a date.');

  const warnings = freshness.filter((f) => f.severity === 'high').length;
  add('freshness', 'High-severity freshness warnings', String(warnings), warnings === 0, 'Passed deadlines or sources well beyond the freshness threshold.');

  add('ai', 'AI review', ai.status === 'ok' ? 'Used (labelled)' : ai.status === 'not_configured' ? 'Not configured' : 'Unavailable', true,
    'AI output, when present, is labelled and never counted as evidence.');

  return { factors, attention: factors.filter((f) => !f.ok).length };
}
