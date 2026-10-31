import { useId, useState } from 'react';
import { researchApi } from '../../services/researchApi.js';
import { PRIORITY } from '../../utils/labels.js';
import { Alert, EmptyState, FieldError, Tag } from '../ui.jsx';
import { SourceRef } from './Evidence.jsx';

const RELATED_LABEL = { gap: 'potential gap', contradiction: 'possible conflict', freshness: 'freshness warning' };

function AddItemForm({ sessionId, onSaved }) {
  const ids = { text: useId(), err: useId(), priority: useId() };
  const [text, setText] = useState('');
  const [priority, setPriority] = useState('medium');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (text.trim().length < 5) return setError('Describe what you want to verify (at least 5 characters).');
    setBusy(true);
    setError('');
    try {
      const { checklist } = await researchApi.addChecklistItem(sessionId, { text: text.trim(), priority });
      onSaved(checklist);
      setText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="add-item" onSubmit={submit} noValidate>
      <div className="field add-item-text">
        <label className="label" htmlFor={ids.text}>
          Add your own item
        </label>
        <input
          id={ids.text}
          className="input"
          type="text"
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? ids.err : undefined}
        />
        <FieldError id={ids.err} message={error} />
      </div>
      <div className="field">
        <label className="label" htmlFor={ids.priority}>
          Priority
        </label>
        <select id={ids.priority} className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <button type="submit" className="btn btn-secondary" disabled={busy}>
        {busy ? 'Adding…' : 'Add item'}
      </button>
    </form>
  );
}

export default function Checklist({ sessionId, items, onItemsChange, onGoToFinding }) {
  const [filter, setFilter] = useState('open');
  const [pending, setPending] = useState({});
  const [error, setError] = useState('');

  const done = items.filter((i) => i.done).length;
  const visible = items.filter((i) => (filter === 'all' ? true : filter === 'done' ? i.done : !i.done));

  async function toggle(item) {
    const next = !item.done;
    setError('');
    setPending((p) => ({ ...p, [item.id]: true }));
    onItemsChange(items.map((i) => (i.id === item.id ? { ...i, done: next } : i))); // optimistic
    try {
      const { checklist } = await researchApi.setChecklistDone(sessionId, item.id, next);
      onItemsChange(checklist);
    } catch (err) {
      onItemsChange(items); // roll back
      setError(`Could not save “${item.text}”: ${err.message}`);
    } finally {
      setPending((p) => ({ ...p, [item.id]: false }));
    }
  }

  async function remove(item) {
    setError('');
    try {
      const { checklist } = await researchApi.deleteChecklistItem(sessionId, item.id);
      onItemsChange(checklist);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack checklist">
      <p className="small muted">
        Ticking an item records that you checked it. It does not mean this tool has verified the fact.
      </p>
      <div className="checklist-head">
        <div className="progress" role="group" aria-label="Checklist progress">
          <p>
            <strong>{done}</strong> of {items.length} marked done
          </p>
          <progress max={items.length || 1} value={done} aria-label={`${done} of ${items.length} items marked done`} />
        </div>
        <fieldset className="segmented">
          <legend className="visually-hidden">Show</legend>
          {[
            ['open', `Open (${items.length - done})`],
            ['done', `Done (${done})`],
            ['all', 'All'],
          ].map(([value, label]) => (
            <label key={value} className={filter === value ? 'is-active' : ''}>
              <input type="radio" name="checklist-filter" value={value} checked={filter === value} onChange={() => setFilter(value)} />
              {label}
            </label>
          ))}
        </fieldset>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {visible.length === 0 ? (
        <EmptyState title={filter === 'done' ? 'Nothing marked as done yet' : items.length ? 'Every item is marked as done' : 'No checklist items'}>
          {filter === 'open' && items.length > 0
            ? 'All items are marked as done. Re-run the analysis if you add new sources.'
            : 'Items appear after an analysis, and you can add your own below.'}
        </EmptyState>
      ) : (
        <ul className="check-list">
          {visible.map((item) => {
            const priority = PRIORITY[item.priority];
            return (
              <li key={item.id} className={`check-item${item.done ? ' is-done' : ''}`}>
                <input
                  type="checkbox"
                  id={`chk-${item.id}`}
                  checked={item.done}
                  disabled={pending[item.id]}
                  onChange={() => toggle(item)}
                />
                <div className="check-body">
                  <label htmlFor={`chk-${item.id}`} className="check-text">
                    {item.text}
                  </label>
                  <div className="row small">
                    <Tag tone={priority.tone}>{priority.label}</Tag>
                    {item.done && <Tag tone="ok">Marked done by you</Tag>}
                    {item.origin === 'user' && <Tag plain>Added by you</Tag>}
                  </div>
                  <p className="small muted">{item.rationale}</p>
                  {item.destination?.type === 'search' && !item.done && (
                    <p className="small">
                      <span className="muted">Where to check:</span> {item.destination.note} Suggested search: “{item.destination.query}”
                    </p>
                  )}
                  {item.destination?.type === 'source' && !item.done && (
                    <p className="small row">
                      <span className="muted">Where to check:</span> <SourceRef sourceId={item.destination.sourceId} />
                    </p>
                  )}
                  <div className="row small">
                    {item.relatedType && (
                      <button type="button" className="link-button" onClick={() => onGoToFinding(item.relatedType, item.relatedId)}>
                        View related {RELATED_LABEL[item.relatedType]}
                      </button>
                    )}
                    {item.sourceIds.map((id) => (
                      <SourceRef key={id} sourceId={id} />
                    ))}
                    {item.origin === 'user' && (
                      <button type="button" className="link-button" onClick={() => remove(item)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AddItemForm sessionId={sessionId} onSaved={onItemsChange} />
    </div>
  );
}
