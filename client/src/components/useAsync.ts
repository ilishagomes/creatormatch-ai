import { useCallback, useEffect, useState } from "react";

/**
 * Runs an async function when the component mounts (and whenever `deps`
 * change) and tracks loading / error / data so every page can show
 * proper loading states and error messages.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false; // ignore results from an outdated request
    setLoading(true);
    setError(null);
    fn()
      .then((result) => !cancelled && setData(result))
      .catch((err: Error) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  return { data, error, loading, reload, setData };
}
