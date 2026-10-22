import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Fetches `path` with loading/error state, optional polling (in-app refresh fallback for push notifications). */
export function useApi<T>(path: string | null, opts: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(!!path);
  const mounted = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!path) return;
    if (!silent) setLoading(true);
    try {
      const d = await api<T>(path);
      if (mounted.current) { setData(d); setError(null); }
    } catch (e) {
      if (mounted.current && !silent) setError(e as Error);
    } finally {
      if (mounted.current && !silent) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; };
  }, [load]);

  useEffect(() => {
    if (!opts.pollMs || !path) return;
    const id = setInterval(() => load(true), opts.pollMs);
    return () => clearInterval(id);
  }, [opts.pollMs, path, load]);

  return { data, error, loading, reload: load, setData };
}

/** Ticks every second; returns ms remaining until `deadline` corrected by server clock skew. */
export function useCountdown(deadlineIso: string | null | undefined, serverNowIso?: string) {
  const skew = useRef(0);
  useEffect(() => {
    if (serverNowIso) skew.current = new Date(serverNowIso).getTime() - Date.now();
  }, [serverNowIso]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadlineIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadlineIso]);
  if (!deadlineIso) return 0;
  return Math.max(0, new Date(deadlineIso).getTime() - (now + skew.current));
}
