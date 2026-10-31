import { useCallback, useSyncExternalStore } from 'react';

// Recent sessions are remembered only in this browser (localStorage), so a
// session can be resumed without an account. Only the id, question and date
// are stored here; the research itself stays on the server.
const KEY = 'dds.recentSessions';
const MAX = 12;
const listeners = new Set();
let cache = null;

function read() {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    cache = Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.id === 'string') : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(list) {
  cache = list;
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage may be unavailable (private mode); the list then lasts for this visit only.
  }
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function rememberSession(session) {
  const entry = { id: session.id, question: session.question, createdAt: session.createdAt, demo: Boolean(session.demo) };
  write([entry, ...read().filter((s) => s.id !== session.id)].slice(0, MAX));
}

export function forgetSession(id) {
  write(read().filter((s) => s.id !== id));
}

export function useRecentSessions() {
  const sessions = useSyncExternalStore(subscribe, read, () => []);
  const clear = useCallback(() => write([]), []);
  return { sessions, forget: forgetSession, clear };
}
