import { z } from 'zod';
import { StoryQuoteSchema } from './contracts';

const stage = z.object({ configured: z.boolean(), enabled: z.boolean(), ready: z.boolean(),
  status: z.enum(['blocked', 'fixture', 'configured-unverified', 'requires-preflight', 'local-only']),
  provider: z.string(), model: z.string().nullable(), blockers: z.array(z.string()), preflightPath: z.string().nullable(),
}).strict().superRefine((value, ctx) => {
  const ready = ['fixture', 'configured-unverified', 'local-only'].includes(value.status);
  if (value.ready !== ready || (ready && (!value.configured || !value.enabled || value.blockers.length))
    || (value.status === 'blocked' && !value.blockers.length)
    || (value.status === 'requires-preflight' && (!value.configured || !value.enabled || !value.preflightPath))) {
    ctx.addIssue({ code: 'custom', message: 'Inconsistent capability state.' });
  }
});
const legacyStatus = z.object({ mode: z.enum(['fixture', 'live']), requiresContentTransferConsent: z.boolean(),
  research: z.object({ configured: z.boolean(), provider: z.string() }).strict(),
  planning: z.object({ configured: z.boolean(), provider: z.string(), model: z.string().nullable() }).strict(),
  telemetryPolicy: z.literal('no-content-v1'),
  livePreflight: z.object({ ready: z.boolean(), blockers: z.array(z.string()), maxLiveRunCost: z.number().positive().nullable() }).strict(),
}).strict();
export const WorkflowCapabilitiesSchema = z.object({ version: z.literal(2), mode: z.enum(['fixture', 'live']),
  runtime: z.enum(['local-node', 'unsupported']), proof: z.literal('configuration-only'),
  analysis: StoryQuoteSchema, story: StoryQuoteSchema,
  stages: z.object({ research: stage, analysis: stage, story: stage, shots: stage, uploads: stage, images: stage, video: stage, assembly: stage }).strict(),
  // Compatibility projection for the retained single-scene planner, not a
  // second discovery request or evidence of successful provider execution.
  legacyPlanning: legacyStatus,
}).strict().superRefine((value, ctx) => {
  if ([value.analysis.mode, value.story.mode, value.legacyPlanning.mode].some((mode) => mode !== value.mode)
    || value.legacyPlanning.requiresContentTransferConsent !== (value.mode === 'live')
    || value.analysis.ready !== value.stages.analysis.ready || value.story.ready !== value.stages.story.ready
    || value.stages.uploads.status !== 'local-only'
    || Object.entries(value.stages).some(([key, stage]) => key !== 'uploads' && stage.status === 'local-only')
    || value.runtime === 'unsupported' && (value.analysis.ready || value.story.ready || value.legacyPlanning.livePreflight.ready)
    || Object.values(value.stages).some((stage) => stage.status === 'fixture' && value.mode !== 'fixture'
      || stage.status === 'configured-unverified' && value.mode !== 'live')
    || Object.entries(value.stages).some(([key, stage]) => value.runtime === 'unsupported' && key !== 'uploads' && stage.status !== 'blocked')) {
    ctx.addIssue({ code: 'custom', message: 'Capability mode or runtime mismatch.' });
  }
});
export type WorkflowCapabilities = z.infer<typeof WorkflowCapabilitiesSchema>;
export const capabilityLabels = { research: 'Research', analysis: 'Idea analysis', story: 'Scene planning', shots: 'Shot planning', uploads: 'Local reference uploads', images: 'Reference images', video: 'Video generation', assembly: 'Final Cut' } as const;
export const capabilityStatusLabels = { blocked: 'Blocked', fixture: 'Fixture only', 'configured-unverified': 'Configured · unverified', 'requires-preflight': 'Review required', 'local-only': 'Local only' } as const;
export function capabilityDescription(stage: WorkflowCapabilities['stages']['story']) {
  return stage.blockers.join(' ') || (stage.status === 'fixture' ? 'Sample output only. No paid generation.'
    : stage.status === 'local-only' ? 'No provider upload. Local storage availability and save failures are checked on this device.'
      : 'Configuration is not proof of a successful provider run. Fresh scope and spending approval are still required.');
}
