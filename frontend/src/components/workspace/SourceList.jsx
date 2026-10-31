import { useState } from 'react';
import { researchApi } from '../../services/researchApi.js';
import { formatDate, formatNumber, safeHref } from '../../utils/format.js';
import { SOURCE_STATUS } from '../../utils/labels.js';
import { Alert, EmptyState, Tag } from '../ui.jsx';
import { useEvidence } from './EvidenceContext.jsx';

function SourceDate({ source }) {
  const best = source.modified || source.published;
  if (source.status !== 'retrieved') return null;
  if (!best) return <span>Date unavailable</span>;
  return (
    <span title={best.origin}>
      {source.modified ? 'Updated' : 'Published'} {formatDate(best.value)}
    </span>
  );
}

function SourceItem({ source, sessionId, demo, onChange }) {
  const { openSource } = useEvidence();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const status = SOURCE_STATUS[source.status] || SOURCE_STATUS.failed;
  const href = safeHref(source.finalUrl || source.url);

  async function run(kind, fn) {
    setBusy(kind);
    setError('');
    try {
      const result = await fn();
      onChange(result.session);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className={`source-item is-${source.status}`}>
      <div className="source-item-head">
        <span className="source-label" aria-hidden="true">
          {source.label}
        </span>
        <div className="source-item-main">
          <h3 className="source-title">
            <span className="visually-hidden">{source.label}: </span>
            {source.title || source.domain || 'Untitled source'}
          </h3>
          {href ? (
            <a className="url" href={href} target="_blank" rel="noopener noreferrer nofollow">
              {href}
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          ) : (
            <span className="url">{source.kind === 'sample' ? 'Simulated document: no real web address' : 'Pasted text: origin not verified'}</span>
          )}
        </div>
      </div>

      <div className="row small muted source-meta">
        <Tag tone={status.tone}>{status.label}</Tag>
        {source.kind === 'sample' && <Tag tone="sample">Simulated</Tag>}
        {source.kind === 'text' && <Tag plain>Pasted by you</Tag>}
        {source.analyzedAt && source.status === 'retrieved' && <Tag tone="ok">Analysed</Tag>}
        {source.status === 'retrieved' && <span>{formatNumber(source.wordCount)} words</span>}
        <SourceDate source={source} />
        {source.textTruncated && <span>Long page: only the first part was kept</span>}
      </div>

      {source.status === 'failed' && source.error && (
        <p className="source-error small">
          <strong>Why it was not retrieved:</strong> {source.error.message}
        </p>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="row source-actions">
        {source.status === 'retrieved' && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openSource(source.id)}>
            Inspect text
          </button>
        )}
        {source.status === 'failed' && source.kind === 'url' && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={Boolean(busy)}
            onClick={() => run('retry', () => researchApi.retrySource(sessionId, source.id))}
          >
            {busy === 'retry' ? 'Retrying…' : 'Try again'}
          </button>
        )}
        {!demo && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={Boolean(busy)}
            aria-label={`Remove source ${source.label}`}
            onClick={() => run('remove', async () => ({ session: (await researchApi.removeSource(sessionId, source.id)).session }))}
          >
            {busy === 'remove' ? 'Removing…' : 'Remove'}
          </button>
        )}
      </div>
    </li>
  );
}

export default function SourceList({ sessionId, demo, onChange }) {
  const { sourcesById } = useEvidence();
  const sources = Object.values(sourcesById);
  if (!sources.length) {
    return (
      <EmptyState title="No sources yet">
        Add the pages you found while researching: an official notice, a news article, a blog post. Two or more sources let
        the analysis compare them.
      </EmptyState>
    );
  }
  return (
    <ul className="source-list">
      {sources.map((source) => (
        <SourceItem key={source.id} source={source} sessionId={sessionId} demo={demo} onChange={onChange} />
      ))}
    </ul>
  );
}
