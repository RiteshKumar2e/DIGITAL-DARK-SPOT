import { useEvidence } from './EvidenceContext.jsx';
import { ClaimQuote, Quote, SourceRef } from './Evidence.jsx';
import { Alert, Tag } from '../ui.jsx';
import { IMPORTANCE } from '../../utils/labels.js';

const STATUS_TONE = { conflict: 'high', difference: 'medium', missing: 'high', unspecified: 'medium', single: 'low', covered: 'ok' };
const FINDING_TAB = (id) => (id?.startsWith('con_') ? 'contradiction' : 'gap');

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

function AtAGlance({ analysis, onGoToFinding }) {
  const openGaps = analysis.gaps.filter((g) => g.kind !== 'single_source').slice(0, 4);
  const conflicts = analysis.contradictions.filter((c) => ['possible_conflict', 'list_difference'].includes(c.classification)).slice(0, 3);
  if (!openGaps.length && !conflicts.length) {
    return (
      <Alert tone="success" title="No open gaps or conflicting values were detected">
        This covers only the topics checked for this research type, within the reviewed sources. Review the coverage below before
        relying on it.
      </Alert>
    );
  }
  return (
    <section className="glance" aria-labelledby="glance-heading">
      <h3 id="glance-heading">Needs your attention</h3>
      <div className="glance-grid">
        {openGaps.length > 0 && (
          <div>
            <p className="eyebrow">Unanswered in the sources reviewed</p>
            <ul>
              {openGaps.map((g) => (
                <li key={g.id}>
                  <button type="button" className="link-button" onClick={() => onGoToFinding('gap', g.id)}>
                    {g.label}
                  </button>{' '}
                  <span className="small muted">({IMPORTANCE[g.importance].label.toLowerCase()})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {conflicts.length > 0 && (
          <div>
            <p className="eyebrow">Sources disagree</p>
            <ul>
              {conflicts.map((c) => (
                <li key={c.id}>
                  <button type="button" className="link-button" onClick={() => onGoToFinding('contradiction', c.id)}>
                    {c.subject}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function QualityReport({ quality }) {
  if (!quality) return null;
  return (
    <section className="stack-sm" aria-labelledby="quality-heading">
      <div className="row">
        <h3 id="quality-heading">Investigation quality</h3>
        <Tag tone={quality.attention ? 'warning' : 'ok'}>
          {quality.attention ? `${quality.attention} point${quality.attention === 1 ? '' : 's'} to strengthen` : 'No weak points detected'}
        </Tag>
      </div>
      <p className="small muted">How much the findings can be relied on, factor by factor. There is deliberately no single score.</p>
      <dl className="quality-list">
        {quality.factors.map((f) => (
          <div key={f.key} className={f.ok ? 'is-ok' : 'is-attention'}>
            <dt>
              <span className="quality-mark" aria-hidden="true">{f.ok ? '✓' : '!'}</span>
              {f.label}
              <span className="visually-hidden">{f.ok ? ' (fine)' : ' (needs attention)'}</span>
            </dt>
            <dd>
              <strong>{f.value}</strong>
              <span className="small muted"> · {f.explanation}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function CoverageTable({ coverage, reviewedIds, onGoToFinding }) {
  const { sourcesById, claimsById, openSource } = useEvidence();
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="coverage-caption">
      <table className="table coverage">
        <caption id="coverage-caption" className="visually-hidden">
          Research coverage matrix: which reviewed sources mention each topic, and the overall status
        </caption>
        <thead>
          <tr>
            <th scope="col">Topic</th>
            {reviewedIds.map((id) => (
              <th scope="col" key={id} title={sourcesById[id]?.title}>
                {sourcesById[id]?.label}
                {sourcesById[id]?.officialSignal ? <span className="small muted"> · official domain</span> : null}
              </th>
            ))}
            <th scope="col">Status</th>
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
                const claim = claimsById[row.firstClaimBySource?.[id]];
                return (
                  <td key={id} className={count ? 'cell-found' : 'cell-missing'}>
                    {count && claim ? (
                      <button
                        type="button"
                        className="cell-button"
                        onClick={() => openSource(id, claim.text)}
                        aria-label={`${row.label} in ${sourcesById[id]?.label}: found ${count}. Show evidence`}
                      >
                        Found ({count})
                      </button>
                    ) : count ? (
                      `Found (${count})`
                    ) : (
                      'Not found'
                    )}
                  </td>
                );
              })}
              <td>
                {row.relatedFindingId ? (
                  <button type="button" className="cell-button" onClick={() => onGoToFinding(FINDING_TAB(row.relatedFindingId), row.relatedFindingId)}>
                    <Tag tone={STATUS_TONE[row.status]}>{row.statusLabel}</Tag>
                  </button>
                ) : (
                  <Tag tone={STATUS_TONE[row.status]}>{row.statusLabel}</Tag>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Overview({ analysis, onGoToFinding }) {
  const reviewedIds = analysis.scope.reviewedSourceIds;
  const withEvidence = analysis.coverage.filter((row) => row.topClaimIds.length);

  return (
    <div className="stack overview">
      <AtAGlance analysis={analysis} onGoToFinding={onGoToFinding} />
      <AiSummary ai={analysis.ai} />

      <section className="stack-sm" aria-labelledby="coverage-heading">
        <h3 id="coverage-heading">Research coverage matrix</h3>
        <p className="small muted">
          “Found” means the source contains wording about that topic, not that it is complete or correct. Select a cell to see the
          passage, or a status to open the related finding.
        </p>
        <CoverageTable coverage={analysis.coverage} reviewedIds={reviewedIds} onGoToFinding={onGoToFinding} />
      </section>

      <QualityReport quality={analysis.quality} />

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
