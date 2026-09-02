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
export const CINEMA_LOCAL_TELEMETRY_MAX_EVENTS = 500;
export const CINEMA_LOCAL_TELEMETRY_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

const TRACE_EVENT_KEYS = new Set<keyof CinemaTraceEvent>([
  'event', 'runId', 'phase', 'durationMs', 'provider', 'model', 'resultCount', 'retryCount',
  'status', 'errorCode', 'agentVersion', 'telemetryPolicy',
]);

export function sanitizeCinemaTraceEvent(value: CinemaTraceEvent): CinemaTraceEvent {
  const source = value as CinemaTraceEvent & Record<string, unknown>;
  const sanitized = Object.fromEntries(
    Object.entries(source).filter(([key]) => TRACE_EVENT_KEYS.has(key as keyof CinemaTraceEvent)),
  ) as CinemaTraceEvent;
  sanitized.agentVersion = CINEMA_AGENT_VERSION;
  sanitized.telemetryPolicy = CINEMA_TELEMETRY_POLICY;
  return sanitized;
}

export function pruneCinemaTraceRecords<T extends { createdAt: number; events: CinemaTraceEvent[] }>(
  records: T[],
  now = Date.now(),
): T[] {
  const recent = records
    .filter((record) => record.createdAt >= now - CINEMA_LOCAL_TELEMETRY_RETENTION_MS)
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((record) => ({ ...record, events: record.events.map(sanitizeCinemaTraceEvent) }));
  let remaining = CINEMA_LOCAL_TELEMETRY_MAX_EVENTS;
  const result: T[] = [];
  for (const record of recent) {
    if (remaining <= 0) break;
    const events = record.events.slice(0, remaining);
    if (events.length) result.push({ ...record, events });
    remaining -= events.length;
  }
  return result;
}

export type CinemaTraceSink = (event: CinemaTraceEvent) => void;

export const consoleCinemaTraceSink: CinemaTraceSink = (event) => {
  console.info(JSON.stringify({
    scope: 'cineserye.copilot',
    agentVersion: CINEMA_AGENT_VERSION,
    telemetryPolicy: CINEMA_TELEMETRY_POLICY,
    ...sanitizeCinemaTraceEvent(event),
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
  sink(sanitizeCinemaTraceEvent({
    event: 'phase-completed',
    agentVersion: CINEMA_AGENT_VERSION,
    telemetryPolicy: CINEMA_TELEMETRY_POLICY,
    ...event,
    ...describe(result),
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    status: 'ok',
  }));
  return result;
}
