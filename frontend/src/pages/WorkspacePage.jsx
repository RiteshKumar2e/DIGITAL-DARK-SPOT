import { useCallback, useId, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { forgetSession } from '../hooks/useRecentSessions.js';
import { researchApi } from '../services/researchApi.js';
import { EvidenceContext, buildSourceIndex } from '../components/workspace/EvidenceContext.jsx';
import AddSourceForm from '../components/workspace/AddSourceForm.jsx';
import SourceList from '../components/workspace/SourceList.jsx';
import SourceDialog from '../components/workspace/SourceDialog.jsx';
import Findings, { TAB_FOR_TYPE } from '../components/workspace/Findings.jsx';
import { Alert, EmptyState, FieldError, SkeletonLines, Tag } from '../components/ui.jsx';
import { PROFILE_OPTIONS } from '../utils/labels.js';
import { formatDateTime, formatNumber, plural } from '../utils/format.js';

function QuestionEditor({ session, onSaved, onCancel }) {
  const [value, setValue] = useState(session.question);
  const [profile, setProfile] = useState(session.profile);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ids = { q: useId(), err: useId(), p: useId() };

  async function save(event) {
    event.preventDefault();
    if (value.trim().length < 10) return setError('Describe your question in at least 10 characters.');
    setBusy(true);
    setError('');
    try {
      const { session: updated } = await researchApi.updateSession(session.id, { question: value.trim(), profile });
      onSaved(updated);
    } catch (err) {
      setError(err.fields?.question || err.message);
      setBusy(false);
    }
  }

  return (
    <form className="question-editor stack-sm" onSubmit={save} noValidate>
      <label className="label" htmlFor={ids.q}>Research question</label>
      <textarea id={ids.q} className="textarea" rows={3} value={value} onChange={(e) => setValue(e.target.value)}
        aria-invalid={Boolean(error)} aria-describedby={error ? ids.err : undefined} />
      <FieldError id={ids.err} message={error} />
      <label className="label" htmlFor={ids.p}>Type of research</label>
      <select id={ids.p} className="select" value={profile} onChange={(e) => setProfile(e.target.value)}>
        {PROFILE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <div className="row">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save question'}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

function AnalysisStatus({ session, analyzing, onAnalyze, error }) {
  const retrieved = session.sources.filter((s) => s.status === 'retrieved').length;
  const failed = session.sources.length - retrieved;
  const { analysis } = session;

  return (
    <div className="analysis-bar">
      <div className="stack-sm">
        <h2 id="analysis-heading">Analysis</h2>
        {analysis ? (
          <p className="small muted">
            Last run {formatDateTime(analysis.runAt)} · {analysis.profile.label}
            {analysis.profile.detected ? ' (detected from your question)' : ''}
          </p>
        ) : (
          <p className="small muted">
            {retrieved ? `${plural(retrieved, 'source')} ready to review.` : 'Add at least one source to begin.'}
          </p>
        )}
      </div>
      <button type="button" className="btn btn-primary" onClick={onAnalyze} disabled={analyzing || retrieved === 0}
        aria-describedby={retrieved === 0 ? 'analyze-hint' : undefined}>
        {analyzing && <span className="spinner" aria-hidden="true" />}
        {analyzing ? 'Analysing…' : analysis ? 'Run analysis again' : 'Run analysis'}
      </button>
      {retrieved === 0 && <p id="analyze-hint" className="visually-hidden">Add a source that can be retrieved first.</p>}
      <div className="analysis-messages" aria-live="polite">
        {analyzing && (
          <Alert tone="info" role="none" title={`Reviewing ${plural(retrieved, 'source')}…`}>
            Extracting statements, comparing sources and checking dates. This usually takes a few seconds
            {session.analysis?.ai?.status === 'ok' ? ', longer with AI review' : ''}.
          </Alert>
        )}
        {error && <Alert tone="error" title="The analysis could not be completed">{error}</Alert>}
        {!analyzing && session.analysisStale && analysis && (
          <Alert tone="warning" role="none" title="Sources or question changed since the last analysis">
            Run the analysis again to update the findings. Checklist progress is kept.
          </Alert>
        )}
        {!analyzing && failed > 0 && retrieved > 0 && !analysis && (
          <p className="small muted">{plural(failed, 'source')} could not be retrieved and will not be reviewed.</p>
        )}
      </div>
    </div>
  );
}

function ScopeSummary({ analysis, sourceCount }) {
  const { scope } = analysis;
  const conflicts = analysis.contradictions.filter((c) => ['possible_conflict', 'list_difference'].includes(c.classification)).length;
  return (
    <div className="scope-summary">
      <p>
        Reviewed <strong>{scope.sourceCount} of {sourceCount}</strong> sources ({formatNumber(scope.wordCount)} words).{' '}
        {scope.level === 'limited' && <strong>Evidence is limited: </strong>}
        {scope.note}
      </p>
      <dl className="stat-row">
        <div><dt>Potential gaps</dt><dd>{analysis.gaps.length}</dd></div>
        <div><dt>Possible contradictions</dt><dd>{conflicts}</dd></div>
        <div><dt>Other value differences</dt><dd>{analysis.contradictions.length - conflicts}</dd></div>
        <div><dt>Freshness warnings</dt><dd>{analysis.freshness.filter((f) => f.severity !== 'info').length}</dd></div>
      </dl>
    </div>
  );
}

export default function WorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { status, session, error, setSession, reload } = useSession(id);
  const [editing, setEditing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [inspect, setInspect] = useState(null);
  const [deleting, setDeleting] = useState(false);

  usePageMeta({ title: 'Research session', description: 'A private Digital Dark Spot research session.', noindex: true });

  const sourcesById = useMemo(() => buildSourceIndex(session?.sources || []), [session?.sources]);
  const claimsById = useMemo(
    () => Object.fromEntries((session?.analysis?.claims || []).map((c) => [c.id, c])),
    [session?.analysis?.claims],
  );
  const openSource = useCallback((sourceId, highlight) => setInspect({ sourceId, highlight }), []);
  const evidence = useMemo(() => ({ sourcesById, claimsById, openSource }), [sourcesById, claimsById, openSource]);

  async function analyze() {
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const { session: updated } = await researchApi.analyze(session.id);
      setSession(updated);
      setActiveTab('overview');
      document.getElementById('results')?.focus();
    } catch (err) {
      setAnalyzeError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function deleteSession() {
    if (!window.confirm('Delete this research session and its sources from the server? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await researchApi.deleteSession(session.id);
      forgetSession(session.id);
      navigate('/research', { replace: true });
    } catch (err) {
      setDeleting(false);
      window.alert(`The session could not be deleted: ${err.message}`);
    }
  }

  function goToFinding(type, findingId) {
    setActiveTab(TAB_FOR_TYPE[type]);
    requestAnimationFrame(() => {
      const el = document.getElementById(`finding-${findingId}`);
      el?.scrollIntoView({ block: 'start' });
      el?.setAttribute('tabindex', '-1');
      el?.focus({ preventScroll: true });
    });
  }

  if (status === 'loading') {
    return (
      <div className="container workspace-loading" aria-busy="true">
        <p className="visually-hidden" role="status">Loading research session</p>
        <SkeletonLines count={2} />
        <div className="workspace-grid"><div className="panel"><SkeletonLines count={5} /></div><div className="panel"><SkeletonLines count={7} /></div></div>
      </div>
    );
  }

  if (status === 'error') {
    const missing = error?.status === 404;
    if (missing) forgetSession(id);
    return (
      <div className="container narrow-page">
        <EmptyState
          title={missing ? 'This research session does not exist' : 'The session could not be loaded'}
          action={
            <div className="row">
              {!missing && <button type="button" className="btn btn-secondary" onClick={reload}>Try again</button>}
              <Link to="/research" className="btn btn-primary">Start a new session</Link>
            </div>
          }
        >
          {missing ? 'It may have been deleted, or it expired after the retention period.' : error?.message}
        </EmptyState>
      </div>
    );
  }

  const remaining = session.limits.maxSources - session.sources.length;

  return (
    <EvidenceContext.Provider value={evidence}>
      <div className="container workspace">
        <header className="session-header">
          <p className="eyebrow">Research session {session.demo && <Tag tone="sample">Sample data</Tag>}</p>
          {editing ? (
            <QuestionEditor session={session} onCancel={() => setEditing(false)} onSaved={(s) => { setSession(s); setEditing(false); }} />
          ) : (
            <>
              <h1 className="session-question">{session.question}</h1>
              {!session.demo && (
                <button type="button" className="link-button small" onClick={() => setEditing(true)}>Edit question or research type</button>
              )}
            </>
          )}
          {session.demo && (
            <Alert tone="sample" title="You are viewing a sample session with simulated sources">
              The three documents are invented for demonstration: the scholarship, the organisations and the dates are not
              real. <Link to="/research">Start your own session</Link> to analyse real pages.
            </Alert>
          )}
        </header>

        <div className="workspace-grid">
          <aside className="panel sources-panel" aria-labelledby="sources-heading">
            <div className="section-head">
              <h2 id="sources-heading">Sources <span className="muted">({session.sources.length})</span></h2>
            </div>
            {!session.demo && (
              remaining > 0 ? (
                <AddSourceForm sessionId={session.id} onAdded={setSession} disabled={analyzing} remaining={remaining} />
              ) : (
                <Alert tone="info">This session has the maximum of {session.limits.maxSources} sources. Remove one to add another.</Alert>
              )
            )}
            <SourceList sessionId={session.id} demo={session.demo} onChange={setSession} />
            <div className="danger-zone">
              <button type="button" className="btn btn-danger btn-sm" onClick={deleteSession} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete this session'}
              </button>
            </div>
          </aside>

          <section className="panel results-panel" aria-labelledby="analysis-heading">
            <AnalysisStatus session={session} analyzing={analyzing} onAnalyze={analyze} error={analyzeError} />
            <div id="results" tabIndex={-1} className="results">
              {session.analysis ? (
                <>
                  <ScopeSummary analysis={session.analysis} sourceCount={session.sources.length} />
                  <Findings
                    session={session}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    onGoToFinding={goToFinding}
                    onChecklistChange={(checklist) => setSession({ ...session, checklist })}
                  />
                </>
              ) : (
                !analyzing && (
                  <EmptyState title="No findings yet">
                    {session.sources.length === 0
                      ? 'Add sources on the left, then run the analysis. You will see potential gaps, possible contradictions, freshness warnings and a verification checklist.'
                      : 'Run the analysis to review your sources for missing, conflicting and outdated information.'}
                  </EmptyState>
                )
              )}
            </div>
          </section>
        </div>
      </div>
      <SourceDialog
        sessionId={session.id}
        target={inspect}
        label={inspect ? sourcesById[inspect.sourceId]?.label : ''}
        onClose={() => setInspect(null)}
      />
    </EvidenceContext.Provider>
  );
}
