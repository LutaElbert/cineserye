import 'server-only';

import type { CinemaProviderStatus } from '../../../features/scene-planner/plan-scene-api';
import { readCinemaProviderConfig } from '../../../server/cinema/provider-config';
import { publicProviderError } from '../../../server/cinema/provider-errors';
import { CINEMA_TELEMETRY_POLICY } from '../../../server/cinema/telemetry';
import { buildCinemaLivePreflight } from '../../../server/cinema/live-preflight';

export async function GET(): Promise<Response> {
  try {
    const config = readCinemaProviderConfig();
    const livePreflight = buildCinemaLivePreflight(config);
    const response: CinemaProviderStatus = {
      mode: config.mode,
      requiresContentTransferConsent: config.mode === 'live',
      research: {
        configured: config.mode === 'fixture' || Boolean(config.parallelApiKey),
        provider: config.mode === 'fixture' ? 'fixture-research' : 'parallel',
      },
      planning: {
        configured: config.mode === 'fixture' || Boolean(config.googleCloudProject),
        provider: config.mode === 'fixture' ? 'fixture-shot-planner' : 'vertex-gemini',
        model: config.mode === 'fixture' ? 'fixture-v1' : config.vertexModel,
      },
      telemetryPolicy: CINEMA_TELEMETRY_POLICY,
      livePreflight: {
        ready: config.mode === 'fixture' || livePreflight.ready,
        blockers: config.mode === 'fixture' ? [] : livePreflight.blockers,
        maxLiveRunCost: config.maxLiveRunCost,
      },
    };
    return Response.json(response);
  } catch (error) {
    return Response.json({ ok: false, error: publicProviderError(error) }, { status: 503 });
  }
}
