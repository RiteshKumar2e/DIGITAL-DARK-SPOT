import { useEvidence } from './EvidenceContext.jsx';
import { ClaimQuote, Quote, SourceRef } from './Evidence.jsx';
import { Alert, Tag } from '../ui.jsx';
import { IMPORTANCE } from '../../utils/labels.js';
import { formatDateTime } from '../../utils/format.js';

const STATUS_TONE = { conflict: 'high', difference: 'medium', missing: 'high', unspecified: 'medium', single: 'low', covered: 'ok' };
const FINDING_TAB = (id) => (id?.startsWith('con_') ? 'contradiction' : 'gap');

/** Says which engine produced the findings: the AI, or the rule engine as a fallback. */
function AiSummary({ ai, method }) {
  if (method !== 'ai') {
    return !ai || ai.status === 'not_configured' ? (
      <Alert tone="info" title="Findings by the rule engine">
        AI analysis is not configured on this server, so the gaps and conflicts below come from keyword rules. Nothing on this page
        was written by an AI model.
      </Alert>
    ) : (
      <Alert tone="warning" title="AI analysis failed, so the rule engine took over">
        {ai.message} The gaps and conflicts below come from keyword rules, which can miss information phrased differently. Run the
        analysis again to retry the AI.
      </Alert>
    );
  }
  return (
    <section className="ai-block" aria-labelledby="ai-summary-heading">
      <div className="row">
        <h3 id="ai-summary-heading">AI analysis</h3>
        <Tag tone="ai">AI-generated, quotes verified</Tag>
      </div>
      <p className="small">
        The gaps and conflicts in this session were found by an AI model reading the full text of each source. Every quote they
        cite was matched word for word in the source; anything that could not be matched was dropped
        {ai.discardedStatements > 0 ? ` (${ai.discardedStatements} statement${ai.discardedStatements === 1 ? '' : 's'} this run)` : ''}.
        Dates, freshness and the coverage table are computed directly from the text.
      </p>
      {ai.overview && <p>{ai.overview}</p>}
      {ai.keyPoints?.length > 0 && (
        <div className="stack-sm">
          {ai.keyPoints.map((point, index) => (
            <div key={`${index}-${point.sourceId}`} className="stack-sm">
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

function Reproducibility({ analysis }) {
  const { sourcesById } = useEvidence();
  const snapshot = analysis.sourceSnapshot || {};
  return (
    <details className="disclosure reproducibility">
      <summary>Reproducibility details</summary>
      <div className="disclosure-body">
        <p className="small muted">
          Analysis engine {analysis.engine}, run {formatDateTime(analysis.runAt)}. A content fingerprint is recorded for each source,
          so a changed source can be told apart from a changed analysis.
          {analysis.method === 'ai' && ' AI findings can differ slightly between runs on the same sources; the rule engine always gives the same result.'}
        </p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Sources used by this analysis">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Status at analysis</th>
                <th scope="col">Retrieved</th>
                <th scope="col">Fingerprint</th>
                <th scope="col">Now</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(snapshot).map(([id, snap]) => {
                const source = sourcesById[id];
                const changed = source && source.contentHash && snap.contentHash && source.contentHash !== snap.contentHash;
                return (
                  <tr key={id}>
                    <th scope="row">{source ? source.label : 'Removed'}</th>
                    <td>{snap.status === 'retrieved' ? 'Reviewed' : 'Not retrieved'}</td>
                    <td>{snap.retrievedAt ? formatDateTime(snap.retrievedAt) : '—'}</td>
                    <td className="mono">{snap.contentHash ? snap.contentHash.slice(0, 10) : '—'}</td>
                    <td>{!source ? 'Removed since' : changed ? 'Changed since' : 'Unchanged'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

export default function Overview({ analysis, onGoToFinding }) {
  const reviewedIds = analysis.scope.reviewedSourceIds;
  const withEvidence = analysis.coverage.filter((row) => row.topClaimIds.length);

  return (
    <div className="stack overview">
      <AtAGlance analysis={analysis} onGoToFinding={onGoToFinding} />
      <AiSummary ai={analysis.ai} method={analysis.method} />

      <section className="stack-sm" aria-labelledby="coverage-heading">
        <h3 id="coverage-heading">Research coverage matrix</h3>
        <p className="small muted">
          “Found” means the source contains wording about that topic, not that it is complete or correct. Select a cell to see the
          passage, or a status to open the related finding.
        </p>
        <CoverageTable coverage={analysis.coverage} reviewedIds={reviewedIds} onGoToFinding={onGoToFinding} />
      </section>

      <QualityReport quality={analysis.quality} />
      <Reproducibility analysis={analysis} />

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
