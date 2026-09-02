import type { CinemaProjectData } from '../../domain/cinema/project-data';
import type { CanvasCommandProposal } from '../../editor/canvas-commands';
import type { ScenePlanningBrief } from '../../domain/cinema/scene-brief';
import type { CinemaConsentReceipt } from '../../domain/cinema/live-consent';

export type ProviderErrorCode =
  | 'CANCELLED'
  | 'INVALID_CONFIGURATION'
  | 'INVALID_REQUEST'
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'UNEXPECTED_RESPONSE';

export type PlanSceneRequest = {
  version: 1;
  idempotencyKey: string;
  brief: ScenePlanningBrief;
  liveProviderConsent: boolean;
  liveConsentReceipt: CinemaConsentReceipt | null;
};

export type CinemaProviderStatus = {
  mode: 'fixture' | 'live';
  requiresContentTransferConsent: boolean;
  research: { configured: boolean; provider: string };
  planning: { configured: boolean; provider: string; model: string | null };
  telemetryPolicy: 'no-content-v1';
  livePreflight: { ready: boolean; blockers: string[]; maxLiveRunCost: number | null };
};

export type PlanSceneSuccess = {
  ok: true;
  version: 1;
  mode: 'fixture' | 'live';
  runId: string;
  proposal: CanvasCommandProposal;
  cinema: CinemaProjectData;
  sourceCount: number;
  warnings: string[];
  trace: CinemaClientTraceEvent[];
};

export type CinemaClientTraceEvent = {
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

export type PlanSceneFailure = {
  ok: false;
  error: {
    code: ProviderErrorCode;
    message: string;
    retryable: boolean;
  };
};

export type PlanSceneResponse = PlanSceneSuccess | PlanSceneFailure;
