import { useEvidence } from './EvidenceContext.jsx';
import { ClaimQuote, Quote, SourceRef } from './Evidence.jsx';
import { EmptyState, Tag } from '../ui.jsx';
import {
  CONTRADICTION_CLASS,
  FRESHNESS_SEVERITY,
  GAP_KIND,
  IMPORTANCE,
  SCOPE_LEVEL,
} from '../../utils/labels.js';
import { formatDate, formatNumber } from '../../utils/format.js';
import Timeline from './Timeline.jsx';

/** Marks findings produced by the AI; rule-engine findings carry no origin. */
const AiFindingTag = ({ item }) => (item.origin === 'ai' ? <Tag tone="ai">AI finding, quote verified</Tag> : null);

export function GapList({ gaps }) {
  const { sourcesById } = useEvidence();
  return (
    <div className="stack">
      {gaps.length === 0 ? (
        <EmptyState title="No potential gaps detected">
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
                  <AiFindingTag item={gap} />
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
                    {gap.origin === 'ai' ? (
                      <p className="small">
                        <strong>How it was found:</strong> an AI model read the full text of each reviewed source.
                      </p>
                    ) : (
                      <p className="small">
                        <strong>{gap.kind === 'question_term' ? 'Words looked for:' : 'Wording looked for:'}</strong>{' '}
                        {gap.searchedFor.map((term) => `“${term}”`).join(', ')}
                      </p>
                    )}
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
                    {gap.origin !== 'ai' && <p className="small muted">{gap.scope.note}</p>}
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
    </div>
  );
}

export function ContradictionList({ items }) {
  const { claimsById } = useEvidence();
  if (!items.length) {
    return (
      <EmptyState title="No conflicting values detected">
        No two sources stated different dates, amounts, ages, income limits or marks for the same item. Differences in wording
        that do not include an explicit value are not compared.
      </EmptyState>
    );
  }
  return (
    <ol className="finding-list">
      {items.map((item) => {
        const cls = CONTRADICTION_CLASS[item.classification];
        return (
          <li key={item.id} id={`finding-${item.id}`} className="finding">
            <div className="row finding-tags">
              <Tag tone={cls.tone}>{cls.label}</Tag>
              <Tag plain>{item.subject}</Tag>
              <AiFindingTag item={item} />
            </div>
            <h3 className="finding-title">
              {item.classification === 'list_difference'
                ? 'Sources list different required documents'
                : `${item.subject}: ${item.claimA.value} or ${item.claimB.value}?`}
            </h3>
            <p>{item.explanation}</p>
            <div className="versus">
              <Quote text={item.claimA.text} sourceId={item.claimA.sourceId} value={item.classification === 'list_difference' ? null : item.claimA.value} date={item.claimA.sourceDate} page={claimsById[item.claimA.claimId]?.page} />
              <span className="versus-mark" aria-hidden="true">
                vs
              </span>
              <Quote text={item.claimB.text} sourceId={item.claimB.sourceId} value={item.classification === 'list_difference' ? null : item.claimB.value} date={item.claimB.sourceDate} page={claimsById[item.claimB.claimId]?.page} />
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
          </li>
        );
      })}
    </ol>
  );
}

export function FreshnessList({ items, timeline, thresholdMonths }) {
  const { sourcesById } = useEvidence();
  return (
    <div className="stack">
      <p className="small muted">
        Freshness threshold for this type of research: {thresholdMonths} months. Sources older than this are flagged; undated sources
        are reported as “publication date not established”, not as outdated. The threshold is a warning rule: an old date does not prove the
        information is wrong, and a recent date does not prove it is right.
      </p>
      {items.length === 0 ? (
        <EmptyState title="No freshness warnings">
          Every reviewed source declares a date within the threshold and no stated deadline has passed.
        </EmptyState>
      ) : (
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
                  : 'The source declares no publication or update date.'}
              </p>
            )}
          </li>
        );
      })}
    </ol>
      )}
      <Timeline timeline={timeline} />
    </div>
  );
}
