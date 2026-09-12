import 'server-only';
import { WorkflowCapabilitiesSchema, type WorkflowCapabilities } from '../../features/story-development/workflow-capabilities';
import { readCinemaProviderConfig } from './provider-config';
import { assistantQuote } from './story-assistant';
import { storyQuote } from './story-development';
import { storyboardPreflight } from './storyboard-preflight';
import { scopedShotQuote } from './scoped-shot-planning';
import { isNativeRuntime } from './native-runtime';
import { buildCinemaLivePreflight } from './live-preflight';
import { CINEMA_TELEMETRY_POLICY } from './telemetry';
import { videoPolicy } from './video-policy';

/** Configuration evidence only: no model requests, credential probes, DB writes or media execution. */
export function workflowCapabilities(environment: Record<string, string | undefined> = process.env): WorkflowCapabilities {
  const config = readCinemaProviderConfig(environment, false), mode = config.mode;
  const node = isNativeRuntime();
  const fixture = mode === 'fixture';
  const planningConfigured = fixture || Boolean(config.googleCloudProject && config.activeGoogleAccount && config.adcQuotaProject);
  const researchConfigured = fixture || Boolean(config.parallelApiKey);
  const common = buildCinemaLivePreflight(config);
  const analysis = assistantQuote(mode, environment), story = storyQuote(mode, environment);
  const runtimeBlockers = node ? [] : ['This runtime has no approved durable story-operation adapter.'];
  for (const quote of [analysis, story]) { quote.blockers.push(...runtimeBlockers); quote.ready = quote.ready && node; }
  const readyStage = (provider: string, model: string | null, configured: boolean, enabled: boolean, reasons: string[], preflightPath: string, reviewOnly = false) => {
    const blockers = [...new Set([...reasons, ...runtimeBlockers,
      ...(!configured ? ['Provider configuration is incomplete.'] : []), ...(!enabled ? ['Execution policy is disabled.'] : [])])];
    const blocked = blockers.length > 0;
    return { configured, enabled, ready: !blocked && !reviewOnly,
      status: blocked ? 'blocked' as const : reviewOnly ? 'requires-preflight' as const : fixture ? 'fixture' as const : 'configured-unverified' as const,
      provider, model, blockers: !blocked && reviewOnly ? ['Review current local capability, approved inputs and request limits before execution.'] : blockers, preflightPath };
  };
  const shots = scopedShotQuote(environment);
  const shotBlockers = [...shots.blockers, ...runtimeBlockers];
  const image = storyboardPreflight(environment as NodeJS.ProcessEnv);
  const video = videoPolicy(environment);
  const researchBlockers = [...(fixture ? [] : common.blockers), ...(!researchConfigured ? ['Parallel research is not configured.'] : [])];
  const legacyBlockers = [...researchBlockers, ...runtimeBlockers];
  return WorkflowCapabilitiesSchema.parse({ version: 2, mode, runtime: node ? 'local-node' : 'unsupported', proof: 'configuration-only', analysis, story,
    legacyPlanning: { mode, requiresContentTransferConsent: !fixture,
      research: { configured: researchConfigured, provider: fixture ? 'fixture-research' : 'parallel' },
      planning: { configured: planningConfigured, provider: fixture ? 'fixture-shot-planner' : 'vertex-gemini', model: fixture ? 'fixture-v1' : config.vertexModel },
      telemetryPolicy: CINEMA_TELEMETRY_POLICY,
      livePreflight: { ready: legacyBlockers.length === 0, blockers: legacyBlockers, maxLiveRunCost: config.maxLiveRunCost } },
    stages: {
      research: readyStage(fixture ? 'fixture-research' : 'parallel', null, researchConfigured, fixture || config.liveExecutionEnabled, researchBlockers, '/api/cinema/plan-scene'),
      analysis: readyStage(fixture ? 'fixture' : 'vertex-gemini', analysis.model, planningConfigured, analysis.enabled, analysis.blockers, '/api/cinema/story-assistant'),
      story: readyStage(fixture ? 'fixture' : 'vertex-gemini', story.model, planningConfigured, story.enabled, story.blockers, '/api/cinema/develop-story'),
      shots: readyStage(fixture ? 'fixture' : 'parallel+vertex-adk', shots.model, planningConfigured && researchConfigured, fixture || config.liveExecutionEnabled, shotBlockers, '/api/cinema/plan-scenes'),
      uploads: { configured: true, enabled: true, ready: true, status: 'local-only', provider: 'browser-local', model: null, blockers: [], preflightPath: null },
      images: readyStage(fixture ? 'fixture' : 'vertex-gemini-image', image.model, planningConfigured, fixture || config.liveExecutionEnabled, image.blockers, '/api/cinema/generate-storyboard'),
      video: readyStage(fixture ? 'fixture' : 'vertex-veo', video.profile.model, planningConfigured, fixture || config.liveExecutionEnabled, video.blockers, '/api/cinema/generate-video', true),
      assembly: readyStage('local-ffmpeg', null, node, true, [], '/api/cinema/assemble', true),
    } });
}
