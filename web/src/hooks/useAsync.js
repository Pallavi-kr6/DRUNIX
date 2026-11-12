import { useCallback, useEffect, useRef, useState } from 'react';
// Runs fn() (resolving to {status,ok,data}); exposes loading/error/data/reload. Stale responses are ignored.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const n = useRef(0);
  const run = useCallback(async () => {
    const id = ++n.current; setState((s) => ({ ...s, loading: true }));
    try {
      const r = await fn();
      if (id !== n.current) return;
      setState(r.ok ? { loading: false, error: null, data: r.data } : { loading: false, error: r.data?.message || r.data?.error || `HTTP ${r.status}`, data: null });
    } catch (e) { if (id === n.current) setState({ loading: false, error: `Network error: ${e.message}`, data: null }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
}
