import 'server-only';
import { z } from 'zod';
import { ScopedShotInputSchema, ScopedShotStateSchema, ScopedShotRetrySchema, scopedShotApprovalContent, scopedShotRetryEligible, scopedShotRetryParentContent, validateScopedPlan, scopedPlanMatchesInput, type ScopedShotInput, type ScopedShotQuote, type ScopedShotState, type ScopedShotJob } from '../../domain/cinema/scoped-shot-planning';
import { readCinemaProviderConfig } from './provider-config';
import { buildCinemaLivePreflight } from './live-preflight';
import { OperationRepository, operationDigest } from './operation-repository';
import { fixtureWorkflowDependencies, runCinemaPlanningWorkflow } from './workflow';
import { ProviderError } from './provider-errors';

export function scopedShotQuote(environment: Record<string, string | undefined> = process.env): ScopedShotQuote {
  const config = readCinemaProviderConfig(environment, false);
  const perSceneEstimate = config.mode === 'fixture' ? 0 : Number(environment.CINESERYE_SHOT_PLAN_ESTIMATED_USD ?? NaN);
  const blockers = config.mode === 'fixture' ? [] : [...buildCinemaLivePreflight(config).blockers,
    ...(!config.parallelApiKey ? ['Parallel research is not configured.'] : []),
    ...(!Number.isFinite(perSceneEstimate) || perSceneEstimate <= 0 || perSceneEstimate > (config.maxLiveRunCost ?? 0) ? ['Configure a positive per-scene planning estimate within the operator ceiling.'] : [])];
  const policy = { version: 1 as const, mode: config.mode, model: config.mode === 'fixture' ? 'fixture-planner-v1' : config.vertexModel,
    perSceneEstimate: Number.isFinite(perSceneEstimate) ? perSceneEstimate : 0, ceiling: config.maxLiveRunCost ?? 0,
    maxScenes: 10 as const, maxAttemptsPerScene: 1 as const, ready: blockers.length === 0, blockers };
  return { ...policy, quoteId: operationDigest(policy) };
}
export const ScopedShotRequestSchema = z.object({ version: z.literal(1), requestId: z.string().uuid(), input: ScopedShotInputSchema,
  quoteId: z.string().regex(/^[a-f0-9]{64}$/), contentDigest: z.string().regex(/^[a-f0-9]{64}$/), consent: z.literal(true),
  approvedEstimate: z.number().finite().nonnegative(), mode: z.enum(['fixture', 'live']), retry: ScopedShotRetrySchema.optional() }).strict();
export type ScopedShotRequest = z.infer<typeof ScopedShotRequestSchema>;
type Dispatch = (scene: ScopedShotInput['scenes'][number], runId: string, signal: AbortSignal, policy: Pick<ScopedShotState, 'mode' | 'model' | 'quoteId'>) => Promise<unknown>;
/** Only trusted local preflight, before entering the provider workflow, may throw this.
 * Transport timeouts, aborts after dispatch, and response-validation errors are NOT proof. */
export class ScopedShotNoDispatchError extends Error {}
/** Rejected synchronously before this new request can enter a provider workflow. */
export class ScopedShotReviewRejection extends ProviderError {
  constructor(message: string) { super('INVALID_REQUEST', message); }
}
type ChildCheckpoint = { version: 1; kind: 'not-dispatched'; error: string } | { version: 1; kind: 'ready'; result: ReturnType<typeof validateScopedPlan> };

/** Local serial coordinator. The manifest is written BEFORE any provider call.
 * A restart exposes unknown/unstarted work; GET never resumes or repurchases it. */
export class ScopedShotCoordinator {
  private active = new Map<string, AbortController>();
  constructor(private repository: OperationRepository, private dispatch: Dispatch) {}
  private key(projectId: string, requestId: string) { return `shot-scope:${projectId}:${requestId}`; }
  private childKey(projectId: string, runId: string) { return `shot-job:${projectId}:${runId}`; }
  private savedChild(state: ScopedShotState, job: ScopedShotJob): ChildCheckpoint | null {
    const row = this.repository.read(this.childKey(state.projectId, job.runId));
    if (row?.status !== 'completed' || !row.result) return null;
    const raw = JSON.parse(row.result) as unknown;
    const noDispatch = z.object({ version: z.literal(1), kind: z.literal('not-dispatched'), error: z.string().max(2000) }).strict().safeParse(raw);
    if (noDispatch.success) return noDispatch.data;
    // Existing successful raw child records remain recoverable; they never prove no-dispatch.
    const result = validateScopedPlan(raw && typeof raw === 'object' && 'kind' in raw && raw.kind === 'ready' && 'result' in raw ? raw.result : raw);
    const scene = state.input.scenes.find((item) => item.sceneId === job.sceneId)!;
    if (!scopedPlanMatchesInput(result, scene, state.mode, job.runId)) throw Error('Recovered result scope mismatch.');
    return { version: 1, kind: 'ready', result };
  }
  private applyChild(job: ScopedShotJob, child: ChildCheckpoint) {
    if (child.kind === 'not-dispatched') { job.status = 'failed'; job.dispatchState = 'not-dispatched'; job.error = child.error; job.result = null; }
    else { job.status = 'ready'; job.dispatchState = 'completed'; job.error = null; job.result = child.result; }
  }
  read(projectId: string, requestId: string): ScopedShotState | null {
    const key = this.key(projectId, requestId), row = this.repository.read(key);
    if (!row?.result) return null;
    const state = ScopedShotStateSchema.parse(JSON.parse(row.result));
    const cancelled = Boolean(this.repository.read(`${key}:cancel`));
    const successor = this.repository.read(`${key}:retry`);
    if (successor?.result) state.successorRequestId = z.object({ requestId: z.string().uuid() }).passthrough().parse(JSON.parse(successor.result)).requestId;
    const inactive = !this.active.has(key);
    for (const job of state.jobs) {
      if (job.status === 'ready') continue;
      if (job.status === 'running' || job.dispatchState === 'may-have-dispatched') {
        try {
          const child = this.savedChild(state, job);
          if (child) { this.applyChild(job, child); continue; }
        } catch { job.result = null; job.status = 'outcome-unknown'; job.dispatchState = 'may-have-dispatched'; job.error = 'Recovered output is invalid or belongs to another scope. Nothing was resent.'; continue; }
        if (cancelled) { job.status = 'cancelled'; job.error = 'Stopped locally; provider work may have been sent. This job is not safe to retry.'; }
        else if (inactive && job.status === 'running') { job.status = 'outcome-unknown'; job.error = 'Server restarted or connection was lost. This operation will not be sent again.'; }
      } else if (cancelled && job.status === 'queued') job.status = 'cancelled';
    }
    if (cancelled) state.status = 'cancelled';
    else if (state.status === 'running' && inactive) state.status = state.jobs.every((job) => ['ready', 'failed'].includes(job.status)) ? 'review' : 'outcome-unknown';
    return ScopedShotStateSchema.parse(state);
  }
  start(raw: unknown, quote: ScopedShotQuote): ScopedShotState {
    const request = ScopedShotRequestSchema.parse(raw), input = request.input;
    const expected = operationDigest(scopedShotApprovalContent(input, quote.quoteId, request.retry));
    const total = Math.round((request.retry?.jobs.length ?? input.scenes.length) * quote.perSceneEstimate * 1e6) / 1e6;
    if (!quote.ready || request.mode !== quote.mode || request.quoteId !== quote.quoteId || request.contentDigest !== expected
      || request.approvedEstimate !== total || (quote.mode === 'live' && total > quote.ceiling)) throw new ScopedShotReviewRejection('Review the current scene scope, provider and aggregate estimate before planning.');
    const key = this.key(input.projectId, request.requestId);
    const digest = operationDigest({ input, quote, total, ...(request.retry ? { retry: request.retry } : {}) });
    let fresh = false;
    const state = this.repository.transaction((): ScopedShotState => {
      if (this.repository.read(key)) {
        this.repository.claim(key, digest); // Validate replay content without reopening the parent claim.
        const previous = this.read(input.projectId, request.requestId);
        if (!previous) throw Error('This operation is unavailable and will not be repeated.');
        return previous;
      }
      let parent: ScopedShotState | null = null;
      if (request.retry) {
        const retry = request.retry;
        if (retry.parentRequestId === request.requestId) throw new ScopedShotReviewRejection('A retry needs a fresh operation identity.');
        parent = this.read(input.projectId, retry.parentRequestId);
        if (!parent || parent.status === 'running' || parent.successorRequestId) throw new ScopedShotReviewRejection('This parent is still active, unavailable or already continued. Recover its latest saved operation before reviewing another retry.');
        if (parent.mode !== quote.mode || parent.model !== quote.model) throw new ScopedShotReviewRejection('Retry provider mode or model changed. Review a new planning scope instead.');
        if (operationDigest(parent.input) !== operationDigest(input) || operationDigest(scopedShotRetryParentContent(parent)) !== retry.parentStateDigest) throw new ScopedShotReviewRejection('The original input or saved parent state changed. Review the latest failed/unstarted jobs again.');
        for (const target of retry.jobs) {
          const job = parent.jobs.find((candidate) => candidate.sceneId === target.sceneId);
          if (!job || !scopedShotRetryEligible(job) || job.runId !== target.runId || job.sourceDigest !== target.sourceDigest) throw new ScopedShotReviewRejection('Only exact jobs proven not dispatched can be retried. Ready or uncertain jobs cannot be purchased again.');
        }
        const fence = `${this.key(input.projectId, parent.requestId)}:retry`;
        this.repository.claim(fence, operationDigest({ requestId: request.requestId, digest }));
        this.repository.complete(fence, { requestId: request.requestId, digest });
      }
      const selected = new Set(request.retry?.jobs.map((job) => job.sceneId) ?? input.scenes.map((scene) => scene.sceneId));
      const jobs = input.scenes.map((scene): ScopedShotJob => {
        const prior = parent?.jobs.find((job) => job.sceneId === scene.sceneId);
        if (!selected.has(scene.sceneId)) return structuredClone(prior!);
        return { sceneId: scene.sceneId, runId: crypto.randomUUID(), title: scene.title, sourceDigest: scene.sourceDigest,
          status: 'queued', dispatchState: 'not-dispatched', attemptRequestId: request.requestId,
          ...(prior ? { retryOfRunId: prior.runId } : {}), result: null, error: null };
      });
      const next: ScopedShotState = { version: 1, requestId: request.requestId, projectId: input.projectId, input, inputDigest: expected, quoteId: quote.quoteId,
        mode: quote.mode, model: quote.model, estimatedCost: total, actualCost: null, status: 'running', acceptedSceneIds: parent?.acceptedSceneIds ?? [], jobs,
        rootRequestId: parent?.rootRequestId ?? parent?.requestId ?? request.requestId,
        ...(parent && request.retry ? { parentRequestId: parent.requestId, parentStateDigest: request.retry.parentStateDigest, retrySceneIds: [...selected] } : {}) };
      ScopedShotStateSchema.parse(next);
      this.repository.claim(key, digest); this.repository.checkpoint(key, digest, next); fresh = true;
      return next;
    });
    if (!fresh) return state;
    const controller = new AbortController(); this.active.set(key, controller);
    void this.run(key, digest, state, controller).catch(() => { this.repository.unknown(key); }).finally(() => { this.active.delete(key); });
    return structuredClone(state);
  }
  private async run(key: string, digest: string, state: ScopedShotState, controller: AbortController) {
    // Let the initial response expose the persisted queue before dispatch.
    await Promise.resolve();
    for (const [index, job] of state.jobs.entries()) {
      // A retry carries all prior successes/unknowns; only this attempt's new queue can dispatch.
      if (job.status !== 'queued' || job.attemptRequestId !== state.requestId) continue;
      // Another process can persist Stop while this process owns the dispatch.
      // Consult the durable marker before EACH child, not only the local signal.
      const childKey = this.childKey(state.projectId, job.runId), scene = state.input.scenes[index];
      const childDigest = operationDigest({ scene, mode: state.mode, model: state.model });
      // This atomic fence is shared with retry creation. A queued parent job and
      // its replacement cannot both acquire permission to dispatch.
      const dispatchClaim = this.repository.transaction(() => {
        if (this.repository.read(`${key}:cancel`) || this.repository.read(`${key}:retry`)) controller.abort();
        if (controller.signal.aborted) { job.status = 'cancelled'; return { stopped: true, claimed: false }; }
        const claim = this.repository.claim(childKey, childDigest);
        job.status = 'running'; job.dispatchState = 'may-have-dispatched';
        this.repository.checkpoint(key, digest, state);
        return { stopped: false, claimed: claim.claimed };
      });
      if (dispatchClaim.stopped) continue;
      const { claimed } = dispatchClaim;
      try {
        if (!claimed) {
          const saved = this.savedChild(state, job);
          if (!saved) throw Error('Existing child outcome is unknown; it will not be repeated.');
          this.applyChild(job, saved);
        } else {
          const raw = await this.dispatch(scene, job.runId, controller.signal, state);
          const result = validateScopedPlan(raw);
          if (!scopedPlanMatchesInput(result, scene, state.mode, job.runId)) throw Error('Result scope, aspect or duration mismatch.');
          const saved: ChildCheckpoint = { version: 1, kind: 'ready', result };
          this.repository.complete(childKey, saved); this.applyChild(job, saved);
        }
      } catch (error) {
        if (claimed && error instanceof ScopedShotNoDispatchError) {
          const saved: ChildCheckpoint = { version: 1, kind: 'not-dispatched', error: 'Local preflight stopped this scene before provider work. Review current policy and estimate to retry it.' };
          this.repository.complete(childKey, saved); this.applyChild(job, saved);
        } else {
          if (claimed) this.repository.unknown(childKey);
          job.status = controller.signal.aborted ? 'cancelled' : 'outcome-unknown'; job.dispatchState = 'may-have-dispatched'; job.error = 'No validated result was saved. Check provider activity before approving another attempt.';
        }
      }
      this.repository.checkpoint(key, digest, state);
    }
    state.status = controller.signal.aborted ? 'cancelled' : 'review';
    this.repository.complete(key, state);
  }
  cancel(projectId: string, requestId: string) {
    const key = this.key(projectId, requestId);
    const state = this.read(projectId, requestId);
    if (!state) throw Error('No owned operation was found.');
    if (!['running', 'outcome-unknown'].includes(state.status)) return state;
    this.repository.transaction(() => {
      this.repository.claim(`${key}:cancel`, operationDigest({ projectId, requestId }));
      this.repository.complete(`${key}:cancel`, { cancelled: true });
    });
    this.active.get(key)?.abort();
    return this.read(projectId, requestId)!;
  }
}
let coordinator: Promise<ScopedShotCoordinator> | undefined;
export function localScopedShotCoordinator() {
  coordinator ??= OperationRepository.open(process.env.CINESERYE_OPERATION_DB_PATH?.trim() || '.wrangler/cineserye-operations.sqlite').then((repository) => new ScopedShotCoordinator(repository, async (scene, runId, signal, policy) => {
    let dependencies: ReturnType<typeof fixtureWorkflowDependencies>;
    try {
      const config = readCinemaProviderConfig(), quote = scopedShotQuote();
      if (signal.aborted || !quote.ready || quote.quoteId !== policy.quoteId || quote.mode !== policy.mode || quote.model !== policy.model) throw Error('Local dispatch policy changed.');
      dependencies = config.mode === 'fixture' ? fixtureWorkflowDependencies() : (await import('./live-workflow')).liveWorkflowDependencies(config);
    } catch { throw new ScopedShotNoDispatchError('Local preparation failed before entering the provider workflow.'); }
    return runCinemaPlanningWorkflow(scene.brief, dependencies, signal, runId, scene.planningContext);
  })).catch((error) => { coordinator = undefined; throw error; });
  return coordinator;
}
