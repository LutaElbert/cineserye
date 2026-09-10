import { z } from 'zod';
import { validateScenePlanningBrief, type ScenePlanningBrief } from './scene-brief';
import { validateCinemaProjectData } from './project-data';
import type { PlanSceneSuccess } from '../../features/scene-planner/plan-scene-api';
import { continuityCatalogFromContext, validatePlanContinuityCatalog } from './continuity-identity';

const id = z.string().min(1).max(160).regex(/^[a-zA-Z0-9_.:-]+$/).refine((value) => !['__proto__', 'constructor', 'prototype'].includes(value));
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const brief = z.unknown().transform((value, context): ScenePlanningBrief => {
  try { return validateScenePlanningBrief(value); }
  catch { context.addIssue({ code: 'custom', message: 'Invalid scoped scene brief.' }); return z.NEVER; }
});
export const ScopedShotInputSchema = z.object({
  version: z.literal(1), projectId: id, premiseNodeId: id,
  scenes: z.array(z.object({ sceneId: id, sourceDigest: digest, title: z.string().min(1).max(500), brief, planningContext: z.string().max(50_000),
    continuityIds: z.array(id).max(2_500).refine((ids) => new Set(ids).size === ids.length).optional(),
  }).strict()).min(1).max(10),
}).strict().refine((value) => new Set(value.scenes.map((scene) => scene.sceneId)).size === value.scenes.length
  && new Set(value.scenes.map((scene) => scene.brief.sceneNodeId)).size === value.scenes.length, 'Duplicate scene scope.');
export type ScopedShotInput = z.infer<typeof ScopedShotInputSchema>;

export function scopedPlanMatchesInput(result: PlanSceneSuccess, scene: ScopedShotInput['scenes'][number], mode: 'fixture' | 'live', runId: string) {
  try { validatePlanContinuityCatalog(result.cinema, continuityCatalogFromContext(scene.planningContext)); } catch { return false; }
  const planned = result.cinema.scenes[scene.sceneId];
  const duration = Object.values(result.cinema.shots).reduce((sum, shot) => sum + shot.durationSeconds, 0);
  return result.runId === runId && result.mode === mode && result.cinema.activeSceneId === scene.sceneId
    && planned?.nodeId === scene.brief.sceneNodeId && planned.brief?.aspectRatio === scene.brief.aspectRatio
    && planned.brief.targetDurationSeconds === scene.brief.targetDurationSeconds
    && Math.abs(duration - scene.brief.targetDurationSeconds) < 0.000001;
}

/** Saved provider results are untrusted. Validate sidecar and scope again before
 * compiling/applying any commands at the editor boundary. */
export function validateScopedPlan(value: unknown): PlanSceneSuccess {
  const envelope = z.object({ ok: z.literal(true), version: z.literal(1), mode: z.enum(['fixture', 'live']), runId: id,
    proposal: z.object({ version: z.literal(1), proposalId: id, summary: z.string().max(20_000), commands: z.array(z.unknown()).min(1).max(500) }).strict(),
    cinema: z.unknown(), sourceCount: z.number().int().min(0).max(1000), warnings: z.array(z.string().max(5000)).max(100),
    trace: z.array(z.unknown()).max(100),
  }).strict().parse(value);
  const raw = envelope.cinema as { projectNodeId?: string; scenes?: Record<string, { nodeId: string }>; shots?: Record<string, { nodeId: string }>; characters?: Record<string, { nodeId: string }>; assets?: Record<string, { nodeId: string }>; agentRuns?: Record<string, { nodeId: string }> };
  const ids = new Set<string>(raw?.projectNodeId ? [raw.projectNodeId] : []);
  for (const records of [raw?.scenes, raw?.shots, raw?.characters, raw?.assets, raw?.agentRuns]) for (const record of Object.values(records ?? {})) ids.add(record.nodeId);
  const cinema = validateCinemaProjectData(envelope.cinema, ids);
  if (!cinema.activeSceneId || Object.keys(cinema.scenes).length !== 1) throw Error('Each scoped result must contain exactly one scene.');
  return { ...envelope, cinema } as PlanSceneSuccess;
}
const resultSchema = z.unknown().transform((value, context): PlanSceneSuccess => {
  try { return validateScopedPlan(value); } catch { context.addIssue({ code: 'custom', message: 'Invalid saved shot proposal.' }); return z.NEVER; }
});
export const ScopedShotJobSchema = z.object({ sceneId: id, runId: id, title: z.string().max(500), sourceDigest: digest,
  status: z.enum(['queued', 'running', 'ready', 'failed', 'cancelled', 'outcome-unknown']),
  result: resultSchema.nullable(), error: z.string().max(2000).nullable(),
  dispatchState: z.enum(['not-dispatched', 'may-have-dispatched', 'completed']).optional(),
  attemptRequestId: z.string().uuid().optional(), retryOfRunId: id.optional(),
}).strict().refine((job) => (job.status === 'ready') === Boolean(job.result)
  && (job.dispatchState !== 'completed' || job.status === 'ready')
  && (job.dispatchState !== 'not-dispatched' || ['queued', 'failed', 'cancelled'].includes(job.status)));
export type ScopedShotJob = z.infer<typeof ScopedShotJobSchema>;
export const ScopedShotRetrySchema = z.object({ parentRequestId: z.string().uuid(), parentStateDigest: digest,
  jobs: z.array(z.object({ sceneId: id, runId: id, sourceDigest: digest }).strict()).min(1).max(10),
}).strict().refine((retry) => new Set(retry.jobs.map((job) => job.sceneId)).size === retry.jobs.length
  && new Set(retry.jobs.map((job) => job.runId)).size === retry.jobs.length);
export type ScopedShotRetry = z.infer<typeof ScopedShotRetrySchema>;
export const ScopedShotStateSchema = z.object({ version: z.literal(1), requestId: z.string().uuid(), projectId: id,
  input: ScopedShotInputSchema, inputDigest: digest, quoteId: digest,
  mode: z.enum(['fixture', 'live']), model: z.string().min(1).max(200),
  estimatedCost: z.number().finite().nonnegative(), actualCost: z.number().finite().nonnegative().nullable(),
  status: z.enum(['running', 'review', 'cancelled', 'outcome-unknown']),
  jobs: z.array(ScopedShotJobSchema).min(1).max(10), acceptedSceneIds: z.array(id).max(10),
  rootRequestId: z.string().uuid().optional(), parentRequestId: z.string().uuid().optional(), parentStateDigest: digest.optional(),
  retrySceneIds: z.array(id).min(1).max(10).optional(), successorRequestId: z.string().uuid().optional(),
}).strict().refine((state) => state.projectId === state.input.projectId && state.jobs.length === state.input.scenes.length
  && state.jobs.every((job, index) => job.sceneId === state.input.scenes[index].sceneId && job.sourceDigest === state.input.scenes[index].sourceDigest)
  && state.jobs.every((job, index) => !job.result || scopedPlanMatchesInput(job.result, state.input.scenes[index], state.mode, job.runId))
  && new Set(state.jobs.map((job) => job.runId)).size === state.jobs.length
  && new Set(state.acceptedSceneIds).size === state.acceptedSceneIds.length
  && state.acceptedSceneIds.every((id) => state.jobs.some((job) => job.sceneId === id && job.status === 'ready'))
  && (!state.parentRequestId || (state.parentRequestId !== state.requestId && Boolean(state.parentStateDigest) && Boolean(state.rootRequestId) && Boolean(state.retrySceneIds)))
  && (!state.successorRequestId || state.successorRequestId !== state.requestId)
  && (!state.retrySceneIds || (new Set(state.retrySceneIds).size === state.retrySceneIds.length && state.retrySceneIds.every((sceneId) => state.jobs.some((job) => job.sceneId === sceneId)))));
export type ScopedShotState = z.infer<typeof ScopedShotStateSchema>;
export const ScopedShotQuoteSchema = z.object({ version: z.literal(1), mode: z.enum(['fixture', 'live']), model: z.string().min(1).max(200), quoteId: digest,
  ready: z.boolean(), blockers: z.array(z.string().max(2000)).max(30), perSceneEstimate: z.number().finite().nonnegative(), ceiling: z.number().finite().nonnegative(), maxScenes: z.literal(10), maxAttemptsPerScene: z.literal(1) }).strict();
export type ScopedShotQuote = z.infer<typeof ScopedShotQuoteSchema>;
export const ScopedShotResponseSchema = z.object({ ok: z.boolean(), error: z.string().optional(), dispatchCertainty: z.enum(['not-dispatched', 'unknown']).optional(), state: ScopedShotStateSchema.nullable().optional(), quote: ScopedShotQuoteSchema.optional() }).strict();
export function scopedShotApprovalContent(input: ScopedShotInput, quoteId: string, retry?: ScopedShotRetry) { return { input, quoteId, maxAttemptsPerScene: 1, ...(retry ? { retry } : {}) }; }
/** Old/imported jobs without authoritative no-dispatch evidence are never eligible. */
export function scopedShotRetryEligible(job: ScopedShotJob): boolean {
  return job.dispatchState === 'not-dispatched' && ['queued', 'failed', 'cancelled'].includes(job.status) && job.result === null;
}
/** UI acceptance is tracked separately; it must not invalidate immutable provider lineage. */
export function scopedShotRetryParentContent(state: ScopedShotState) {
  const { acceptedSceneIds: _accepted, successorRequestId: _successor, ...snapshot } = state;
  void _accepted; void _successor;
  return snapshot;
}
