import { describe, expect, it } from 'vitest';
import { MOCK_CINEMA_PROJECT_DATA } from '../../domain/cinema/mock/reel-knows-tomorrow';
import { runFixtureContinuityAudit } from '../../domain/cinema/continuity-audit';
import {
  CINEMA_LOCAL_TELEMETRY_MAX_EVENTS,
  pruneCinemaTraceRecords,
  sanitizeCinemaTraceEvent,
  type CinemaTraceEvent,
} from './telemetry';
import {
  buildCinemaReadinessReport,
  createCinemaSpendLedger,
  reserveCinemaSpend,
  setCinemaSpendKillSwitch,
  settleCinemaSpend,
} from './reliability';

describe('Sprint 10 quality, telemetry, and reliability closure', () => {
  it('S10-SEC-01 strips undeclared content fields and enforces 500-event / 30-day retention', () => {
    const unsafe = {
      event: 'run-started', runId: 'run-01', prompt: 'secret screenplay', rawResponse: 'provider payload',
    } as CinemaTraceEvent & { prompt: string; rawResponse: string };
    expect(sanitizeCinemaTraceEvent(unsafe)).toEqual(expect.objectContaining({
      event: 'run-started', runId: 'run-01', telemetryPolicy: 'no-content-v1',
    }));
    expect(JSON.stringify(sanitizeCinemaTraceEvent(unsafe))).not.toContain('secret');

    const now = Date.parse('2026-09-02T08:00:00.000Z');
    const events = Array.from({ length: 620 }, (_, index) => ({ event: 'run-completed', runId: `run-${index}` } as CinemaTraceEvent));
    const retained = pruneCinemaTraceRecords([
      { createdAt: now, events },
      { createdAt: now - 31 * 24 * 60 * 60 * 1_000, events: [{ event: 'run-failed', runId: 'expired' } as CinemaTraceEvent] },
    ], now);
    expect(retained.flatMap((record) => record.events)).toHaveLength(CINEMA_LOCAL_TELEMETRY_MAX_EVENTS);
    expect(JSON.stringify(retained)).not.toContain('expired');
  });

  it('S10-IT-01 reserves, settles, and stops provider spending within a local ceiling', () => {
    const first = reserveCinemaSpend(createCinemaSpendLedger(5), { runId: 'run-01', provider: 'parallel', estimatedMaximum: 2 });
    const settled = settleCinemaSpend(first, 'run-01', 'parallel', 1.25, 'settled');
    expect(settled.entries[0]).toMatchObject({ actual: 1.25, status: 'settled' });
    expect(() => reserveCinemaSpend(settled, { runId: 'run-02', provider: 'vertex', estimatedMaximum: 4 })).toThrow('ceiling');
    expect(() => reserveCinemaSpend(setCinemaSpendKillSwitch(settled, true), { runId: 'run-03', provider: 'vertex', estimatedMaximum: 1 })).toThrow('kill switch');
  });

  it('S10-SOAK-01 completes 100 deterministic audit runs without mutation or contract failures', () => {
    const project = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    const before = JSON.stringify(project);
    const runs = Array.from({ length: 100 }, (_, index) => runFixtureContinuityAudit(
      project,
      { kind: 'project', id: null },
      new Date(Date.parse('2026-09-02T08:00:00.000Z') + index).toISOString(),
    ));
    expect(runs).toHaveLength(100);
    expect(runs.every((run) => run.findings.length <= 5 && run.run.sourceFingerprint.startsWith('audit-v1-'))).toBe(true);
    expect(JSON.stringify(project)).toBe(before);
  });

  it('S10-UT-01 reports supervised-live readiness only when soak, development, and sealed holdout gates pass', () => {
    expect(buildCinemaReadinessReport({
      attemptedFixtureRuns: 100, passedFixtureRuns: 100,
      developmentCases: 18, developmentScore: 1,
      holdoutCases: 6, holdoutScore: 1,
    })).toMatchObject({
      status: 'ready-for-supervised-live-smoke', telemetryPolicy: 'no-content-v1',
      cloudEvaluation: 'not-run', cloudTrace: 'not-enabled', blockers: [],
    });
    expect(buildCinemaReadinessReport({
      attemptedFixtureRuns: 100, passedFixtureRuns: 99,
      developmentCases: 18, developmentScore: 1,
      holdoutCases: 6, holdoutScore: 1,
    }).status).toBe('blocked');
  });
});
