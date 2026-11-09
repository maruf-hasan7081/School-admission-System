import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../api/client';

export function usePolling<T>(loader: (signal: AbortSignal) => Promise<T>, interval = 3000) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ owner: typeof loader; data?: T; error: string | null; updatedAt: number | null; refreshing: boolean }>({ owner: loader, error: null, updatedAt: null, refreshing: true });
  const refresh = useCallback(() => setRevision(n => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setState(previous => previous.owner === loader ? { ...previous, refreshing: true } : { owner: loader, data: undefined, error: null, updatedAt: null, refreshing: true });
    async function load() {
      try {
        const data = await loader(controller.signal);
        if (!controller.signal.aborted) setState({ owner: loader, data, error: null, updatedAt: Date.now(), refreshing: false });
      } catch (error) {
        if (!controller.signal.aborted) setState(previous => ({ ...previous, owner: loader, error: errorMessage(error), refreshing: false }));
      } finally {
        if (!controller.signal.aborted && interval > 0) timer = setTimeout(() => void load(), interval);
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [loader, interval, revision]);
  const current = state.owner === loader ? state : { data: undefined, error: null, updatedAt: null, refreshing: true };
  return { ...current, loading: current.data === undefined && current.error === null, refresh };
}
