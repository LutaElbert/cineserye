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
  agentVersion?: string;
  telemetryPolicy?: 'no-content-v1';
};

export const CINEMA_AGENT_VERSION = 'scene-planner-v1';
export const CINEMA_TELEMETRY_POLICY = 'no-content-v1' as const;

export type CinemaTraceSink = (event: CinemaTraceEvent) => void;

export const consoleCinemaTraceSink: CinemaTraceSink = (event) => {
  console.info(JSON.stringify({
    scope: 'cineserye.copilot',
    agentVersion: CINEMA_AGENT_VERSION,
    telemetryPolicy: CINEMA_TELEMETRY_POLICY,
    ...event,
  }));
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
    agentVersion: CINEMA_AGENT_VERSION,
    telemetryPolicy: CINEMA_TELEMETRY_POLICY,
    ...event,
    ...describe(result),
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    status: 'ok',
  });
  return result;
}
