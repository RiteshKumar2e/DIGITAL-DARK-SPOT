import { FACETS, PROFILES, detectProfile } from './profiles.js';
import { extractClaims } from './claims.js';
import { detectGaps, evidenceScope } from './gaps.js';
import { detectContradictions, detectDocumentDifferences } from './contradictions.js';
import { detectFreshness, sourceDateInfo } from './freshness.js';
import { buildChecklist } from './checklist.js';
import { runAiReview } from '../ai.service.js';
import { coverageRows, scopeGaps, buildTimeline, qualityReport } from './insights.js';
import { officialSignal } from '../../utils/officialSignal.js';
import { config } from '../../config/index.js';
import { keyTerms } from '../../utils/text.js';

export const ENGINE_VERSION = 'rules-1.1';

/**
 * Runs the full analysis over the sources that were successfully retrieved.
 * Failed sources are listed in scope but contribute no evidence.
 */
export async function analyzeSession(session, { now = new Date() } = {}) {
  const profileKey = session.profile === 'auto' || !PROFILES[session.profile] ? detectProfile(session.question) : session.profile;
  const profile = PROFILES[profileKey];
  const facetKeys = profile.facets.map((f) => f.key);

  const reviewed = session.sources.filter((s) => s.status === 'retrieved' && s.text);
  const notReviewed = session.sources.filter((s) => !(s.status === 'retrieved' && s.text));

  for (const source of session.sources) source.officialSignal = officialSignal(source.domain);
  for (const source of reviewed) source.dateInfo = sourceDateInfo(source, now);
  const staleMonths = config.freshnessMonths[profileKey] || 12;
  const sourcesById = Object.fromEntries(reviewed.map((s) => [s.id, s]));

  const claims = reviewed.flatMap((s) => extractClaims(s, facetKeys, session.question));
  const scopeText = [session.question, session.context?.situation].filter(Boolean).join(' ');
  const baseGaps = detectGaps({ profile, sources: reviewed, claims, question: scopeText });
  const gaps = [...scopeGaps({ question: session.question, context: session.context, sources: reviewed, scope: evidenceScope(reviewed) }), ...baseGaps];
  const contradictions = [
    ...detectContradictions({ claims, sourcesById, facetKeys }),
    ...detectDocumentDifferences({ claims, sourcesById, facetKeys }),
  ];
  const freshness = detectFreshness({ sources: reviewed, claims, now, staleMonths });

  const ai = await runAiReview({
    question: session.question,
    profileLabel: profile.label,
    sources: reviewed,
    gaps,
    contradictions,
  });

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
      engine: ENGINE_VERSION,
      profile: { key: profileKey, label: profile.label, detected: session.profile === 'auto' },
      context: session.context || {},
      freshnessThresholdMonths: staleMonths,
      scope: {
        reviewedSourceIds: reviewed.map((s) => s.id),
        notReviewedSourceIds: notReviewed.map((s) => s.id),
        ...evidenceScope(reviewed),
      },
      coverage: cov,
      claims: claims.filter((c) => referenced.has(c.id)),
      totalClaimsExtracted: claims.length,
      gaps,
      contradictions,
      freshness,
      timeline,
      quality: qualityReport({ allSources: session.sources, reviewed, coverage: cov, gaps, freshness, staleMonths, now, ai }),
      ai,
    },
    checklist,
    sourceDates: Object.fromEntries(reviewed.map((s) => [s.id, s.dateInfo])),
  };
}
