import { useEvidence } from './EvidenceContext.jsx';
import { ClaimQuote, Quote, SourceRef } from './Evidence.jsx';
import { EmptyState, Tag } from '../ui.jsx';
import {
  AI_ASSESSMENT,
  CONTRADICTION_CLASS,
  FRESHNESS_SEVERITY,
  GAP_KIND,
  IMPORTANCE,
  SCOPE_LEVEL,
} from '../../utils/labels.js';
import { formatDate, formatNumber } from '../../utils/format.js';

export function GapList({ gaps, aiGaps }) {
  const { sourcesById } = useEvidence();
  return (
    <div className="stack">
      {gaps.length === 0 ? (
        <EmptyState title="No potential gaps detected by the rule checks">
          Every kind of information checked for this research type was found in at least one source. This does not guarantee
          completeness. Review the coverage table on the Overview tab.
        </EmptyState>
      ) : (
        <ol className="finding-list">
          {gaps.map((gap) => {
            const importance = IMPORTANCE[gap.importance];
            return (
              <li key={gap.id} id={`finding-${gap.id}`} className="finding">
                <div className="row finding-tags">
                  <Tag tone={importance.tone}>{importance.label}</Tag>
                  <Tag plain>{GAP_KIND[gap.kind]}</Tag>
                  <Tag plain title={gap.scope.note}>
                    {SCOPE_LEVEL[gap.scope.level]}
                  </Tag>
                </div>
                <h3 className="finding-title">{gap.title}</h3>
                <p>{gap.detail}</p>
                <dl className="finding-facts">
                  <div>
                    <dt>Why it matters</dt>
                    <dd>{gap.whyItMatters}</dd>
                  </div>
                  <div>
                    <dt>Suggested next step</dt>
                    <dd>{gap.nextStep}</dd>
                  </div>
                </dl>
                <details className="disclosure">
                  <summary>Evidence and search scope</summary>
                  <div className="disclosure-body">
                    <p className="small">
                      <strong>Sources reviewed:</strong>{' '}
                      {gap.reviewedSourceIds.map((id, i) => (
                        <span key={id}>
                          {i > 0 && ', '}
                          <SourceRef sourceId={id} />
                        </span>
                      ))}{' '}
                      ({formatNumber(gap.scope.wordCount)} words in total).
                    </p>
                    <p className="small">
                      <strong>{gap.kind === 'question_term' ? 'Words looked for:' : 'Wording looked for:'}</strong>{' '}
                      {gap.searchedFor.map((term) => `“${term}”`).join(', ')}
                    </p>
                    {gap.evidenceClaimIds.length > 0 && (
                      <div className="stack-sm">
                        <p className="small">
                          <strong>Related passages found:</strong>
                        </p>
                        {gap.evidenceClaimIds.map((id) => (
                          <ClaimQuote key={id} claimId={id} />
                        ))}
                      </div>
                    )}
                    <p className="small muted">{gap.scope.note}</p>
                    {Object.values(sourcesById).some((s) => s.status !== 'retrieved') && (
                      <p className="small muted">Sources that could not be retrieved were not searched.</p>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      )}

      {aiGaps?.length > 0 && (
        <section className="ai-block" aria-labelledby="ai-gaps-heading">
          <div className="row">
            <h3 id="ai-gaps-heading">Further possible gaps suggested by AI</h3>
            <Tag tone="ai">AI-generated, unverified</Tag>
          </div>
          <p className="small muted">These are suggestions from a language model based on the same sources. They are not backed by quoted evidence.</p>
          <ul className="ai-list">
            {aiGaps.map((gap) => (
              <li key={gap.topic}>
                <strong>{gap.topic}</strong>
                {gap.whyItMatters && <p className="small">{gap.whyItMatters}</p>}
                <p className="small">
                  <span className="muted">Next step:</span> {gap.nextStep}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function ContradictionList({ items, aiReviews }) {
  if (!items.length) {
    return (
      <EmptyState title="No conflicting values detected">
        No two sources stated different dates, amounts, ages, income limits or marks for the same item. Differences in wording
        that do not include an explicit value are not compared.
      </EmptyState>
    );
  }
  const reviews = Object.fromEntries((aiReviews || []).map((r) => [r.findingId, r]));
  return (
    <ol className="finding-list">
      {items.map((item) => {
        const cls = CONTRADICTION_CLASS[item.classification];
        const review = reviews[item.id];
        return (
          <li key={item.id} id={`finding-${item.id}`} className="finding">
            <div className="row finding-tags">
              <Tag tone={cls.tone}>{cls.label}</Tag>
              <Tag plain>{item.subject}</Tag>
            </div>
            <h3 className="finding-title">
              {item.classification === 'list_difference'
                ? 'Sources list different required documents'
                : `${item.subject}: ${item.claimA.value} or ${item.claimB.value}?`}
            </h3>
            <p>{item.explanation}</p>
            <div className="versus">
              <Quote text={item.claimA.text} sourceId={item.claimA.sourceId} value={item.classification === 'list_difference' ? null : item.claimA.value} date={item.claimA.sourceDate} />
              <span className="versus-mark" aria-hidden="true">
                vs
              </span>
              <Quote text={item.claimB.text} sourceId={item.claimB.sourceId} value={item.classification === 'list_difference' ? null : item.claimB.value} date={item.claimB.sourceDate} />
            </div>
            <dl className="finding-facts">
              <div>
                <dt>Why they may differ</dt>
                <dd>
                  <ul>
                    {item.possibleReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt>Recommendation</dt>
                <dd>{item.recommendation}</dd>
              </div>
            </dl>
            {review && (
              <div className="ai-note">
                <Tag tone="ai">{AI_ASSESSMENT[review.assessment]}</Tag>
                {review.explanation && <p className="small">{review.explanation}</p>}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function FreshnessList({ items }) {
  const { sourcesById } = useEvidence();
  if (!items.length) {
    return (
      <EmptyState title="No freshness warnings">
        Every reviewed source declares a date within the last 12 months and no stated deadline has passed.
      </EmptyState>
    );
  }
  return (
    <ol className="finding-list">
      {items.map((item) => {
        const sev = FRESHNESS_SEVERITY[item.severity];
        const source = sourcesById[item.sourceId];
        return (
          <li key={item.id} id={`finding-${item.id}`} className="finding">
            <div className="row finding-tags">
              <Tag tone={sev.tone}>{sev.label}</Tag>
              <SourceRef sourceId={item.sourceId} />
              {source?.kind === 'sample' && <Tag tone="sample">Simulated date</Tag>}
            </div>
            <h3 className="finding-title">{item.title}</h3>
            <p>{item.explanation}</p>
            {item.evidence?.quote ? (
              <Quote text={item.evidence.quote} sourceId={item.sourceId} />
            ) : (
              <p className="small muted">
                {item.evidence?.date
                  ? `Date used: ${formatDate(item.evidence.date)} (${item.evidence.origin}).`
                  : 'No declared publication or update date was found in the page metadata.'}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
