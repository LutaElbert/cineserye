import 'server-only';
import { WorkflowCapabilitiesSchema, type WorkflowCapabilities } from '../../features/story-development/workflow-capabilities';
import { readCinemaProviderConfig } from './provider-config';
import { assistantQuote } from './story-assistant';
import { storyQuote } from './story-development';
import { storyboardPreflight } from './storyboard-preflight';
import { scopedShotQuote } from './scoped-shot-planning';

/** Configuration evidence only: no model requests, credential probes, DB writes or media execution. */
export function workflowCapabilities(environment: Record<string, string | undefined> = process.env): WorkflowCapabilities {
  const config = readCinemaProviderConfig(environment, false), mode = config.mode;
  const node = typeof process !== 'undefined' && process.release?.name === 'node' && typeof process.getBuiltinModule === 'function';
  const analysis = assistantQuote(mode, environment), story = storyQuote(mode, environment);
  const runtimeBlockers = node ? [] : ['This runtime has no approved durable story-operation adapter.'];
  for (const quote of [analysis, story]) { quote.blockers.push(...runtimeBlockers); quote.ready = quote.ready && node; }
  const readyStage = (provider: string, model: string | null, enabled: boolean, blockers: string[], preflightPath: string) => ({
    configured: true, enabled, ready: enabled && blockers.length === 0,
    status: !enabled || blockers.length ? 'blocked' as const : mode === 'fixture' ? 'fixture' as const : 'configured-unverified' as const,
    provider, model, blockers, preflightPath,
  });
  const shots = scopedShotQuote(environment);
  const shotBlockers = [...shots.blockers, ...runtimeBlockers];
  const image = storyboardPreflight(environment as NodeJS.ProcessEnv);
  return WorkflowCapabilitiesSchema.parse({ version: 1, mode, runtime: node ? 'local-node' : 'unsupported', proof: 'configuration-only', analysis, story,
    stages: {
      analysis: readyStage(mode === 'live' ? 'vertex-gemini' : 'fixture', analysis.model, analysis.enabled, analysis.blockers, '/api/cinema/story-assistant'),
      story: readyStage(mode === 'live' ? 'vertex-gemini' : 'fixture', story.model, story.enabled, story.blockers, '/api/cinema/develop-story'),
      shots: readyStage(mode === 'live' ? 'parallel+vertex-adk' : 'fixture', shots.model, true, shotBlockers, '/api/cinema/plan-scenes'),
      images: readyStage(mode === 'live' ? 'vertex-gemini-image' : 'fixture', image.model, true, image.blockers, '/api/cinema/generate-storyboard'),
      video: { configured: true, enabled: false, ready: false, status: 'requires-preflight', provider: mode === 'live' ? 'vertex-veo' : 'fixture', model: null,
        blockers: ['Review native-local video capability, separate live verification and exact media-spend approval.'], preflightPath: '/api/cinema/generate-video' },
      assembly: { configured: node, enabled: false, ready: false, status: 'requires-preflight', provider: 'local-ffmpeg', model: null,
        blockers: ['Local-only silent MP4: inspect renderer capability and approved current clips first.'], preflightPath: '/api/cinema/assemble' },
    } });
}
