import { useEffect, useState } from 'react';
import { researchApi } from '../services/researchApi.js';

// One shared request per page load: which optional integrations the server has.
let cached = null;

export function useServerStatus() {
  const [status, setStatus] = useState(() => (cached && !(cached instanceof Promise) ? cached : null));

  useEffect(() => {
    if (status) return undefined;
    let active = true;
    if (!cached) {
      cached = researchApi.health().catch(() => {
        cached = null;
        return null;
      });
    }
    Promise.resolve(cached).then((value) => {
      if (value) cached = value;
      if (active) setStatus(value || { unavailable: true });
    });
    return () => {
      active = false;
    };
  }, [status]);

  return status;
}
