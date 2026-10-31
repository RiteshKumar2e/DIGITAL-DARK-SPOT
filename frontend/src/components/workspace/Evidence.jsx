import { useEvidence } from './EvidenceContext.jsx';
import { Tag } from '../ui.jsx';
import { formatDate } from '../../utils/format.js';

/** Button that names a source and opens it in the inspector. */
export function SourceRef({ sourceId, highlight }) {
  const { sourcesById, openSource } = useEvidence();
  const source = sourcesById[sourceId];
  if (!source) return <span className="muted">Unknown source</span>;
  return (
    <button type="button" className="source-ref" onClick={() => openSource(sourceId, highlight)}>
      <span className="source-label">{source.label}</span>
      <span className="source-ref-name">{source.kind === 'sample' ? 'Simulated sample' : source.domain || source.title}</span>
    </button>
  );
}

/** A verbatim sentence from a source, with its citation. */
export function Quote({ text, sourceId, value, label = 'Source text', date }) {
  const { sourcesById } = useEvidence();
  const source = sourcesById[sourceId];
  return (
    <figure className="quote">
      <blockquote className="quote-text">
        <p>{value ? highlightValue(text, value) : text}</p>
      </blockquote>
      <figcaption className="quote-cite">
        <Tag tone="source">{label}</Tag>
        {source?.kind === 'sample' && <Tag tone="sample">Simulated</Tag>}
        <SourceRef sourceId={sourceId} highlight={text} />
        {date !== undefined && <span>{date ? `Source dated ${formatDate(date.value)}` : 'Source date unavailable'}</span>}
      </figcaption>
    </figure>
  );
}

function highlightValue(text, value) {
  const index = text.indexOf(value);
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{value}</mark>
      {text.slice(index + value.length)}
    </>
  );
}

export function ClaimQuote({ claimId }) {
  const { claimsById } = useEvidence();
  const claim = claimsById[claimId];
  if (!claim) return null;
  return <Quote text={claim.text} sourceId={claim.sourceId} />;
}
