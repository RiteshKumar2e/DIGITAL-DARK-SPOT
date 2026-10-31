import { useEffect, useRef, useState } from 'react';
import { researchApi } from '../../services/researchApi.js';
import { formatDate, formatDateTime, formatNumber, safeHref } from '../../utils/format.js';
import { Alert, SkeletonLines, Tag } from '../ui.jsx';

function DateRow({ label, date }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{date ? `${formatDate(date.value)} · ${date.origin}` : 'Date unavailable'}</dd>
    </div>
  );
}

/** Renders the retrieved text with the cited passage highlighted. */
function SourceText({ text, highlight }) {
  const markRef = useRef(null);
  const index = highlight ? text.indexOf(highlight) : -1;

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: 'center' });
  }, [index]);

  const renderParas = (chunk, keyPrefix) =>
    chunk.split('\n').map((line, i, arr) => (
      <span key={`${keyPrefix}${i}`}>
        {line}
        {i < arr.length - 1 && <br />}
      </span>
    ));

  return (
    <div className="source-text" tabIndex={0} aria-label="Retrieved text">
      {index === -1 ? (
        renderParas(text, 'all')
      ) : (
        <>
          {renderParas(text.slice(0, index), 'a')}
          <mark ref={markRef}>{text.slice(index, index + highlight.length)}</mark>
          {renderParas(text.slice(index + highlight.length), 'b')}
        </>
      )}
    </div>
  );
}

export default function SourceDialog({ sessionId, target, label, onClose }) {
  const dialogRef = useRef(null);
  const [state, setState] = useState({ status: 'loading', source: null, error: null });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (target && dialog && !dialog.open) dialog.showModal();
    if (!target && dialog?.open) dialog.close();
  }, [target]);

  useEffect(() => {
    if (!target) return undefined;
    const controller = new AbortController();
    setState({ status: 'loading', source: null, error: null });
    researchApi
      .getSource(sessionId, target.sourceId, controller.signal)
      .then(({ source }) => setState({ status: 'ready', source, error: null }))
      .catch((error) => error.name !== 'AbortError' && setState({ status: 'error', source: null, error }));
    return () => controller.abort();
  }, [sessionId, target]);

  const source = target ? state.source : null;
  const href = source ? safeHref(source.finalUrl || source.url) : null;

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="source-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current.close();
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-head">
          <div className="stack-sm">
            <p className="eyebrow">Source {label} · evidence inspector</p>
            <h2 id="source-dialog-title" className="dialog-title">
              {source?.title || 'Loading source…'}
            </h2>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => dialogRef.current?.close()}>
            Close
          </button>
        </div>
        <div className="dialog-body">
          {state.status === 'loading' && <SkeletonLines count={6} />}
          {state.status === 'error' && <Alert tone="error" title="The source could not be loaded">{state.error.message}</Alert>}
          {source && (
            <>
              {source.kind === 'sample' && (
                <Alert tone="sample" title="Simulated sample document">
                  This text was written for the demonstration. It is not a real web page and its dates are simulated.
                </Alert>
              )}
              {source.kind === 'text' && (
                <Alert tone="info" title="Pasted text">
                  This text was pasted into the session. Its origin and accuracy have not been verified.
                </Alert>
              )}
              <dl className="meta-grid">
                <div>
                  <dt>Address</dt>
                  <dd>
                    {href ? (
                      <a className="url" href={href} target="_blank" rel="noopener noreferrer nofollow">
                        {href}
                        <span className="visually-hidden"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      'No web address'
                    )}
                  </dd>
                </div>
                <DateRow label="Published" date={source.published} />
                <DateRow label="Last updated" date={source.modified} />
                {source.serverDate && <DateRow label="Server date" date={source.serverDate} />}
                <div>
                  <dt>Retrieved</dt>
                  <dd>{source.retrievedAt ? formatDateTime(source.retrievedAt) : 'Not retrieved'}</dd>
                </div>
                <div>
                  <dt>Extracted text</dt>
                  <dd>
                    {formatNumber(source.wordCount)} words{source.textTruncated ? ' (truncated: long page)' : ''}
                  </dd>
                </div>
              </dl>
              {target?.highlight && (
                <p className="small">
                  <Tag tone="source">Source text</Tag> The cited passage is highlighted below.
                  {source.text && !source.text.includes(target.highlight) && ' (It could not be located exactly in the stored text.)'}
                </p>
              )}
              {source.text ? (
                <SourceText text={source.text} highlight={target?.highlight} />
              ) : (
                <p className="muted">No text was retrieved from this source.</p>
              )}
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
