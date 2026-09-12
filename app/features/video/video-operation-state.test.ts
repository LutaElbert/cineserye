import { expect, it } from 'vitest';
import { unresolvedVideoOperation, retryableVideoOperation } from './video-operation-state';
import type { CinemaVideoOperationStatus } from '../../domain/cinema/visual-preproduction';

it.each([
  ['unknown', false, true, false], ['running', false, true, false], ['failed', false, true, false],
  ['failed', true, false, true], ['cancelled', false, true, false], ['timed-out', false, true, false],
  ['ready', false, false, false], ['expired', false, false, false],
] as Array<[CinemaVideoOperationStatus, boolean, boolean, boolean]>)('live %s, confirmed=%s: no invented retry eligibility', (status, failureConfirmed, unresolved, retryable) => {
  const record = { provider: 'google-vertex-ai', status, failureConfirmed };
  expect(unresolvedVideoOperation(record)).toBe(unresolved); expect(retryableVideoOperation(record)).toBe(retryable);
});
it('fixture stop/failure remains explicitly retryable without claiming live cancellation', () => {
  for (const status of ['failed', 'cancelled', 'timed-out'] as const) {
    const record = { provider: 'cineserye-video-fixture', status };
    expect(unresolvedVideoOperation(record)).toBe(false); expect(retryableVideoOperation(record)).toBe(true);
  }
});
