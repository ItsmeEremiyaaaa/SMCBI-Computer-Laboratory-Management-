import { useCallback, useEffect, useState } from 'react';

// Loads async data, exposes reload for after mutations.
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);
  const reload = useCallback(async () => {
    try { setData(await load()); setError(null); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [load]);
  useEffect(() => { setLoading(true); reload(); }, [reload]);
  return { data, error, loading, reload };
}
