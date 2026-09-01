import 'server-only';

import type { CinemaProviderStatus } from '../../../features/scene-planner/plan-scene-api';
import { readCinemaProviderConfig } from '../../../server/cinema/provider-config';
import { publicProviderError } from '../../../server/cinema/provider-errors';

export async function GET(): Promise<Response> {
  try {
    const config = readCinemaProviderConfig();
    const response: CinemaProviderStatus = {
      mode: config.mode,
      requiresContentTransferConsent: config.mode === 'live',
    };
    return Response.json(response);
  } catch (error) {
    return Response.json({ ok: false, error: publicProviderError(error) }, { status: 503 });
  }
}
