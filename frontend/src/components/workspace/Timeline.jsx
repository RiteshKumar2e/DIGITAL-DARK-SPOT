import { useEvidence } from './EvidenceContext.jsx';
import { SourceRef } from './Evidence.jsx';
import { Tag } from '../ui.jsx';
import { formatDate } from '../../utils/format.js';

/** Dates declared by sources and stated in their text, in order, with today's position marked. */
export default function Timeline({ timeline }) {
  const { claimsById } = useEvidence();
  if (!timeline) return null;
  const { events, undatedSourceIds, analysisDate } = timeline;
  const firstFuture = events.findIndex((e) => !e.past);

  return (
    <section className="stack-sm" aria-labelledby="timeline-heading">
      <h3 id="timeline-heading">Timeline</h3>
      <p className="small muted">
        Publication dates come from what each source declares; other dates are stated in the source text. Dates in the past are
        marked so you can spot old cycles.
      </p>
      {events.length === 0 ? (
        <p className="muted">No dates were declared by the sources or stated near deadlines.</p>
      ) : (
        <ol className="timeline">
          {events.map((e, i) => (
            <li key={`${e.sourceId}-${e.kind}-${e.date}-${i}`} className={e.past ? 'is-past' : 'is-future'}>
              {i === firstFuture && (
                <p className="timeline-today" aria-label={`Analysis date ${formatDate(analysisDate)}`}>
                  Analysis date: {formatDate(analysisDate)}
                </p>
              )}
              <div className="timeline-row">
                <time dateTime={e.date} className="timeline-date">
                  {formatDate(e.date)}
                </time>
                <div className="stack-sm">
                  <p className="row">
                    <strong>{e.label}</strong>
                    <SourceRef sourceId={e.sourceId} highlight={e.claimId ? claimsById[e.claimId]?.text : undefined} />
                    {e.past && <Tag tone="medium">In the past</Tag>}
                    {e.ambiguous && <Tag plain title="Written as a numeric date that can be read day-first or month-first">Ambiguous format</Tag>}
                  </p>
                  <p className="small muted">{e.origin}</p>
                </div>
              </div>
            </li>
          ))}
          {firstFuture === -1 && (
            <li className="is-future">
              <p className="timeline-today">Analysis date: {formatDate(analysisDate)} (after every date above)</p>
            </li>
          )}
        </ol>
      )}
      {undatedSourceIds.length > 0 && (
        <p className="small">
          <strong>Publication date not established:</strong>{' '}
          {undatedSourceIds.map((id, i) => (
            <span key={id}>
              {i > 0 && ', '}
              <SourceRef sourceId={id} />
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
