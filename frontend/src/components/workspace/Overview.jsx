import { useEvidence } from './EvidenceContext.jsx';
import { ClaimQuote, Quote, SourceRef } from './Evidence.jsx';
import { Alert, Tag } from '../ui.jsx';
import { IMPORTANCE } from '../../utils/labels.js';

function AiSummary({ ai }) {
  if (!ai || ai.status === 'not_configured') {
    return (
      <Alert tone="info" title="AI review is not enabled on this server">
        All findings below come from transparent, rule-based text analysis. Nothing on this page was written by an AI model.
      </Alert>
    );
  }
  if (ai.status === 'error') {
    return (
      <Alert tone="warning" title="AI review was unavailable for this run">
        {ai.message} The rule-based findings are complete without it.
      </Alert>
    );
  }
  return (
    <section className="ai-block" aria-labelledby="ai-summary-heading">
      <div className="row">
        <h3 id="ai-summary-heading">AI summary</h3>
        <Tag tone="ai">AI-generated, not verified</Tag>
      </div>
      {ai.overview && <p>{ai.overview}</p>}
      {ai.keyPoints?.length > 0 && (
        <div className="stack-sm">
          <p className="small muted">
            Key points below include quotes that were checked word for word against the retrieved text.
            {ai.discardedStatements > 0 &&
              ` ${ai.discardedStatements} AI statement${ai.discardedStatements === 1 ? ' was' : 's were'} discarded because the quote could not be found in the source.`}
          </p>
          {ai.keyPoints.map((point) => (
            <div key={`${point.sourceId}-${point.quote}`} className="stack-sm">
              <p>
                <strong>{point.statement}</strong>
              </p>
              <Quote text={point.quote} sourceId={point.sourceId} label="Quote verified in source" />
            </div>
          ))}
        </div>
      )}
      <p className="small muted">Model: {ai.model}</p>
    </section>
  );
}

function CoverageTable({ coverage, reviewedIds }) {
  const { sourcesById } = useEvidence();
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="coverage-caption">
      <table className="table coverage">
        <caption id="coverage-caption" className="visually-hidden">
          Which reviewed sources mention each kind of information
        </caption>
        <thead>
          <tr>
            <th scope="col">Information</th>
            {reviewedIds.map((id) => (
              <th scope="col" key={id} title={sourcesById[id]?.title}>
                {sourcesById[id]?.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {coverage.map((row) => (
            <tr key={row.facet}>
              <th scope="row">
                {row.label}
                <span className="small muted"> · {IMPORTANCE[row.importance].label}</span>
              </th>
              {reviewedIds.map((id) => {
                const count = row.bySource[id] || 0;
                return (
                  <td key={id} className={count ? 'cell-found' : 'cell-missing'}>
                    {count ? `Found (${count})` : 'Not found'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Overview({ analysis }) {
  const reviewedIds = analysis.scope.reviewedSourceIds;
  const withEvidence = analysis.coverage.filter((row) => row.topClaimIds.length);

  return (
    <div className="stack overview">
      <AiSummary ai={analysis.ai} />

      <section className="stack-sm" aria-labelledby="coverage-heading">
        <h3 id="coverage-heading">Coverage across sources</h3>
        <p className="small muted">
          A cell reads “Found” when the source contains wording about that topic. It does not mean the information is complete
          or correct.
        </p>
        <CoverageTable coverage={analysis.coverage} reviewedIds={reviewedIds} />
      </section>

      <section className="stack" aria-labelledby="facts-heading">
        <div className="stack-sm">
          <h3 id="facts-heading">What the sources say</h3>
          <p className="small muted">
            Extracted word for word from the sources, grouped by topic. {analysis.totalClaimsExtracted} relevant sentences were
            found; the most specific are shown.
          </p>
        </div>
        {withEvidence.length === 0 ? (
          <p className="muted">No sentences matching the checked topics were found in the retrieved text.</p>
        ) : (
          withEvidence.map((row) => (
            <details key={row.facet} className="facet-group disclosure" open={row.importance === 'critical'}>
              <summary>
                {row.label} <span className="muted">({row.topClaimIds.length})</span>
              </summary>
              <div className="disclosure-body">
                {row.topClaimIds.map((id) => (
                  <ClaimQuote key={id} claimId={id} />
                ))}
              </div>
            </details>
          ))
        )}
      </section>

      {analysis.scope.notReviewedSourceIds.length > 0 && (
        <p className="small">
          <strong>Not reviewed:</strong>{' '}
          {analysis.scope.notReviewedSourceIds.map((id, i) => (
            <span key={id}>
              {i > 0 && ', '}
              <SourceRef sourceId={id} />
            </span>
          ))}{' '}
          could not be retrieved, so nothing from {analysis.scope.notReviewedSourceIds.length === 1 ? 'it' : 'them'} is included.
        </p>
      )}
    </div>
  );
}
