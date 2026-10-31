import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { researchApi } from '../services/researchApi.js';
import { rememberSession } from '../hooks/useRecentSessions.js';
import { PROFILE_OPTIONS } from '../utils/labels.js';
import { Alert, FieldError } from './ui.jsx';

const MIN = 10;
const MAX = 500;

export default function NewResearchForm({ initialQuestion = '' }) {
  const navigate = useNavigate();
  const ids = { q: useId(), qHelp: useId(), qErr: useId(), profile: useId(), hp: useId() };
  const [question, setQuestion] = useState(initialQuestion);
  const [profile, setProfile] = useState('auto');
  const [website, setWebsite] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(null); // 'create' | 'demo' | null

  function validate() {
    const trimmed = question.trim();
    if (trimmed.length < MIN) return `Describe your question in at least ${MIN} characters.`;
    if (trimmed.length > MAX) return `Keep the question under ${MAX} characters.`;
    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const problem = validate();
    setFieldError(problem);
    setFormError('');
    if (problem) {
      document.getElementById(ids.q)?.focus();
      return;
    }
    setBusy('create');
    try {
      const { session } = await researchApi.createSession({ question: question.trim(), profile, website });
      rememberSession(session);
      navigate(`/research/${session.id}`, { state: { justCreated: true } });
    } catch (error) {
      if (error.fields?.question) setFieldError(error.fields.question);
      setFormError(error.message);
      setBusy(null);
    }
  }

  async function startDemo() {
    if (busy) return;
    setBusy('demo');
    setFormError('');
    try {
      const { session } = await researchApi.createDemoSession();
      rememberSession(session);
      navigate(`/research/${session.id}`);
    } catch (error) {
      setFormError(error.message);
      setBusy(null);
    }
  }

  const remaining = MAX - question.length;

  return (
    <form className="new-research" onSubmit={handleSubmit} noValidate aria-describedby={formError ? 'new-research-error' : undefined}>
      <div className="field">
        <label className="label" htmlFor={ids.q}>
          What are you trying to find out?
        </label>
        <p className="hint" id={ids.qHelp}>
          Be specific about your situation, for example: “Am I eligible for the state merit scholarship as a second-year
          engineering student, and what is this year’s deadline?”
        </p>
        <textarea
          id={ids.q}
          className="textarea"
          rows={4}
          maxLength={MAX + 50}
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            if (fieldError) setFieldError('');
          }}
          aria-invalid={Boolean(fieldError)}
          aria-describedby={`${ids.qHelp}${fieldError ? ` ${ids.qErr}` : ''}`}
          required
        />
        <div className="row field-meta">
          <FieldError id={ids.qErr} message={fieldError} />
          <span className={`small ${remaining < 0 ? 'text-error' : 'muted'}`} aria-live="polite">
            {remaining < 50 ? `${remaining} characters left` : ''}
          </span>
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor={ids.profile}>
          Type of research
        </label>
        <select id={ids.profile} className="select" value={profile} onChange={(e) => setProfile(e.target.value)}>
          {PROFILE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="hint">This decides which kinds of information are checked for gaps.</p>
      </div>

      <div className="honeypot" aria-hidden="true">
        <label htmlFor={ids.hp}>Leave this field empty</label>
        <input id={ids.hp} type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {formError && (
        <div id="new-research-error">
          <Alert tone="error" title="The session could not be started">
            {formError}
          </Alert>
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={Boolean(busy)}>
          {busy === 'create' && <span className="spinner" aria-hidden="true" />}
          {busy === 'create' ? 'Starting…' : 'Start research session'}
        </button>
        <button type="button" className="link-button" onClick={startDemo} disabled={Boolean(busy)}>
          {busy === 'demo' ? 'Opening sample…' : 'Or explore a sample session with simulated sources'}
        </button>
      </div>
    </form>
  );
}
