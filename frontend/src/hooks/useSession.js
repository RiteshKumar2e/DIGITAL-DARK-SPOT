import { useCallback, useEffect, useState } from 'react';
import { researchApi } from '../services/researchApi.js';
import { rememberSession } from './useRecentSessions.js';

/** Loads one research session and exposes a setter for server responses. */
export function useSession(id) {
  const [state, setState] = useState({ status: 'loading', session: null, error: null });

  const load = useCallback(
    async (signal) => {
      setState((prev) => ({ ...prev, status: prev.session ? 'refreshing' : 'loading', error: null }));
      try {
        const { session } = await researchApi.getSession(id, signal);
        rememberSession(session);
        setState({ status: 'ready', session, error: null });
      } catch (error) {
        if (error.name === 'AbortError') return;
        setState({ status: 'error', session: null, error });
      }
    },
    [id],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const setSession = useCallback((session) => setState({ status: 'ready', session, error: null }), []);

  return { ...state, setSession, reload: () => load() };
}
