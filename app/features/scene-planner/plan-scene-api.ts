import type { CinemaProjectDataV1 } from '../../domain/cinema/project-data';
import type { CanvasCommandProposal } from '../../editor/canvas-commands';

export type ProviderErrorCode =
  | 'CANCELLED'
  | 'INVALID_CONFIGURATION'
  | 'INVALID_REQUEST'
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'UNEXPECTED_RESPONSE';

export type PlanSceneSuccess = {
  ok: true;
  version: 1;
  mode: 'fixture' | 'live';
  runId: string;
  proposal: CanvasCommandProposal;
  cinema: CinemaProjectDataV1;
  sourceCount: number;
  warnings: string[];
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
