import { FACETS } from './profiles.js';
import { keyTerms, stem, normalizeForMatch } from '../../utils/text.js';

const VALUE_EXPECTED = new Set(['deadline', 'amount', 'fee', 'age', 'income']);

/** Turns a facet regex into a short, human-readable list of searched phrases. */
export function describePattern(pattern) {
  const body = pattern.source.replace(/^\\b\(/, '').replace(/\)\\b$/, '');
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === '|' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  parts.push(current);
  return parts
    .map((p) =>
      p
        .replace(/\(\?:([^)]*)\)\??/g, (_, inner) => inner.split('|')[0])
        .replace(/\\w[*+]/g, '…')
        .replace(/\\d\+?/g, 'N')
        .replace(/\[- \]\??|\\s\??| \?/g, ' ')
        .replace(/[()?\\]|\[[^\]]*\]/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 8);
}

export function evidenceScope(sources) {
  const words = sources.reduce((sum, s) => sum + (s.wordCount || 0), 0);
  let level = 'broader';
  if (sources.length <= 1 || words < 400) level = 'limited';
  else if (sources.length === 2) level = 'moderate';
  return {
    level,
    sourceCount: sources.length,
    wordCount: words,
    note:
      words < 400
        ? 'Based on very little retrieved text. Treat this as a prompt to look further, not as a conclusion.'
        : sources.length <= 1
          ? 'Only one source was reviewed, so nothing could be cross-checked. Add more sources to compare them.'
          : 'Keyword scan of the retrieved text. Information phrased differently may have been missed.',
  };
}

export function detectGaps({ profile, sources, claims, question }) {
  const gaps = [];
  const reviewedIds = sources.map((s) => s.id);
  const scope = evidenceScope(sources);

  for (const spec of profile.facets) {
    const def = FACETS[spec.key];
    const facetClaims = claims.filter((c) => c.facets.includes(spec.key));
    const coveringSources = [...new Set(facetClaims.map((c) => c.sourceId))];
    const base = {
      facet: spec.key,
      label: def.label,
      importance: spec.importance,
      whyItMatters: spec.why,
      nextStep: spec.check,
      reviewedSourceIds: reviewedIds,
      searchedFor: describePattern(def.pattern),
      scope,
    };

    if (facetClaims.length === 0) {
      gaps.push({
        ...base,
        id: `gap_${spec.key}`,
        kind: 'missing',
        title: `${def.label}: not found in the sources reviewed`,
        detail: `None of the ${reviewedIds.length} retrieved source${reviewedIds.length === 1 ? '' : 's'} contain wording about ${def.label.toLowerCase()}.`,
        evidenceClaimIds: [],
      });
      continue;
    }

    const type = def.valueType;
    if (VALUE_EXPECTED.has(spec.key) && type && !facetClaims.some((c) => c.values[type]?.length)) {
      gaps.push({
        ...base,
        id: `gap_${spec.key}_value`,
        kind: 'unspecified',
        title: `${def.label} is mentioned, but no specific ${type === 'date' ? 'date' : 'figure'} was found`,
        detail: `The sources refer to ${def.label.toLowerCase()} without stating a ${type === 'date' ? 'calendar date' : 'clear value'} that could be extracted.`,
        evidenceClaimIds: facetClaims.slice(0, 3).map((c) => c.id),
      });
      continue;
    }

    if (reviewedIds.length >= 2 && coveringSources.length === 1 && spec.importance === 'critical') {
      gaps.push({
        ...base,
        id: `gap_${spec.key}_single`,
        kind: 'single_source',
        title: `${def.label}: covered by only one source`,
        detail: 'Only one of the reviewed sources addresses this, so it cannot be cross-checked.',
        evidenceClaimIds: facetClaims.slice(0, 3).map((c) => c.id),
      });
    }
  }

  // Parts of the question that no retrieved source mentions at all.
  const corpus = normalizeForMatch(sources.map((s) => s.text || '').join('\n'));
  // Words that name a facet (e.g. "eligibility", "deadline") are already covered by the facet checks above.
  const isFacetWord = (term) => profile.facets.some((f) => FACETS[f.key].pattern.test(term));
  const missingTerms = keyTerms(question).filter((term) => !isFacetWord(term) && !corpus.includes(stem(term)));
  if (missingTerms.length && sources.length) {
    gaps.push({
      id: 'gap_question_terms',
      kind: 'question_term',
      facet: null,
      label: 'Question coverage',
      importance: 'important',
      title: `Parts of your question are not mentioned: ${missingTerms.slice(0, 6).join(', ')}`,
      detail: 'These words from your question do not appear (even in a similar form) in any retrieved source.',
      whyItMatters: 'The sources may not address the specific situation you asked about.',
      nextStep: `Look for a source that specifically covers: ${missingTerms.slice(0, 6).join(', ')}.`,
      reviewedSourceIds: reviewedIds,
      searchedFor: missingTerms.slice(0, 6),
      scope,
      evidenceClaimIds: [],
    });
  }

  const order = { critical: 0, important: 1, useful: 2 };
  const kindOrder = { scope_mismatch: 0, missing: 1, unspecified: 2, question_term: 3, single_source: 4 };
  return gaps.sort((a, b) => order[a.importance] - order[b.importance] || kindOrder[a.kind] - kindOrder[b.kind]);
}
