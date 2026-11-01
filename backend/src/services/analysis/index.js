import { FACETS, PROFILES, detectProfile } from './profiles.js';
import { extractClaims } from './claims.js';
import { detectGaps, evidenceScope } from './gaps.js';
import { detectContradictions, detectDocumentDifferences } from './contradictions.js';
import { detectFreshness, sourceDateInfo } from './freshness.js';
import { buildChecklist } from './checklist.js';
import { runAiAnalysis } from '../ai.service.js';
import { coverageRows, scopeGaps, buildTimeline, qualityReport } from './insights.js';
import { officialSignal } from '../../utils/officialSignal.js';
import { config } from '../../config/index.js';
import { keyTerms } from '../../utils/text.js';

export const ENGINE_VERSION = 'rules-1.1';

const IMPORTANCE_ORDER = { critical: 0, important: 1, useful: 2 };
const KIND_ORDER = { scope_mismatch: 0, missing: 1, unspecified: 2, question_term: 3, single_source: 4 };
const sortGaps = (gaps) => [...gaps].sort((a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance] || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

/**
 * Runs the full analysis over the sources that were successfully retrieved.
 * Failed sources are listed in scope but contribute no evidence.
 *
 * Gaps and contradictions come from the AI first. If the AI is not configured,
 * fails, or returns nothing that can be matched to the source text, the rule
 * engine produces them instead. Dates, freshness, coverage and the timeline are
 * always computed from the source text, because they depend on exact date
 * arithmetic.
 */
export async function analyzeSession(session, { now = new Date(), aiClient } = {}) {
  const profileKey = session.profile === 'auto' || !PROFILES[session.profile] ? detectProfile(session.question) : session.profile;
  const profile = PROFILES[profileKey];
  const facetKeys = profile.facets.map((f) => f.key);

  const reviewed = session.sources.filter((s) => s.status === 'retrieved' && s.text);
  const notReviewed = session.sources.filter((s) => !(s.status === 'retrieved' && s.text));

  for (const source of session.sources) source.officialSignal = officialSignal(source.domain);
  for (const source of reviewed) source.dateInfo = sourceDateInfo(source, now);
  const staleMonths = config.freshnessMonths[profileKey] || 12;
  const sourcesById = Object.fromEntries(reviewed.map((s) => [s.id, s]));

  const extracted = reviewed.flatMap((s) => extractClaims(s, facetKeys, session.question));
  const scope = evidenceScope(reviewed);
  const unreviewedSourceIds = notReviewed.map((s) => s.id);
  const freshness = detectFreshness({ sources: reviewed, claims: extracted, now, staleMonths });

  const ai = await runAiAnalysis({
    question: [session.question, session.context?.situation && `Situation: ${session.context.situation}`, session.context?.location && `Location: ${session.context.location}`, session.context?.period && `Period: ${session.context.period}`]
      .filter(Boolean)
      .join('\n'),
    profile,
    sources: reviewed,
    claims: extracted,
    scope,
    unreviewedSourceIds,
    now,
    client: aiClient,
  });

  let method, gaps, contradictions, claims;
  if (ai.status === 'ok') {
    method = 'ai';
    gaps = sortGaps(ai.gaps);
    contradictions = ai.contradictions;
    claims = [...extracted, ...ai.claims];
  } else {
    method = 'rules';
    claims = extracted;
    const scopeText = [session.question, session.context?.situation].filter(Boolean).join(' ');
    const baseGaps = detectGaps({ profile, sources: reviewed, claims, question: scopeText, unreviewedSourceIds });
    gaps = [...scopeGaps({ question: session.question, context: session.context, sources: reviewed, scope }), ...baseGaps];
    contradictions = [
      ...detectContradictions({ claims, sourcesById, facetKeys }),
      ...detectDocumentDifferences({ claims, sourcesById, facetKeys }),
    ];
  }
  // Findings are stored once, at the top level of the analysis.
  const { gaps: _gaps, contradictions: _cons, claims: _claims, ...aiSummary } = ai;

  const searchHint = keyTerms(session.question).slice(0, 4).join(' ');
  const checklist = buildChecklist({ gaps, contradictions, freshness, sourcesById, previous: session.checklist || [], searchHint });

  // Keep only claims referenced by findings or coverage, to keep the payload small.
  const cov = coverageRows(profile, claims, reviewed, gaps, contradictions);
  const timeline = buildTimeline({ sources: reviewed, claims, now });
  const referenced = new Set([
    ...cov.flatMap((c) => c.topClaimIds),
    ...gaps.flatMap((g) => g.evidenceClaimIds),
    ...contradictions.flatMap((c) => [c.claimA.claimId, c.claimB.claimId]),
    ...freshness.filter((f) => f.claimId).map((f) => f.claimId),
    ...cov.flatMap((c) => Object.values(c.firstClaimBySource)),
    ...timeline.events.filter((e) => e.claimId).map((e) => e.claimId),
  ]);

  return {
    analysis: {
      runAt: now.toISOString(),
      method,
      engine: method === 'ai' ? `ai (${ai.model}) + ${ENGINE_VERSION} for dates` : ENGINE_VERSION,
      profile: { key: profileKey, label: profile.label, detected: session.profile === 'auto' },
      context: session.context || {},
      freshnessThresholdMonths: staleMonths,
      scope: {
        reviewedSourceIds: reviewed.map((s) => s.id),
        notReviewedSourceIds: unreviewedSourceIds,
        ...scope,
      },
      coverage: cov,
      claims: claims.filter((c) => referenced.has(c.id)),
      totalClaimsExtracted: claims.length,
      gaps,
      contradictions,
      freshness,
      timeline,
      quality: qualityReport({ allSources: session.sources, reviewed, coverage: cov, gaps, freshness, staleMonths, now, ai: aiSummary, method }),
      ai: aiSummary,
    },
    checklist,
    sourceDates: Object.fromEntries(reviewed.map((s) => [s.id, s.dateInfo])),
  };
}
