import type { ScenePlanningBrief } from '../../domain/cinema/scene-brief';
import { createCinemaConsentReceipt, type CinemaConsentReceipt } from '../../domain/cinema/live-consent';
import type { CinemaProviderConfig } from './provider-config';
import { ProviderError } from './provider-errors';

export type CinemaLivePreflight = {
  ready: boolean;
  account: { expected: 'elbertluta@gmail.com'; active: string | null; matches: boolean };
  project: { expected: 'cineserye'; configured: string; matches: boolean };
  quotaProject: { expected: 'cineserye'; configured: string | null; matches: boolean };
  killSwitchEnabled: boolean;
  maxLiveRunCost: number | null;
  blockers: string[];
};

export function buildCinemaLivePreflight(config: CinemaProviderConfig): CinemaLivePreflight {
  const accountMatches = config.activeGoogleAccount === config.expectedGoogleAccount;
  const projectMatches = config.googleCloudProject === 'cineserye';
  const quotaMatches = config.adcQuotaProject === 'cineserye';
  const blockers = [
    ...(!config.liveExecutionEnabled ? ['Local live-provider switch is off.'] : []),
    ...(!accountMatches ? [`Active Google account must be ${config.expectedGoogleAccount}.`] : []),
    ...(!projectMatches ? ['Google Cloud project must be cineserye.'] : []),
    ...(!quotaMatches ? ['ADC quota project must be cineserye.'] : []),
    ...(config.maxLiveRunCost === null ? ['A positive per-run provider ceiling is required.'] : []),
  ];
  return {
    ready: blockers.length === 0,
    account: { expected: config.expectedGoogleAccount, active: config.activeGoogleAccount, matches: accountMatches },
    project: { expected: 'cineserye', configured: config.googleCloudProject, matches: projectMatches },
    quotaProject: { expected: 'cineserye', configured: config.adcQuotaProject, matches: quotaMatches },
    killSwitchEnabled: config.liveExecutionEnabled,
    maxLiveRunCost: config.maxLiveRunCost,
    blockers,
  };
}

export function assertCinemaLivePreflight(
  config: CinemaProviderConfig,
  brief: ScenePlanningBrief,
  consent: boolean,
  receipt: CinemaConsentReceipt | null,
) {
  if (config.mode !== 'live') return;
  const preflight = buildCinemaLivePreflight(config);
  if (!preflight.ready) throw new ProviderError('INVALID_CONFIGURATION', preflight.blockers[0]);
  if (!consent || !receipt) throw new ProviderError('INVALID_REQUEST', 'Confirm the live provider content transfer and cost ceiling before planning.');
  const expected = createCinemaConsentReceipt(brief, receipt.approvedMaxCost, receipt.approvedAt, config.vertexModel);
  if (receipt.policyVersion !== 1
    || receipt.planningModel !== config.vertexModel
    || receipt.contentDigest !== expected.contentDigest) {
    throw new ProviderError('INVALID_REQUEST', 'The live consent receipt does not match this scene brief, provider model, or cost ceiling.');
  }
  if (config.maxLiveRunCost === null || receipt.approvedMaxCost > config.maxLiveRunCost) {
    throw new ProviderError('INVALID_REQUEST', 'The approved live run cost exceeds the operator ceiling.');
  }
}
