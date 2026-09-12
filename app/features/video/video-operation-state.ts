import type { CinemaVideoOperationRecord, CinemaVideoOperationStatus } from '../../domain/cinema/visual-preproduction';

/** Provider outcome, observation and retry eligibility are different facts. */
export const terminalVideoStatuses = new Set<CinemaVideoOperationStatus>(['ready', 'failed', 'cancelled', 'timed-out', 'expired']);
export const observedVideoStatuses = new Set<CinemaVideoOperationStatus>(['queued', 'running', 'finalizing']);
type Observation = Pick<CinemaVideoOperationRecord, 'provider' | 'status' | 'failureConfirmed'>;
export function unresolvedVideoOperation(record: Observation) {
  return record.status === 'unknown' || observedVideoStatuses.has(record.status)
    || record.provider !== 'cineserye-video-fixture' && (['cancelled', 'timed-out'].includes(record.status) || record.status === 'failed' && !record.failureConfirmed);
}
export function retryableVideoOperation(record: Observation) {
  return record.status === 'failed' && (record.failureConfirmed || record.provider === 'cineserye-video-fixture')
    || record.provider === 'cineserye-video-fixture' && ['cancelled', 'timed-out'].includes(record.status);
}
