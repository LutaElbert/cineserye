export type CinemaSpendEntry = {
  runId: string;
  provider: 'parallel' | 'vertex';
  estimatedMaximum: number;
  actual: number | null;
  status: 'reserved' | 'settled' | 'cancelled';
};

export type CinemaSpendLedger = {
  version: 1;
  ceiling: number;
  killSwitch: boolean;
  entries: CinemaSpendEntry[];
};

export type CinemaReadinessReport = {
  version: 1;
  status: 'ready-for-supervised-live-smoke' | 'blocked';
  fixtureRuns: { attempted: number; passed: number };
  developmentEval: { cases: number; score: number };
  holdoutEval: { cases: number; score: number };
  telemetryPolicy: 'no-content-v1';
  cloudEvaluation: 'not-run';
  cloudTrace: 'not-enabled';
  blockers: string[];
};

export function createCinemaSpendLedger(ceiling: number): CinemaSpendLedger {
  if (!Number.isFinite(ceiling) || ceiling <= 0) throw new Error('Spend ledger ceiling must be positive.');
  return { version: 1, ceiling, killSwitch: false, entries: [] };
}

export function reserveCinemaSpend(
  ledger: CinemaSpendLedger,
  entry: Omit<CinemaSpendEntry, 'actual' | 'status'>,
): CinemaSpendLedger {
  if (ledger.killSwitch) throw new Error('Provider spending is stopped by the local kill switch.');
  if (!Number.isFinite(entry.estimatedMaximum) || entry.estimatedMaximum <= 0) throw new Error('Spend reservation is invalid.');
  if (ledger.entries.some((candidate) => candidate.runId === entry.runId && candidate.provider === entry.provider)) {
    throw new Error('Spend reservation already exists.');
  }
  const reserved = ledger.entries
    .filter((candidate) => candidate.status === 'reserved')
    .reduce((sum, candidate) => sum + candidate.estimatedMaximum, 0);
  const settled = ledger.entries
    .filter((candidate) => candidate.status === 'settled')
    .reduce((sum, candidate) => sum + (candidate.actual ?? candidate.estimatedMaximum), 0);
  if (reserved + settled + entry.estimatedMaximum > ledger.ceiling) throw new Error('Spend reservation exceeds the configured ceiling.');
  return { ...structuredClone(ledger), entries: [...structuredClone(ledger.entries), { ...entry, actual: null, status: 'reserved' }] };
}

export function settleCinemaSpend(
  ledger: CinemaSpendLedger,
  runId: string,
  provider: CinemaSpendEntry['provider'],
  actual: number | null,
  status: 'settled' | 'cancelled',
): CinemaSpendLedger {
  const next = structuredClone(ledger);
  const entry = next.entries.find((candidate) => candidate.runId === runId && candidate.provider === provider);
  if (!entry || entry.status !== 'reserved') throw new Error('Spend reservation is missing.');
  if (actual !== null && (!Number.isFinite(actual) || actual < 0 || actual > entry.estimatedMaximum)) {
    throw new Error('Provider spend is outside its reservation.');
  }
  entry.actual = actual;
  entry.status = status;
  return next;
}

export function setCinemaSpendKillSwitch(ledger: CinemaSpendLedger, enabled: boolean): CinemaSpendLedger {
  return { ...structuredClone(ledger), killSwitch: enabled };
}

export function buildCinemaReadinessReport(input: {
  attemptedFixtureRuns: number;
  passedFixtureRuns: number;
  developmentCases: number;
  developmentScore: number;
  holdoutCases: number;
  holdoutScore: number;
}): CinemaReadinessReport {
  const blockers = [
    ...(input.attemptedFixtureRuns < 100 || input.passedFixtureRuns !== input.attemptedFixtureRuns ? ['The 100-run fixture soak is incomplete or has failures.'] : []),
    ...(input.developmentCases < 18 || input.developmentScore !== 1 ? ['The 18-case development evaluation has not passed at 1.0.'] : []),
    ...(input.holdoutCases < 6 || input.holdoutScore !== 1 ? ['The six-case sealed holdout evaluation has not passed at 1.0.'] : []),
  ];
  return {
    version: 1,
    status: blockers.length ? 'blocked' : 'ready-for-supervised-live-smoke',
    fixtureRuns: { attempted: input.attemptedFixtureRuns, passed: input.passedFixtureRuns },
    developmentEval: { cases: input.developmentCases, score: input.developmentScore },
    holdoutEval: { cases: input.holdoutCases, score: input.holdoutScore },
    telemetryPolicy: 'no-content-v1',
    cloudEvaluation: 'not-run',
    cloudTrace: 'not-enabled',
    blockers,
  };
}
