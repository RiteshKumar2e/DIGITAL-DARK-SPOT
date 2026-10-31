import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { researchApi } from '../services/researchApi.js';
import { rememberSession } from '../hooks/useRecentSessions.js';

/** Creates a sample session (simulated sources) and opens it. */
export default function SampleSessionButton({ className = 'btn btn-secondary', children = 'Open the sample session' }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function open() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { session } = await researchApi.createDemoSession();
      rememberSession(session);
      navigate(`/research/${session.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <span className="sample-button">
      <button type="button" className={className} onClick={open} disabled={busy}>
        {busy && <span className="spinner" aria-hidden="true" />}
        {busy ? 'Opening sample…' : children}
      </button>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
