import { useState } from 'react';
import { researchApi } from '../../services/researchApi.js';
import { Alert } from '../ui.jsx';

/** Exports the current session's actual results as Markdown or a printable page. */
export default function ExportBar({ sessionId, createdAt, stale }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function download() {
    setBusy(true);
    setMessage(null);
    try {
      const blob = await researchApi.downloadReport(sessionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `digital-dark-spot-report-${createdAt.slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage({ tone: 'success', text: 'Report downloaded as Markdown.' });
    } catch (error) {
      setMessage({ tone: 'error', text: `The report could not be exported: ${error.message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="export-bar">
      <div className="row">
        <span className="small muted">Export this analysis{stale ? ' (from the last run; re-run to include recent changes)' : ''}:</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={download} disabled={busy}>
          {busy ? 'Preparing…' : 'Download report (.md)'}
        </button>
        <a className="btn btn-secondary btn-sm" href={researchApi.printableReportUrl(sessionId)} target="_blank" rel="noopener noreferrer">
          Printable report<span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      </div>
      <div aria-live="polite">{message && <Alert tone={message.tone} role="none">{message.text}</Alert>}</div>
    </div>
  );
}
