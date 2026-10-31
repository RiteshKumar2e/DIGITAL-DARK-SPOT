import { useId, useRef, useState } from 'react';
import { researchApi } from '../../services/researchApi.js';
import { useServerStatus } from '../../hooks/useServerStatus.js';
import { Alert, FieldError, Tag } from '../ui.jsx';

function clientUrlCheck(value) {
  const raw = value.trim();
  if (!raw) return 'Enter the address of a web page.';
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol)) return 'Only http and https links can be retrieved.';
    if (!url.hostname.includes('.')) return 'Use a full public address, for example https://example.org/page.';
  } catch {
    return 'This does not look like a valid web address.';
  }
  return '';
}

const MODES = [
  ['url', 'Web page'],
  ['search', 'Search'],
  ['pdf', 'Upload PDF'],
  ['text', 'Paste text'],
];

function resultMessage(source) {
  if (source.status === 'retrieved') {
    const pages = source.pageCount ? `, ${source.pageCount} page${source.pageCount === 1 ? '' : 's'}` : '';
    return { tone: 'success', text: `Added “${source.title}” (${source.wordCount.toLocaleString('en')} words retrieved${pages}).` };
  }
  return {
    tone: 'warning',
    text: `The source was added but could not be read: ${source.error?.message || 'unknown problem'} It will not be used in the analysis.`,
  };
}

function SearchPanel({ sessionId, onAdded, disabled, status, defaultQuery }) {
  const ids = { q: useId(), err: useId() };
  const [query, setQuery] = useState(defaultQuery);
  const [state, setState] = useState({ status: 'idle', results: [], provider: null, error: '' });
  const [adding, setAdding] = useState({});
  const [added, setAdded] = useState({});
  const [message, setMessage] = useState(null);

  if (status && !status.unavailable && !status.search?.configured) {
    return (
      <Alert tone="info" title="Web search is not configured on this server">
        Add page addresses with <strong>Web page</strong>, upload a PDF, or paste text. To enable search, the operator sets{' '}
        <code>SEARCH_PROVIDER</code> and a Tavily or Serper API key in the backend environment.
      </Alert>
    );
  }

  async function run(event) {
    event.preventDefault();
    if (query.trim().length < 3) return setState((s) => ({ ...s, error: 'Enter at least 3 characters.' }));
    setState({ status: 'loading', results: [], provider: null, error: '' });
    setMessage(null);
    try {
      const data = await researchApi.search(sessionId, query.trim());
      setState({ status: 'done', results: data.results, provider: data.provider, error: '' });
    } catch (error) {
      setState({ status: 'error', results: [], provider: null, error: error.message });
    }
  }

  async function addResult(result) {
    setAdding((a) => ({ ...a, [result.url]: true }));
    setMessage(null);
    try {
      const data = await researchApi.addUrlSource(sessionId, result.url);
      onAdded(data.session);
      setAdded((a) => ({ ...a, [result.url]: true }));
      setMessage(resultMessage(data.source));
    } catch (error) {
      setMessage({ tone: 'error', text: error.message });
    } finally {
      setAdding((a) => ({ ...a, [result.url]: false }));
    }
  }

  return (
    <div className="stack-sm">
      <form className="search-form" onSubmit={run} noValidate role="search">
        <label className="label" htmlFor={ids.q}>
          Search the web
        </label>
        <div className="row search-row">
          <input
            id={ids.q}
            className="input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-invalid={Boolean(state.error && state.status !== 'error')}
            aria-describedby={state.error ? ids.err : undefined}
          />
          <button type="submit" className="btn btn-secondary" disabled={state.status === 'loading' || disabled}>
            {state.status === 'loading' ? 'Searching…' : 'Search'}
          </button>
        </div>
        {state.status !== 'error' && <FieldError id={ids.err} message={state.error} />}
      </form>
      <div aria-live="polite" className="stack-sm">
        {state.status === 'error' && <Alert tone="error">{state.error}</Alert>}
        {state.status === 'done' && (
          <>
            <p className="small muted">
              {state.results.length} results from {state.provider}. Snippets are not evidence: add a result to retrieve and review the
              full page.
            </p>
            <ul className="search-results">
              {state.results.map((r) => (
                <li key={r.url}>
                  <p className="search-title">{r.title}</p>
                  <a className="url" href={r.url} target="_blank" rel="noopener noreferrer nofollow">
                    {r.domain}
                    <span className="visually-hidden"> (opens in a new tab)</span>
                  </a>
                  {r.snippet && (
                    <p className="small">
                      <Tag plain>Search snippet</Tag> {r.snippet}
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={r.alreadyAdded || added[r.url] || adding[r.url] || disabled}
                    onClick={() => addResult(r)}
                  >
                    {r.alreadyAdded || added[r.url] ? 'Added' : adding[r.url] ? 'Retrieving…' : 'Add as source'}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {message && <Alert tone={message.tone} role="none">{message.text}</Alert>}
      </div>
    </div>
  );
}

export default function AddSourceForm({ sessionId, onAdded, disabled, remaining, autoFocus = false, defaultQuery = '' }) {
  const status = useServerStatus();
  const [mode, setMode] = useState('url');
  const [url, setUrl] = useState('');
  const [paste, setPaste] = useState({ title: '', text: '', originUrl: '' });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const urlRef = useRef(null);
  const fileRef = useRef(null);
  const ids = {
    url: useId(), urlErr: useId(), title: useId(), titleErr: useId(), text: useId(), textErr: useId(),
    origin: useId(), originErr: useId(), file: useId(), fileErr: useId(), fileHint: useId(),
  };
  const maxPdfMb = status?.limits?.maxPdfMb || 10;

  async function submit(event) {
    event.preventDefault();
    if (busy || disabled) return;
    setMessage(null);

    const next = {};
    if (mode === 'url') {
      next.url = clientUrlCheck(url);
      if (!next.url) delete next.url;
    } else if (mode === 'pdf') {
      if (!file) next.file = 'Choose a PDF file.';
      else if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') next.file = 'Only PDF files can be uploaded.';
      else if (file.size > maxPdfMb * 1024 * 1024) next.file = `The file is larger than ${maxPdfMb} MB.`;
    } else {
      if (!paste.title.trim()) next.title = 'Give the text a short title, such as where it came from.';
      if (paste.text.trim().length < 80) next.text = 'Paste at least 80 characters of text.';
      if (paste.originUrl.trim() && clientUrlCheck(paste.originUrl)) next.originUrl = clientUrlCheck(paste.originUrl);
    }
    setErrors(next);
    if (Object.keys(next).length) {
      if (next.url) urlRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      let result;
      if (mode === 'url') result = await researchApi.addUrlSource(sessionId, url.trim());
      else if (mode === 'pdf') result = await researchApi.uploadPdf(sessionId, file);
      else result = await researchApi.addTextSource(sessionId, { title: paste.title, text: paste.text, originUrl: paste.originUrl.trim() || undefined });
      onAdded(result.session);
      setMessage(resultMessage(result.source));
      if (mode === 'url') setUrl('');
      if (mode === 'text' && result.source.status === 'retrieved') setPaste({ title: '', text: '', originUrl: '' });
      if (mode === 'pdf') {
        setFile(null);
        if (fileRef.current) fileRef.current.value = '';
      }
    } catch (error) {
      // Keep the user's input so they can correct it.
      setErrors(error.fields || {});
      setMessage({ tone: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="add-source">
      <fieldset className="segmented" disabled={busy}>
        <legend className="visually-hidden">How to add a source</legend>
        {MODES.map(([value, label]) => (
          <label key={value} className={mode === value ? 'is-active' : ''}>
            <input type="radio" name="source-mode" value={value} checked={mode === value} onChange={() => { setMode(value); setMessage(null); setErrors({}); }} />
            {label}
          </label>
        ))}
      </fieldset>

      {mode === 'search' ? (
        <SearchPanel sessionId={sessionId} onAdded={onAdded} disabled={disabled} status={status} defaultQuery={defaultQuery} />
      ) : (
        <form className="stack-sm" onSubmit={submit} noValidate>
          {mode === 'url' && (
            <div className="field">
              <label className="label" htmlFor={ids.url}>
                Page address
              </label>
              <input
                ref={urlRef}
                id={ids.url}
                autoFocus={autoFocus}
                className="input"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                aria-invalid={Boolean(errors.url)}
                aria-describedby={errors.url ? ids.urlErr : undefined}
              />
              <FieldError id={ids.urlErr} message={errors.url} />
              <p className="hint">Web pages, plain-text files and linked PDF documents can be retrieved.</p>
            </div>
          )}

          {mode === 'pdf' && (
            <div className="field">
              <label className="label" htmlFor={ids.file}>
                PDF document
              </label>
              <input
                ref={fileRef}
                id={ids.file}
                className="input file-input"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                aria-invalid={Boolean(errors.file)}
                aria-describedby={`${ids.fileHint}${errors.file ? ` ${ids.fileErr}` : ''}`}
              />
              <FieldError id={ids.fileErr} message={errors.file} />
              <p className="hint" id={ids.fileHint}>
                Up to {maxPdfMb} MB. Text is extracted page by page so findings can cite page numbers. Scanned PDFs without a text
                layer cannot be read (no OCR).
              </p>
            </div>
          )}

          {mode === 'text' && (
            <>
              <div className="field">
                <label className="label" htmlFor={ids.title}>
                  Title
                </label>
                <input id={ids.title} className="input" type="text" maxLength={200} value={paste.title}
                  onChange={(e) => setPaste({ ...paste, title: e.target.value })}
                  aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? ids.titleErr : undefined} />
                <FieldError id={ids.titleErr} message={errors.title} />
              </div>
              <div className="field">
                <label className="label" htmlFor={ids.text}>
                  Text
                </label>
                <textarea id={ids.text} className="textarea" rows={6} value={paste.text}
                  onChange={(e) => setPaste({ ...paste, text: e.target.value })}
                  aria-invalid={Boolean(errors.text)} aria-describedby={errors.text ? ids.textErr : undefined} />
                <FieldError id={ids.textErr} message={errors.text} />
              </div>
              <div className="field">
                <label className="label" htmlFor={ids.origin}>
                  Where it came from <span className="muted">(optional link)</span>
                </label>
                <input id={ids.origin} className="input" type="url" inputMode="url" value={paste.originUrl}
                  onChange={(e) => setPaste({ ...paste, originUrl: e.target.value })}
                  aria-invalid={Boolean(errors.originUrl)} aria-describedby={errors.originUrl ? ids.originErr : undefined} />
                <FieldError id={ids.originErr} message={errors.originUrl} />
              </div>
              <p className="hint">For pages that block automated access. Pasted text is labelled as provided by you.</p>
            </>
          )}

          <div className="row space-between">
            <button type="submit" className="btn btn-secondary" disabled={busy || disabled}>
              {busy && <span className="spinner" aria-hidden="true" />}
              {busy ? (mode === 'url' ? 'Retrieving page…' : mode === 'pdf' ? 'Extracting text…' : 'Adding…') : mode === 'pdf' ? 'Upload PDF' : 'Add source'}
            </button>
            <span className="small muted">{remaining} of 10 slots left</span>
          </div>
          <div aria-live="polite">{message && <Alert tone={message.tone} role="none">{message.text}</Alert>}</div>
        </form>
      )}
    </div>
  );
}
