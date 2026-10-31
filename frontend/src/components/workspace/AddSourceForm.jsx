import { useId, useRef, useState } from 'react';
import { researchApi } from '../../services/researchApi.js';
import { Alert, FieldError } from '../ui.jsx';

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

export default function AddSourceForm({ sessionId, onAdded, disabled, remaining }) {
  const [mode, setMode] = useState('url');
  const [url, setUrl] = useState('');
  const [paste, setPaste] = useState({ title: '', text: '', originUrl: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const urlRef = useRef(null);
  const ids = { url: useId(), urlErr: useId(), title: useId(), titleErr: useId(), text: useId(), textErr: useId(), origin: useId(), originErr: useId() };

  async function submit(event) {
    event.preventDefault();
    if (busy || disabled) return;
    setMessage(null);

    if (mode === 'url') {
      const problem = clientUrlCheck(url);
      setErrors({ url: problem });
      if (problem) return urlRef.current?.focus();
    } else {
      const next = {};
      if (!paste.title.trim()) next.title = 'Give the text a short title, such as where it came from.';
      if (paste.text.trim().length < 80) next.text = 'Paste at least 80 characters of text.';
      if (paste.originUrl.trim() && clientUrlCheck(paste.originUrl)) next.originUrl = clientUrlCheck(paste.originUrl);
      setErrors(next);
      if (Object.keys(next).length) return;
    }

    setBusy(true);
    try {
      const result =
        mode === 'url'
          ? await researchApi.addUrlSource(sessionId, url.trim())
          : await researchApi.addTextSource(sessionId, { title: paste.title, text: paste.text, originUrl: paste.originUrl.trim() || undefined });
      onAdded(result.session);
      const { source } = result;
      if (source.status === 'retrieved') {
        setMessage({ tone: 'success', text: `Added “${source.title}” (${source.wordCount.toLocaleString('en')} words retrieved).` });
        setUrl('');
        setPaste({ title: '', text: '', originUrl: '' });
      } else {
        setMessage({
          tone: 'warning',
          text: `The source was added but could not be read: ${source.error?.message || 'unknown problem'} It will not be used in the analysis.`,
        });
        setUrl('');
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
    <form className="add-source" onSubmit={submit} noValidate>
      <fieldset className="segmented" disabled={busy}>
        <legend className="visually-hidden">Source type</legend>
        <label className={mode === 'url' ? 'is-active' : ''}>
          <input type="radio" name="source-mode" value="url" checked={mode === 'url'} onChange={() => setMode('url')} />
          Web page
        </label>
        <label className={mode === 'text' ? 'is-active' : ''}>
          <input type="radio" name="source-mode" value="text" checked={mode === 'text'} onChange={() => setMode('text')} />
          Paste text
        </label>
      </fieldset>

      {mode === 'url' ? (
        <div className="field">
          <label className="label" htmlFor={ids.url}>
            Page address
          </label>
          <input
            ref={urlRef}
            id={ids.url}
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
        </div>
      ) : (
        <>
          <div className="field">
            <label className="label" htmlFor={ids.title}>
              Title
            </label>
            <input
              id={ids.title}
              className="input"
              type="text"
              maxLength={200}
              value={paste.title}
              onChange={(e) => setPaste({ ...paste, title: e.target.value })}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? ids.titleErr : undefined}
            />
            <FieldError id={ids.titleErr} message={errors.title} />
          </div>
          <div className="field">
            <label className="label" htmlFor={ids.text}>
              Text
            </label>
            <textarea
              id={ids.text}
              className="textarea"
              rows={6}
              value={paste.text}
              onChange={(e) => setPaste({ ...paste, text: e.target.value })}
              aria-invalid={Boolean(errors.text)}
              aria-describedby={errors.text ? ids.textErr : undefined}
            />
            <FieldError id={ids.textErr} message={errors.text} />
          </div>
          <div className="field">
            <label className="label" htmlFor={ids.origin}>
              Where it came from <span className="muted">(optional link)</span>
            </label>
            <input
              id={ids.origin}
              className="input"
              type="url"
              inputMode="url"
              value={paste.originUrl}
              onChange={(e) => setPaste({ ...paste, originUrl: e.target.value })}
              aria-invalid={Boolean(errors.originUrl)}
              aria-describedby={errors.originUrl ? ids.originErr : undefined}
            />
            <FieldError id={ids.originErr} message={errors.originUrl} />
          </div>
          <p className="hint">Use this for PDFs or pages that block automated access. Pasted text is labelled as provided by you.</p>
        </>
      )}

      <div className="row space-between">
        <button type="submit" className="btn btn-secondary" disabled={busy || disabled}>
          {busy && <span className="spinner" aria-hidden="true" />}
          {busy ? (mode === 'url' ? 'Retrieving page…' : 'Adding…') : 'Add source'}
        </button>
        <span className="small muted">{remaining} of 10 slots left</span>
      </div>

      <div aria-live="polite">{message && <Alert tone={message.tone} role="none">{message.text}</Alert>}</div>
    </form>
  );
}
