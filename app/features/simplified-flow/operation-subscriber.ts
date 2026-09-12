/** A read-only subscriber. Await both the request and local result preparation
 * before scheduling another read. Disposal invalidates all continuations even
 * when a transport ignores AbortSignal; it never cancels provider work. */
export function subscribeToOperation<T>(options: {
  read: (signal: AbortSignal) => Promise<T>;
  apply: (value: T, isCurrent: () => boolean) => Promise<boolean>;
  onError: (error: unknown) => void;
  intervalMs?: number;
  maximumBackoffMs?: number;
}) {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  const isCurrent = () => !abort.signal.aborted;
  const interval = options.intervalMs ?? 1000;
  const poll = async () => {
    let terminal = false;
    try {
      const result = await options.read(abort.signal);
      if (!isCurrent()) return;
      terminal = await options.apply(result, isCurrent);
      failures = 0;
    } catch (error) {
      if (!isCurrent()) return;
      failures++;
      options.onError(error);
    }
    if (isCurrent() && !terminal) timer = setTimeout(poll, Math.min(interval * 2 ** Math.min(failures, 5), options.maximumBackoffMs ?? 15000));
  };
  void poll();
  return () => { abort.abort(); clearTimeout(timer); };
}
