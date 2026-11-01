import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { researchApi } from '../services/researchApi.js';
import { rememberSession } from '../hooks/useRecentSessions.js';
import { PROFILE_OPTIONS } from '../utils/labels.js';
import { Alert, FieldError } from './ui.jsx';
import ScopeFields from './ScopeFields.jsx';

const MIN = 10;
const MAX = 500;

// One-click starting points; each also sets the matching research type.
const EXAMPLES = [
  { label: 'Scholarship', profile: 'scholarship', question: 'Am I eligible for the National Scholarship Portal post-matric scholarship for 2026-27, and what is the last date to apply?' },
  { label: 'Govt job', profile: 'job', question: 'What are the eligibility rules, age limit, application fee and last date for the SSC CGL 2026 exam?' },
  { label: 'Passport', profile: 'publicService', question: 'Which documents do I need for a fresh Indian passport, what is the fee, and how long does processing take?' },
  { label: 'Research', profile: 'research', question: 'What does recent research say about the effect of screen time on children’s sleep, and what are its limitations?' },
];

export default function NewResearchForm({ initialQuestion = '' }) {
  const navigate = useNavigate();
  const ids = { q: useId(), qHelp: useId(), qErr: useId(), profile: useId(), hp: useId() };
  const [question, setQuestion] = useState(initialQuestion);
  const [profile, setProfile] = useState('auto');
  const [context, setContext] = useState({ situation: '', location: '', period: '' });
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
      const { session } = await researchApi.createSession({ question: question.trim(), profile, context, website });
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
        <div className="example-chips" role="group" aria-label="Example questions">
          <span className="small muted">Try an example:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              className={`chip${question === example.question ? ' is-active' : ''}`}
              aria-pressed={question === example.question}
              title={example.question}
              onClick={() => {
                setQuestion(example.question);
                setProfile(example.profile);
                setFieldError('');
                document.getElementById(ids.q)?.focus();
              }}
            >
              {example.label}
            </button>
          ))}
        </div>
        <p className="small muted">After you start, add sources with the Search tab, a web page link, a PDF or pasted text.</p>
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

      <ScopeFields value={context} onChange={setContext} />

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
          {busy === 'create' ? 'Starting…' : 'Start a research session'}
        </button>
        <button type="button" className="link-button" onClick={startDemo} disabled={Boolean(busy)}>
          {busy === 'demo' ? 'Opening sample…' : 'Or explore a sample investigation with simulated sources'}
        </button>
      </div>
    </form>
  );
}
