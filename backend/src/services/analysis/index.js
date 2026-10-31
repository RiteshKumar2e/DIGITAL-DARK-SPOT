import { FACETS, PROFILES, detectProfile } from './profiles.js';
import { extractClaims } from './claims.js';
import { detectGaps, evidenceScope } from './gaps.js';
import { detectContradictions, detectDocumentDifferences } from './contradictions.js';
import { detectFreshness, sourceDateInfo } from './freshness.js';
import { buildChecklist } from './checklist.js';
import { runAiReview } from '../ai.service.js';

export const ENGINE_VERSION = 'rules-1.0';

function coverage(profile, claims, sources) {
  return profile.facets.map((spec) => {
    const facetClaims = claims.filter((c) => c.facets.includes(spec.key));
    const bySource = Object.fromEntries(sources.map((s) => [s.id, facetClaims.filter((c) => c.sourceId === s.id).length]));
    const top = [...facetClaims]
      .sort((a, b) => Object.keys(b.values).length - Object.keys(a.values).length || b.relevance - a.relevance)
      .slice(0, 4)
      .map((c) => c.id);
    return { facet: spec.key, label: FACETS[spec.key].label, importance: spec.importance, bySource, topClaimIds: top };
  });
}

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

  for (const source of reviewed) source.dateInfo = sourceDateInfo(source, now);
  const sourcesById = Object.fromEntries(reviewed.map((s) => [s.id, s]));

  const claims = reviewed.flatMap((s) => extractClaims(s, facetKeys, session.question));
  const gaps = detectGaps({ profile, sources: reviewed, claims, question: session.question });
  const contradictions = [
    ...detectContradictions({ claims, sourcesById, facetKeys }),
    ...detectDocumentDifferences({ claims, sourcesById, facetKeys }),
  ];
  const freshness = detectFreshness({ sources: reviewed, claims, now });

  const ai = await runAiReview({
    question: session.question,
    profileLabel: profile.label,
    sources: reviewed,
    gaps,
    contradictions,
  });

  const checklist = buildChecklist({ gaps, contradictions, freshness, sourcesById, previous: session.checklist || [] });

  // Keep only claims referenced by findings or coverage, to keep the payload small.
  const cov = coverage(profile, claims, reviewed);
  const referenced = new Set([
    ...cov.flatMap((c) => c.topClaimIds),
    ...gaps.flatMap((g) => g.evidenceClaimIds),
    ...contradictions.flatMap((c) => [c.claimA.claimId, c.claimB.claimId]),
    ...freshness.filter((f) => f.claimId).map((f) => f.claimId),
  ]);

  return {
    analysis: {
      runAt: now.toISOString(),
      engine: ENGINE_VERSION,
      profile: { key: profileKey, label: profile.label, detected: session.profile === 'auto' },
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
      ai,
    },
    checklist,
    sourceDates: Object.fromEntries(reviewed.map((s) => [s.id, s.dateInfo])),
  };
}
