import 'server-only';

import type { ScenePlanningBrief } from '../../../domain/cinema/scene-brief';
import type { PlanSceneFailure } from '../../../features/scene-planner/plan-scene-api';
import { readCinemaProviderConfig } from '../../../server/cinema/provider-config';
import { ProviderError, publicProviderError } from '../../../server/cinema/provider-errors';
import { fixtureWorkflowDependencies, runCinemaPlanningWorkflow } from '../../../server/cinema/workflow';

const MAX_REQUEST_BYTES = 64 * 1024;

export async function POST(request: Request): Promise<Response> {
  try {
    const source = await request.text();
    if (source.length > MAX_REQUEST_BYTES) {
      throw new ProviderError('INVALID_REQUEST', 'The scene brief is too large.');
    }
    let brief: ScenePlanningBrief;
    try {
      brief = JSON.parse(source) as ScenePlanningBrief;
    } catch {
      throw new ProviderError('INVALID_REQUEST', 'The scene brief is not valid JSON.');
    }
    const config = readCinemaProviderConfig();
    if (config.mode !== 'fixture') {
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'Live providers are not enabled in this local build.', true);
    }
    const result = await runCinemaPlanningWorkflow(brief, fixtureWorkflowDependencies(), request.signal);
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
