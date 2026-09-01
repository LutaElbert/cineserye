export type CinemaTraceEvent = {
  event: 'run-started' | 'phase-completed' | 'run-completed' | 'run-failed';
  runId: string;
  phase?: 'research' | 'planning' | 'validation' | 'proposal';
  durationMs?: number;
  provider?: string;
  model?: string;
  resultCount?: number;
  retryCount?: number;
  status?: 'ok' | 'error';
  errorCode?: string;
};

export type CinemaTraceSink = (event: CinemaTraceEvent) => void;

export const consoleCinemaTraceSink: CinemaTraceSink = (event) => {
  console.info(JSON.stringify({ scope: 'cineserye.copilot', ...event }));
};

export async function traceCinemaPhase<T>(
  sink: CinemaTraceSink,
  event: Omit<CinemaTraceEvent, 'event' | 'durationMs' | 'status'>,
  operation: () => Promise<T>,
  describe: (result: T) => Partial<Pick<CinemaTraceEvent, 'provider' | 'model' | 'resultCount'>> = () => ({}),
): Promise<T> {
  const startedAt = performance.now();
  const result = await operation();
  sink({
    event: 'phase-completed',
    ...event,
    ...describe(result),
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    status: 'ok',
  });
  return result;
}
