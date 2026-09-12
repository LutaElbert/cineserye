import 'server-only';
import { readCinemaProviderConfig } from './provider-config';
import { buildCinemaLivePreflight } from './live-preflight';
import { FIXTURE_VIDEO_CAPABILITIES, createVertexVideoCapabilities } from './video-capabilities';

/** Shared configuration-only policy; never constructs a provider or probes media. */
export function videoPolicy(environment: Record<string, string | undefined> = process.env) {
  const common = readCinemaProviderConfig(environment, false);
  const mode = common.mode;
  if (mode === 'fixture') return { mode, profile: FIXTURE_VIDEO_CAPABILITIES, unitCost: 0, spendLimit: 0, blockers: [] as string[] };
  const profile = createVertexVideoCapabilities(environment.CINESERYE_VERTEX_VIDEO_MODEL?.trim() || 'veo-3.1-fast-generate-001');
  const unitCost = environment.CINESERYE_VIDEO_USD_PER_SECOND ? Number(environment.CINESERYE_VIDEO_USD_PER_SECOND) : null;
  const spendLimit = environment.CINESERYE_VIDEO_MAX_ESTIMATED_USD ? Number(environment.CINESERYE_VIDEO_MAX_ESTIMATED_USD) : null;
  const blockers = [...buildCinemaLivePreflight(common).blockers];
  if (unitCost === null || !Number.isFinite(unitCost) || unitCost <= 0) blockers.push('A positive finite live video unit price is required.');
  if (spendLimit === null || !Number.isFinite(spendLimit) || spendLimit <= 0 || common.maxLiveRunCost === null || spendLimit > common.maxLiveRunCost) blockers.push('A positive video ceiling within the common live run ceiling is required.');
  // This is an operator switch, not identity-bound execution evidence.
  if (environment.CINESERYE_VIDEO_LIVE_ENABLED !== 'true' || environment.CINESERYE_VIDEO_LIVE_VERIFIED !== 'true') {
    blockers.push('Live video awaits separately approved live verification and explicit operator enablement. Local durability tests do not establish provider readiness.');
  }
  return { mode, profile, unitCost, spendLimit, blockers };
}
