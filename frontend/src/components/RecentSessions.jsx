import { Link } from 'react-router-dom';
import { useRecentSessions } from '../hooks/useRecentSessions.js';
import { formatDate } from '../utils/format.js';
import { Tag } from './ui.jsx';

export default function RecentSessions() {
  const { sessions, forget, clear } = useRecentSessions();

  return (
    <section className="recent" aria-labelledby="recent-heading">
      <div className="section-head">
        <h2 id="recent-heading">Your sessions on this device</h2>
        {sessions.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
            Clear list
          </button>
        )}
      </div>
      {sessions.length === 0 ? (
        <p className="muted small">
          Sessions you start will be listed here so you can come back to them. The list is stored only in this browser.
        </p>
      ) : (
        <ul className="recent-list">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link to={`/research/${session.id}`} className="recent-link">
                <span className="recent-question">{session.question}</span>
                <span className="row small muted">
                  {session.demo && <Tag tone="sample">Sample</Tag>}
                  Started {formatDate(session.createdAt)}
                </span>
              </Link>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => forget(session.id)}
                aria-label={`Remove “${session.question}” from this list`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
