'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { WorkflowCapabilities } from './workflow-capabilities';
import { useWorkspaceAdmission } from '../simplified-flow/useWorkspaceAdmission';
import { ArrowRight, Check, Clapperboard, LoaderCircle } from 'lucide-react';
import { ScopedShotStateSchema, ScopedShotResponseSchema, scopedShotApprovalContent, scopedShotRetryEligible, scopedShotRetryParentContent, type ScopedShotRetry, type ScopedShotInput, type ScopedShotQuote, type ScopedShotState } from '../../domain/cinema/scoped-shot-planning';
import { canonicalRequest, requestDigest } from '../../domain/cinema/request-digest';
import { storyReviewSession } from '../../domain/cinema/story-workflow';
import { changeStory, storySceneAllocation } from '../../editor/story-development-commands';
import { acceptScopedShotPlans, buildScopedShotInput, scopedSceneEligibility, scopedSceneIdentity } from '../../editor/scoped-shot-commands';
import type { EditorDocument } from '../../editor/types';
import { SequenceReview } from '../assembly/SequenceReview';
import { SceneAllocationCorrection } from './SceneAllocationCorrection';
import { continuityReuseSummary } from '../../domain/cinema/continuity-identity';
import { ensureClientOperation, observeClientOperation } from '../simplified-flow/operation-journal';

type Props = { document: EditorDocument; getDocument: () => EditorDocument; commit: (document: EditorDocument, history?: boolean) => void;
  flush: () => Promise<unknown>; providerMode: 'fixture' | 'live' | 'loading'; capabilities: WorkflowCapabilities | null; onOpenLayer: (nodeId: string) => void; onExpand?: () => void; reviewOnOpen?: boolean; onReviewSequence?: () => void };
export function AssistantShotPlanning({ document, getDocument, commit, flush, providerMode, capabilities, onOpenLayer, onExpand, reviewOnOpen, onReviewSequence }: Props) {
  const captureAdmission = useWorkspaceAdmission(capabilities);
  const cinema = document.cinema!;
  const saved = cinema.storyWorkflow?.shotPlanning;
  const defaultSceneIds = storyReviewSession(cinema.storyWorkflow)?.accepted.map((item) => item.sceneId) ?? [];
  const scopeKey = `${cinema.projectId}:${defaultSceneIds.join(',')}`;
  const [scope, setScope] = useState<{ key: string; ids: string[] } | null>(null);
  const sceneIds = scope?.key === scopeKey ? scope.ids : defaultSceneIds;
  const setSceneIds = (value: string[] | ((ids: string[]) => string[])) => setScope({ key: scopeKey, ids: typeof value === 'function' ? value(sceneIds) : value });
  const [changing, setChanging] = useState(false);
  const [estimate, setEstimate] = useState<{ value: ScopedShotQuote; workspace: WorkflowCapabilities } | null>(null);
  const quote = capabilities && estimate?.workspace === capabilities ? estimate.value : null;
  const [input, setInput] = useState<ScopedShotInput | null>(null);
  const [retry, setRetry] = useState<ScopedShotRetry | null>(null);
  const currentReview = useRef<object | null>(null);
  useLayoutEffect(() => {
    currentReview.current = {};
    return () => { currentReview.current = null; };
  }, [input, quote, retry]);
  const [retryIds, setRetryIds] = useState<string[] | null>(null);
  const [selectedResults, setSelectedResults] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const documentRef = useRef({ getDocument, commit });
  useEffect(() => { documentRef.current = { getDocument, commit }; }, [getDocument, commit]);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const save = (state: ScopedShotState) => {
    const current = getDocument();
    if (current.cinema?.projectId !== state.projectId || !current.nodes.some((node) => node.id === state.input.premiseNodeId)) throw Error('The source project is no longer open.');
    commit(changeStory(current, (workflow) => {
      const prior = workflow.shotPlanning;
      if (prior && prior.requestId !== state.requestId) {
        const history = (workflow.shotPlanningHistory ?? []).filter((item) => item.requestId !== state.requestId && item.requestId !== prior.requestId);
        if (history.length >= 20) throw Error('Planning history is full. Keep a project backup before starting more work.');
        workflow.shotPlanningHistory = [...history, prior];
      }
      workflow.shotPlanning = state;
    }), false);
  };
  const validateReviewedScenes = async (source: EditorDocument, reviewed: ScopedShotInput, ids: string[]) => {
    if (source.cinema?.projectId !== reviewed.projectId || !source.nodes.some((node) => node.id === reviewed.premiseNodeId)) throw Error('The reviewed project is no longer open.');
    for (const id of ids) {
      const scene = reviewed.scenes.find((item) => item.sceneId === id);
      if (!scene || scopedSceneEligibility(source, id) || await requestDigest(scopedSceneIdentity(source, id, scene.continuityIds)) !== scene.sourceDigest) throw Error('A reviewed scene or its context changed. Existing results are kept; review a new scope.');
    }
  };
  const readSaved = async (snapshot: ScopedShotState) => {
    const response = await fetch(`/api/cinema/plan-scenes?projectId=${encodeURIComponent(snapshot.projectId)}&requestId=${snapshot.requestId}`);
    const payload = ScopedShotResponseSchema.parse(await response.json());
    if (!response.ok || !payload.ok || !payload.state) throw Error(payload.error ?? 'No saved operation was found. Nothing was restarted.');
    const state = payload.state;
    if (state.projectId !== snapshot.projectId || state.requestId !== snapshot.requestId || state.inputDigest !== snapshot.inputDigest
      || canonicalRequest(state.input) !== canonicalRequest(snapshot.input)) throw Error('Saved operation identity mismatch.');
    state.acceptedSceneIds = snapshot.acceptedSceneIds;
    return state;
  };
  const shotJournalOwner = (state: Pick<ScopedShotState, 'projectId' | 'inputDigest'>) => ({
    projectId: state.projectId, kind: 'shot-plan' as const, scopeKey: state.inputDigest,
  });
  const observeShotJournal = (state: ScopedShotState) => {
    const completed = state.jobs.filter((job) => job.status === 'ready').length;
    const phase = state.status === 'running' ? 'running' : state.status === 'review' ? 'awaiting-review'
      : state.status === 'cancelled' ? 'tracking-stopped' : 'unknown';
    try { observeClientOperation(state.requestId, shotJournalOwner(state), { phase,
      dispatchCertainty: phase === 'awaiting-review' ? 'completed' : 'may-have-dispatched',
      lastError: state.jobs.find((job) => job.error)?.error ?? null, completedUnits: completed, totalUnits: state.jobs.length }); } catch { /* Legacy request. */ }
  };
  const recover = async () => {
    if (!saved || busy) return;
    setBusy(true); setError('');
    try {
      let state = await readSaved(saved);
      const visited = new Set([state.requestId]);
      while (state.successorRequestId) {
        if (visited.size >= 20 || visited.has(state.successorRequestId)) throw Error('Saved retry history is invalid or exceeds the recovery limit. Nothing was restarted.');
        const response = await fetch(`/api/cinema/plan-scenes?projectId=${encodeURIComponent(state.projectId)}&requestId=${state.successorRequestId}`);
        const payload = ScopedShotResponseSchema.parse(await response.json());
        if (!response.ok || !payload.ok || !payload.state || payload.state.parentRequestId !== state.requestId || payload.state.projectId !== state.projectId || payload.state.requestId !== state.successorRequestId
          || canonicalRequest(payload.state.input) !== canonicalRequest(state.input)) throw Error('The retry checkpoint is unavailable. Nothing was restarted.');
        const child = payload.state;
        child.acceptedSceneIds = state.acceptedSceneIds.filter((id) => child.jobs.some((job) => job.sceneId === id && job.status === 'ready'
          && job.runId === state.jobs.find((prior) => prior.sceneId === id)?.runId));
        visited.add(child.requestId);
        state = child;
      }
      if (getDocument().cinema?.storyWorkflow?.shotPlanning?.requestId !== saved.requestId) return;
      save(state); observeShotJournal(state); setRetryIds(null); setInput(null); setRetry(null); setSelectedResults(null);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  const prepareRetry = async () => {
    if (!saved || busy || providerMode === 'loading' || !capabilities) return;
    setBusy(true); setError(''); onExpand?.();
    try {
      const requireAdmission = captureAdmission(providerMode);
      const state = await readSaved(saved);
      if (state.status === 'running' || state.successorRequestId) throw Error('This request is still active or already has a retry. Check saved status first.');
      const ids = retryIds ?? state.jobs.filter(scopedShotRetryEligible).map((job) => job.sceneId);
      const jobs = state.jobs.filter((job) => ids.includes(job.sceneId));
      if (!jobs.length || jobs.length !== ids.length || jobs.some((job) => !scopedShotRetryEligible(job))) throw Error('Only confirmed unstarted or failed-before-dispatch scenes can be retried.');
      await validateReviewedScenes(getDocument(), state.input, jobs.map((job) => job.sceneId));
      const response = await fetch('/api/cinema/plan-scenes'); const payload = ScopedShotResponseSchema.parse(await response.json());
      if (!response.ok || !payload.ok || !payload.quote || payload.quote.mode !== providerMode || payload.quote.mode !== state.mode || payload.quote.model !== state.model) throw Error('The provider changed. Existing results are kept; review a separate new scope.');
      if (getDocument().cinema?.storyWorkflow?.shotPlanning?.requestId !== saved.requestId) return;
      const parentStateDigest = await requestDigest(scopedShotRetryParentContent(state));
      requireAdmission();
      save(state);
      setRetry({ parentRequestId: state.requestId, parentStateDigest, jobs: jobs.map(({ sceneId, runId, sourceDigest }) => ({ sceneId, runId, sourceDigest })) });
      setEstimate({ value: payload.quote, workspace: capabilities }); setInput(state.input); setChanging(false);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!saved || saved.status !== 'running') return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/cinema/plan-scenes?projectId=${encodeURIComponent(saved.projectId)}&requestId=${saved.requestId}`);
        const payload = ScopedShotResponseSchema.parse(await response.json());
        if (!response.ok || !payload.ok || !payload.state) throw Error(payload.error ?? 'Saved operation is unavailable. No work was restarted.');
        const state = ScopedShotStateSchema.parse(payload.state);
        if (state.projectId !== saved.projectId || state.requestId !== saved.requestId || state.inputDigest !== saved.inputDigest
          || canonicalRequest(state.input) !== canonicalRequest(saved.input)) throw Error('Saved operation identity mismatch. Nothing was applied or restarted.');
        if (stopped) return;
        const current = documentRef.current.getDocument();
        if (current.cinema?.projectId !== saved.projectId || current.cinema.storyWorkflow?.shotPlanning?.requestId !== saved.requestId
          || !current.nodes.some((node) => node.id === saved.input.premiseNodeId)) return;
        const prior = current.cinema.storyWorkflow.shotPlanning;
        if (prior.status === 'cancelled') return;
        // Source/references changed while running: stop queued work, never apply a late result.
        for (const scene of state.input.scenes) {
          if (prior.acceptedSceneIds.includes(scene.sceneId)) continue;
          if (!current.cinema.scenes[scene.sceneId] || await requestDigest(scopedSceneIdentity(current, scene.sceneId, scene.continuityIds)) !== scene.sourceDigest) {
            await fetch(`/api/cinema/plan-scenes?projectId=${encodeURIComponent(saved.projectId)}&requestId=${saved.requestId}`, { method: 'DELETE' });
            state.status = 'cancelled';
            state.jobs = state.jobs.map((job) => job.status === 'ready' ? job : { ...job, status: 'cancelled', error: 'Source changed; remaining work stopped.' });
            break;
          }
        }
        if (stopped) return;
        const latest = documentRef.current.getDocument();
        if (latest.cinema?.projectId !== saved.projectId || latest.cinema.storyWorkflow?.shotPlanning?.requestId !== saved.requestId) return;
        if (latest.cinema.storyWorkflow.shotPlanning.status === 'cancelled') return;
        state.acceptedSceneIds = latest.cinema.storyWorkflow.shotPlanning.acceptedSceneIds;
        if (canonicalRequest(state) !== canonicalRequest(latest.cinema.storyWorkflow.shotPlanning)) documentRef.current.commit(changeStory(latest, (workflow) => { workflow.shotPlanning = state; }), false);
        observeShotJournal(state);
        if (state.status === 'running') timer = setTimeout(poll, 1000);
      } catch (error) { if (!stopped) { setError((error as Error).message); timer = setTimeout(poll, 4000); } }
    };
    timer = setTimeout(poll, 600);
    return () => {
      stopped = true; clearTimeout(timer);
      const current = documentRef.current.getDocument();
      if (current.cinema?.projectId !== saved.projectId || current.cinema.storyWorkflow?.shotPlanning?.requestId !== saved.requestId) {
        void fetch(`/api/cinema/plan-scenes?projectId=${encodeURIComponent(saved.projectId)}&requestId=${saved.requestId}`, { method: 'DELETE' }).catch(() => undefined);
      }
    };
    // Poll operation identity, not changing checkpoints; typing/progress must not restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.requestId, saved?.status, saved?.projectId]);
  const prepare = async () => {
    if (busy || providerMode === 'loading' || !capabilities) return;
    onExpand?.();
    setBusy(true); setError('');
    try {
      const requireAdmission = captureAdmission(providerMode);
      const source = getDocument();
      const prepared = await buildScopedShotInput(source, sceneIds);
      const response = await fetch('/api/cinema/plan-scenes'); const payload = ScopedShotResponseSchema.parse(await response.json());
      if (!response.ok || !payload.ok || !payload.quote || payload.quote.mode !== providerMode) throw Error(payload.error ?? 'Provider mode changed. Refresh the feature status.');
      requireAdmission();
      setEstimate({ value: payload.quote, workspace: capabilities }); setInput(prepared); setRetry(null); setChanging(false);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  const reviewedOpen = useRef(false);
  useEffect(() => {
    if (!reviewOnOpen || reviewedOpen.current || saved || input || busy) return;
    reviewedOpen.current = true;
    void prepare();
    // Explicit scene acceptance may enter this read-only review. It cannot
    // dispatch shot planning and will not repeat on render or reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewOnOpen]);
  const start = async () => {
    if (!quote?.ready || !input || busy) return;
    setBusy(true); setError('');
    let operationId: string | null = null;
    let dispatched = false, journalRecorded = false;
    let original: ScopedShotState | undefined;
    let knownRejected = false;
    try {
      const requireAdmission = captureAdmission(quote.mode);
      const approvedReview = currentReview.current;
      const requireReview = () => {
        requireAdmission();
        if (!approvedReview || currentReview.current !== approvedReview) throw Error('The planning review changed. Review the request again.');
      };
      // Hashing yields to edits, cancellation and project replacement. Compare
      // synchronous source/operation snapshots around those awaits, and never
      // yield between the final comparison and POST. Canvas pan/selection and
      // save timestamps are intentionally outside the approval identity.
      const reviewedIds = retry?.jobs.map((job) => job.sceneId) ?? input.scenes.map((scene) => scene.sceneId);
      const sourceIdentity = (value: EditorDocument) => {
        if (value.cinema?.projectId !== input.projectId || !value.nodes.some((node) => node.id === input.premiseNodeId)) return null;
        return canonicalRequest({ operation: value.cinema.storyWorkflow?.shotPlanning ?? null,
          scenes: reviewedIds.map((id) => ({ eligible: scopedSceneEligibility(value, id),
            source: scopedSceneIdentity(value, id, retry ? input.scenes.find((scene) => scene.sceneId === id)?.continuityIds : undefined) })) });
      };
      const source = getDocument();
      const beforePreparation = sourceIdentity(source);
      original = source.cinema?.storyWorkflow?.shotPlanning;
      if (retry) {
        if (!original || original.requestId !== retry.parentRequestId || await requestDigest(scopedShotRetryParentContent(original)) !== retry.parentStateDigest) throw Error('The saved retry scope changed. Review it again.');
        await validateReviewedScenes(source, input, retry.jobs.map((job) => job.sceneId));
      } else {
        const fresh = await buildScopedShotInput(source, input.scenes.map((scene) => scene.sceneId));
        if (canonicalRequest(fresh) !== canonicalRequest(input)) throw Error('Scope or content changed. Review the current request again.');
      }
      if (quote.mode !== providerMode) throw Error('The provider changed. Review the request again.');
      const requestId = crypto.randomUUID(), contentDigest = await requestDigest(scopedShotApprovalContent(input, quote.quoteId, retry ?? undefined));
      operationId = requestId;
      const total = Math.round(quote.perSceneEstimate * (retry?.jobs.length ?? input.scenes.length) * 1e6) / 1e6;
      const placeholder: ScopedShotState = { version: 1, requestId, projectId: input.projectId, input, inputDigest: contentDigest, quoteId: quote.quoteId,
        mode: quote.mode, model: quote.model, estimatedCost: total, actualCost: null, status: 'running', acceptedSceneIds: [],
        jobs: input.scenes.map((scene) => ({ sceneId: scene.sceneId, sourceDigest: scene.sourceDigest, title: scene.title, runId: crypto.randomUUID(), status: 'queued', result: null, error: null })) };
      if (retry && original) {
        Object.assign(placeholder, { parentRequestId: original.requestId, rootRequestId: original.rootRequestId ?? original.requestId, parentStateDigest: retry.parentStateDigest,
          retrySceneIds: retry.jobs.map((job) => job.sceneId), acceptedSceneIds: original.acceptedSceneIds });
        placeholder.jobs = original.jobs.map((job) => retry.jobs.some((item) => item.sceneId === job.sceneId)
          ? { ...job, runId: crypto.randomUUID(), retryOfRunId: job.runId, attemptRequestId: requestId, status: 'queued', result: null, error: null, dispatchState: undefined }
          : job);
      }
      requireReview();
      if (sourceIdentity(getDocument()) !== beforePreparation) throw Error('The source or active request changed before dispatch. Review again.');
      save(placeholder); await flush();
      const current = getDocument();
      if (current.cinema?.projectId !== input.projectId || current.cinema.storyWorkflow?.shotPlanning?.requestId !== requestId || current.cinema.storyWorkflow.shotPlanning.status !== 'running') throw Error('The active request changed before dispatch.');
      const beforeFinalDigest = sourceIdentity(current);
      if (retry) await validateReviewedScenes(current, input, retry.jobs.map((job) => job.sceneId));
      else {
        const afterFlush = await buildScopedShotInput(current, input.scenes.map((scene) => scene.sceneId));
        if (canonicalRequest(afterFlush) !== canonicalRequest(input)) throw Error('Content changed before dispatch. Review again.');
      }
      requireReview();
      if (sourceIdentity(getDocument()) !== beforeFinalDigest) throw Error('The source or active request changed before dispatch. Review again.');
      ensureClientOperation({ id: requestId, ...shotJournalOwner(placeholder), sourceFingerprint: contentDigest,
        provider: quote.mode === 'fixture' ? 'cineserye-shot-plan-fixture' : 'configured-shot-planning-provider',
        model: quote.model, estimateUsd: total }, { phase: 'intent', dispatchCertainty: 'not-dispatched' });
      journalRecorded = true;
      observeClientOperation(requestId, shotJournalOwner(placeholder), { phase: 'dispatched', dispatchCertainty: 'may-have-dispatched',
        completedUnits: 0, totalUnits: placeholder.jobs.length });
      dispatched = true;
      const response = await fetch('/api/cinema/plan-scenes', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: 1, requestId, input, quoteId: quote.quoteId, contentDigest, consent: true, approvedEstimate: total, mode: quote.mode, ...(retry ? { retry } : {}) }) });
      const payload = ScopedShotResponseSchema.parse(await response.json());
      if (!response.ok || !payload.ok) { knownRejected = payload.dispatchCertainty === 'not-dispatched'; throw Error(payload.error ?? 'Planning could not start.'); }
      if (payload.state) observeShotJournal(payload.state);
      const latest = getDocument();
      const active = latest.cinema?.projectId === input.projectId && latest.cinema.storyWorkflow?.shotPlanning?.requestId === requestId;
      if (active && latest.cinema!.storyWorkflow!.shotPlanning!.status !== 'cancelled') {
        if (retry) await validateReviewedScenes(latest, input, retry.jobs.map((job) => job.sceneId));
        else {
          const currentInput = await buildScopedShotInput(latest, input.scenes.map((scene) => scene.sceneId));
          if (canonicalRequest(currentInput) !== canonicalRequest(input)) throw Error('Source changed after dispatch. Stop planning before reviewing this request.');
        }
        // Polling may already have delivered a newer checkpoint. Do not regress it to the POST snapshot.
      } else {
        await fetch(`/api/cinema/plan-scenes?projectId=${encodeURIComponent(input.projectId)}&requestId=${requestId}`, { method: 'DELETE' });
      }
      setInput(null); setRetry(null); setRetryIds(null); setSelectedResults(null);
    } catch (error) {
      setError((error as Error).message);
      const current = getDocument(), state = current.cinema?.storyWorkflow?.shotPlanning;
      if (current.cinema?.projectId === input.projectId && operationId && state?.requestId === operationId && state.status === 'running') {
        if (retry && original && (!dispatched || knownRejected)) {
          const parent = original;
          commit(changeStory(current, (workflow) => {
            workflow.shotPlanning = parent;
            workflow.shotPlanningHistory = workflow.shotPlanningHistory?.filter((item) => item.requestId !== parent.requestId && item.requestId !== operationId);
          }), false);
          return;
        }
        const uncertain = dispatched && !knownRejected;
        save({ ...state, status: uncertain ? 'outcome-unknown' : 'review', jobs: state.jobs.map((job) => job.status === 'ready' || (retry && !retry.jobs.some((item) => item.sceneId === job.sceneId)) ? job : { ...job, status: uncertain ? 'outcome-unknown' : 'failed', error: uncertain ? 'Dispatch outcome is unknown. No automatic retry.' : 'Request stopped before dispatch.' }) });
        if (uncertain) void fetch(`/api/cinema/plan-scenes?projectId=${encodeURIComponent(state.projectId)}&requestId=${operationId}`, { method: 'DELETE' }).catch(() => undefined);
        if (uncertain) { setInput(null); setRetry(null); }
      }
      if (journalRecorded && operationId) try { observeClientOperation(operationId, { projectId: input.projectId, kind: 'shot-plan', scopeKey: await requestDigest(scopedShotApprovalContent(input, quote.quoteId, retry ?? undefined)) }, {
        phase: dispatched && !knownRejected ? 'unknown' : 'failed', dispatchCertainty: dispatched && !knownRejected ? 'may-have-dispatched' : 'not-dispatched',
        lastError: error instanceof Error ? error.message : 'Planning could not start.', completedUnits: null, totalUnits: null,
      }); } catch { /* Preserve the saved document operation if local recovery is older. */ }
    }
    finally { if (mounted.current) setBusy(false); }
  };
  const cancel = async () => {
    if (!saved) return;
    setError('');
    try {
      const before = getDocument().cinema?.storyWorkflow?.shotPlanning;
      if (before?.requestId !== saved.requestId) return;
      // Close the local dispatch/result gate before waiting for the server.
      save({ ...before, status: 'cancelled', jobs: before.jobs.map((job) => job.status === 'queued' || job.status === 'running' ? { ...job, status: 'cancelled', error: 'Cancellation requested.' } : job) });
      const response = await fetch(`/api/cinema/plan-scenes?projectId=${encodeURIComponent(saved.projectId)}&requestId=${saved.requestId}`, { method: 'DELETE' });
      const payload = ScopedShotResponseSchema.parse(await response.json());
      if (!response.ok || !payload.ok) throw Error(payload.error ?? 'Cancellation could not be confirmed.');
      const current = getDocument(), latest = current.cinema?.storyWorkflow?.shotPlanning;
      if (current.cinema?.projectId !== saved.projectId || latest?.requestId !== saved.requestId) return;
      const state = ScopedShotStateSchema.parse(payload.state); state.status = 'cancelled'; state.acceptedSceneIds = latest.acceptedSceneIds; save(state);
      observeShotJournal(state);
    } catch (error) { setError((error as Error).message); }
  };
  const ready = saved?.jobs.filter((job) => job.status === 'ready' && !saved.acceptedSceneIds.includes(job.sceneId)) ?? [];
  const selected = selectedResults ?? ready.map((job) => job.sceneId);
  const accept = async () => {
    if (!saved || busy) return;
    setBusy(true); setError('');
    try {
      const source = getDocument(); const identity = canonicalRequest({ ...source, updatedAt: 0 });
      const next = await acceptScopedShotPlans(source, saved, selected.filter((id) => ready.some((job) => job.sceneId === id)));
      if (canonicalRequest({ ...getDocument(), updatedAt: 0 }) !== identity) throw Error('The canvas changed during acceptance; review again.');
      const acceptedRunIds = new Set(next.cinema!.storyWorkflow!.shotPlanning!.jobs.filter((job) => next.cinema!.storyWorkflow!.shotPlanning!.acceptedSceneIds.includes(job.sceneId)).map((job) => job.runId));
      commit(changeStory(next, (workflow) => {
        workflow.shotPlanningHistory = workflow.shotPlanningHistory?.map((previous) => ({ ...previous,
          acceptedSceneIds: [...new Set([...previous.acceptedSceneIds, ...previous.jobs.filter((job) => acceptedRunIds.has(job.runId)).map((job) => job.sceneId)])] }));
      }), true); await flush(); setSelectedResults(null);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  const accepted = saved?.acceptedSceneIds ?? [];
  const retryable = saved?.jobs.filter(scopedShotRetryEligible) ?? [];
  const selectedRetryIds = retryIds ?? retryable.map((job) => job.sceneId);
  const reviewedScenes = input?.scenes.filter((scene) => !retry || retry.jobs.some((job) => job.sceneId === scene.sceneId)) ?? [];
  const reviewedEstimate = (quote?.perSceneEstimate ?? 0) * reviewedScenes.length;
  const showSetup = !saved || changing;
  const allScopeEligible = sceneIds.length >= 1 && sceneIds.length <= 10 && sceneIds.every((id) => !scopedSceneEligibility(document, id));
  return <section aria-label="Assistant shot planning" className="assistant-stage assistant-shot-planning">
    <div className="assistant-stage-scroll">
      <h3>{input ? retry ? 'Review failed-scene retry' : 'Review shot planning' : showSetup ? 'Your scenes are ready' : saved.status === 'running' ? 'Planning your shots' : ready.length ? 'Your shot plans' : accepted.length ? 'Shots added to your canvas' : 'Planning needs attention'}</h3>
      {error && <p role="alert">{error}</p>}
      {cinema.storyWorkflow?.shotPlanningHistory?.length && saved?.status !== 'running' && !input ? <details><summary>Previous shot plans</summary><p>Reopening reads saved proposals; it never buys another attempt. Changed scenes require a new review.</p>
        {cinema.storyWorkflow.shotPlanningHistory.slice().reverse().map((previous) => <button key={previous.requestId} onClick={() => {
          try { save(previous); setChanging(false); setInput(null); setRetry(null); setRetryIds(null); setSelectedResults(null); setError(''); }
          catch (error) { setError((error as Error).message); }
        }}>{previous.jobs.map((job) => job.title).join(' · ')} · {previous.mode} · {previous.requestId.slice(0, 8)}</button>)}</details> : null}
      {showSetup && !input && <><p>Next, turn your scenes into shots. Nothing needs to be selected on the canvas.</p>
        <div className="assistant-selection-summary">{sceneIds.length} scenes selected <button onClick={() => setChanging(!changing)}>{changing ? 'Done' : 'Change'}</button></div>
        {changing && <div role="group" aria-label="Scenes to plan">{cinema.sceneOrder.map((id) => {
          const scene = cinema.scenes[id], reason = scopedSceneEligibility(document, id);
          return <label key={id} className="assistant-check"><input type="checkbox" checked={sceneIds.includes(id)} disabled={Boolean(reason)} onChange={(event) => setSceneIds((ids) => event.target.checked ? [...ids, id] : ids.filter((value) => value !== id))} /><span>{scene.title}{reason && <small>{reason}</small>}</span></label>;
        })}</div>}
        {!changing && <p>{sceneIds.map((id) => cinema.scenes[id]?.title ?? 'Unavailable scene').join(' · ') || 'Choose scenes to plan.'}</p>}
        {sceneIds.map((id) => { const reason = scopedSceneEligibility(document, id); return reason ? <p key={id} role="status">{cinema.scenes[id]?.title}: {reason} <button onClick={() => onOpenLayer(cinema.scenes[id]?.nodeId ?? id)}>Edit scene</button></p> : null; })}
        {(changing ? cinema.sceneOrder : sceneIds).some((id) => storySceneAllocation(document, id) === null) && <SceneAllocationCorrection document={document} getDocument={getDocument} commit={commit} flush={flush} sceneIds={(changing ? cinema.sceneOrder : sceneIds).filter((id) => storySceneAllocation(document, id) === null)} min={6} max={180} />}
      </>}
      {input && quote && <><p>{reviewedScenes.map((scene) => scene.title).join(' · ')} · {reviewedScenes.reduce((sum, scene) => sum + scene.brief.targetDurationSeconds, 0)}s allocated</p>
        {retry && <p>Only these {retry.jobs.length} confirmed unstarted scenes get one new attempt. Successful plans stay saved and are not sent again. Uncertain jobs are excluded.</p>}
        <p>{quote.mode === 'fixture' ? 'Fixture planning · no AI calls' : `Parallel research + ${quote.model}`}</p>
        <p>{quote.mode === 'fixture' ? 'Deterministic sample plans for interaction testing.' : `Estimated USD ${reviewedEstimate.toFixed(3)} for this ${retry ? 'additional attempt' : 'request'}. One research/planning workflow per scene, no automatic retry. Actual provider charges may differ; usage is unknown until reported.`}</p>
        <details><summary>Content, references and impacts</summary><p>Scene text goes to research and planning. Shared story direction, scene context and approved text references go only to the planner. No image pixels or media generation are included. Existing plans are replaced only after you review and accept; prior revisions remain saved.</p>
          <p>Image references remain available for separately approved image generation; this shot planner receives no image pixels.</p></details>
        {quote.blockers.map((message) => <p role="alert" key={message}>{message}</p>)}
        {quote.mode === 'live' && reviewedEstimate > quote.ceiling && <p role="alert">This aggregate estimate exceeds the operator ceiling. Select fewer scenes.</p>}
        <button onClick={() => { setInput(null); setChanging(!retry); setRetry(null); }}>Change scope</button>
      </>}
      {!showSetup && !input && saved && <>
        <p className="assistant-help">{saved.mode === 'fixture' ? 'Fixture result — no AI calls' : `${saved.model} · estimated USD ${saved.estimatedCost.toFixed(3)} · actual usage not reported`}</p>
        {saved.jobs.map((job) => <article className="assistant-plan-row" key={job.sceneId} data-status={accepted.includes(job.sceneId) ? 'added' : job.status}>
          <div className="assistant-plan-row-heading">{accepted.includes(job.sceneId) ? <Check size={16} /> : job.status === 'running' ? <LoaderCircle size={16} /> : <Clapperboard size={16} />}<strong>{job.title}</strong><small>{accepted.includes(job.sceneId) ? 'Added' : job.status.replaceAll('-', ' ')}</small></div>
          {job.error && <p className="assistant-plan-error">{job.error}</p>}
          {job.result && !accepted.includes(job.sceneId) && <><label className="assistant-check"><input type="checkbox" checked={selected.includes(job.sceneId)} onChange={(event) => setSelectedResults(event.target.checked ? [...selected, job.sceneId] : selected.filter((id) => id !== job.sceneId))} />Include this plan · {Object.keys(job.result.cinema.shots).length} shots</label>
            {(() => { const identities = continuityReuseSummary(job.result.cinema); return <p className="assistant-identity-summary">{identities.reused.length} existing identities reused · {identities.newEntities.length} separate new identities. New identities are not automatically matched across scenes.</p>; })()}
            <details><summary>Review shots and changes</summary><ol>{Object.values(job.result.cinema.shots).map((shot) => <li key={shot.id}>{shot.title} · {shot.durationSeconds}s</li>)}</ol><p>{job.result.warnings.join(' ')}</p><p>Accept replaces this scene’s current plan. No images or video will be generated.</p></details></>}
          {accepted.includes(job.sceneId) && <button onClick={() => { const shot = cinema.shots[cinema.scenes[job.sceneId]?.shotIds[0]]; if (shot) onOpenLayer(shot.nodeId); }}>Open shots & media <ArrowRight size={14} /></button>}
        </article>)}
        {saved.status === 'cancelled' && <p>Queued work stopped. Already-sent requests may still incur charges. No results are applied automatically.</p>}
        {saved.status === 'outcome-unknown' && <p>Recovered without dispatching new work. Check provider activity for unknown jobs before starting another request.</p>}
        {saved.status !== 'running' && <button disabled={busy} onClick={() => void recover()}>Check saved status</button>}
        {saved.status !== 'running' && !saved.successorRequestId && retryable.length > 0 && <section aria-label="Retry unstarted scenes"><h4>Retry only unstarted scenes</h4>
          <p>These calls were confirmed not sent. Unknown or completed calls cannot be retried here.</p>
          {retryable.map((job) => <label className="assistant-check" key={job.sceneId}><input type="checkbox" checked={selectedRetryIds.includes(job.sceneId)} onChange={(event) => setRetryIds(event.target.checked ? [...selectedRetryIds, job.sceneId] : selectedRetryIds.filter((id) => id !== job.sceneId))} />{job.title}</label>)}
          <button disabled={busy || !selectedRetryIds.length} onClick={() => void prepareRetry()}>Review retry for {selectedRetryIds.length} scenes</button></section>}
        {accepted.length > 0 && (onReviewSequence ? <button type="button" onClick={onReviewSequence}>Review sequence in Edit</button> : <details><summary>Review sequence & export</summary><SequenceReview cinema={cinema} capabilities={capabilities} onNotice={setError} /></details>)}
      </>}
    </div>
    <footer className="assistant-stage-footer">
      {input && quote ? <button className="primary-button" disabled={busy || !quote.ready || quote.mode !== providerMode || (quote.mode === 'live' && reviewedEstimate > quote.ceiling)} onClick={() => void start()}>{busy ? 'Starting…' : retry ? `Approve retry for ${reviewedScenes.length} scenes` : quote.mode === 'live' ? `Approve & plan ${reviewedScenes.length} scenes` : `Create ${reviewedScenes.length} fixture plans`}</button>
        : showSetup ? <button className="primary-button" disabled={busy || !allScopeEligible || providerMode === 'loading'} onClick={() => void prepare()}>{busy ? 'Preparing…' : 'Plan shots'} <ArrowRight size={16} /></button>
          : saved?.status === 'running' ? <><span role="status">{saved.jobs.filter((job) => job.status === 'ready').length} / {saved.jobs.length} plans ready</span><button onClick={() => void cancel()}>Stop planning</button></>
            : ready.length ? <><span>{selected.filter((id) => ready.some((job) => job.sceneId === id)).length} plans selected</span><button className="primary-button" disabled={busy || !selected.some((id) => ready.some((job) => job.sceneId === id))} onClick={() => void accept()}>Add selected shot plans</button></>
              : <button onClick={() => { setChanging(true); setSceneIds([]); }}>Plan another scene</button>}
    </footer>
  </section>;
}
