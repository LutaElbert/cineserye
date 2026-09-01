import 'server-only';

import type {
  PlanSceneFailure,
  PlanSceneRequest,
} from '../../../features/scene-planner/plan-scene-api';
import {
  applyCinemaTelemetryPrivacyBaseline,
  assertLiveProviderConsent,
  readCinemaProviderConfig,
} from '../../../server/cinema/provider-config';
import { ProviderError, publicProviderError } from '../../../server/cinema/provider-errors';
import {
  fixtureWorkflowDependencies,
  runCinemaPlanningWorkflow,
} from '../../../server/cinema/workflow';

const MAX_REQUEST_BYTES = 64 * 1024;

export async function POST(request: Request): Promise<Response> {
  try {
    const source = await request.text();
    if (source.length > MAX_REQUEST_BYTES) {
      throw new ProviderError('INVALID_REQUEST', 'The scene brief is too large.');
    }
    let payload: PlanSceneRequest;
    try {
      payload = JSON.parse(source) as PlanSceneRequest;
    } catch {
      throw new ProviderError('INVALID_REQUEST', 'The scene brief is not valid JSON.');
    }
    if (payload.version !== 1 || typeof payload.brief !== 'object' || payload.brief === null) {
      throw new ProviderError('INVALID_REQUEST', 'The scene planning request is malformed.');
    }
    const config = readCinemaProviderConfig();
    applyCinemaTelemetryPrivacyBaseline(config);
    assertLiveProviderConsent(config, payload.liveProviderConsent);
    const dependencies = config.mode === 'live'
      ? (await import('../../../server/cinema/live-workflow')).liveWorkflowDependencies(config)
      : fixtureWorkflowDependencies();
    const result = await runCinemaPlanningWorkflow(payload.brief, dependencies, request.signal);
    return Response.json(result, { status: 200 });
  } catch (error) {
    const safeError = publicProviderError(error);
    const response: PlanSceneFailure = { ok: false, error: safeError };
    const status = safeError.code === 'INVALID_REQUEST' || safeError.code === 'INVALID_CONFIGURATION'
      ? 400
      : safeError.code === 'CANCELLED'
        ? 499
        : 503;
    return Response.json(response, { status });
  }
}
