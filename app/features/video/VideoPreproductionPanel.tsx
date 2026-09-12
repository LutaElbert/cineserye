'use client';

import { Check, Download, Film, LoaderCircle, RotateCcw, Square, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useScopedConfirmation } from '../../components/useScopedConfirmation';
import { requestDigest } from '../../domain/cinema/request-digest';
import { ownedVideoOperationUrl, videoApprovalContent } from './video-api';
import type { CinemaProjectData, CinemaShotRecord } from '../../domain/cinema/project-data';
import {
  approveVideoClip,
  rejectVideoClip,
  type CinemaVideoOperationRecord,
  type CinemaVideoSettings,
  type CinemaVisualPreproductionData,
} from '../../domain/cinema/visual-preproduction';
import { loadLocalMediaBlob } from '../../editor/persistence';
import type {
  GenerateVideoRequest,
  VideoOperationResponse,
  VideoPreflightResponse,
} from './video-api';
import { applyOwnedVideoSnapshot, terminalVideoStatuses as TERMINAL } from './apply-video-snapshot';
import { observedVideoStatuses, unresolvedVideoOperation, retryableVideoOperation } from './video-operation-state';
import { parseVideoOperation, parseVideoPreflight, VideoStatusUnavailable } from './video-response';
import { useResultOwner } from '../simplified-flow/useResultOwner';
import { subscribeToOperation } from '../simplified-flow/operation-subscriber';
import type { WorkflowCapabilities } from '../story-development/workflow-capabilities';
import { WorkspaceFeatureStatus, workspaceFeature } from '../simplified-flow/WorkspaceFeatureStatus';
import { useWorkspaceAdmission } from '../simplified-flow/useWorkspaceAdmission';
import { recoverRetainedVideoClip } from './recover-video-clip';
import { observeClientOperation, recordClientOperationIntent, type ClientOperationPhase } from '../simplified-flow/operation-journal';

type VisualUpdater = (current: CinemaVisualPreproductionData) => CinemaVisualPreproductionData;

/** Choose sufficient footage when possible without changing the narrative cut. */
export function recommendedClipDuration(plannedSeconds: number): 4 | 6 | 8 {
  return plannedSeconds <= 4 ? 4 : plannedSeconds <= 6 ? 6 : 8;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the approved frame.'));
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Canvas selection/global active scene never decides a shot's provenance. */
export function videoGenerationInputs(cinema: CinemaProjectData, shot: CinemaShotRecord) {
  const revision = Object.values(cinema.revisions).find((entry) => entry.sceneId === shot.sceneId && entry.status === 'active'
    && Boolean(entry.snapshot.shots[shot.id])) ?? null;
  const prompts = Object.values(cinema.prompts).filter((entry) => entry.ownerNodeId === shot.nodeId && entry.runId === revision?.runId)
    .sort((left, right) => right.version - left.version);
  const prompt = prompts.find((entry) => entry.purpose === 'video' && entry.status !== 'stale') ?? null;
  const imagePrompt = prompts.find((entry) => entry.purpose === 'storyboard' && entry.status !== 'stale') ?? null;
  const approvedFrame = Object.values(cinema.visualPreproduction?.storyboardFrames ?? {}).filter((frame) => frame.shotId === shot.id
    && frame.revisionId === revision?.id && frame.status === 'approved' && frame.safetyStatus === 'passed'
    && frame.promptId === imagePrompt?.id && frame.promptVersion === imagePrompt.version && frame.promptText === imagePrompt.generatedText)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
  return { revision, prompt, approvedFrame };
}

export function VideoPreproductionPanel({
  cinema,
  shot,
  capabilities,
  onUpdate,
  onNotice,
}: {
  cinema: CinemaProjectData;
  shot: CinemaShotRecord;
  capabilities: WorkflowCapabilities | null;
  onUpdate: (updater: VisualUpdater) => void;
  onNotice: (message: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const { mode: providerMode, canReview } = workspaceFeature(capabilities, 'video');
  const admitWorkspace = useWorkspaceAdmission(capabilities);
  const captureOwner = useResultOwner(JSON.stringify([cinema.projectId, shot.sceneId, shot.id]), onUpdate);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const visual = cinema.visualPreproduction;
  const { revision, prompt, approvedFrame } = videoGenerationInputs(cinema, shot);
  const operations = useMemo(() => Object.values(visual?.videoOperations ?? {})
    .filter((operation) => operation.shotId === shot.id)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt)), [shot.id, visual?.videoOperations]);
  const clips = useMemo(() => Object.values(visual?.videoClips ?? {})
    .filter((clip) => clip.shotId === shot.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt)), [shot.id, visual?.videoClips]);
  const resumableOperation = operations.find((operation) => observedVideoStatuses.has(operation.status)) ?? null;
  const unknownOperation = operations.find((operation) => unresolvedVideoOperation(operation) && !observedVideoStatuses.has(operation.status)) ?? null;
  const [preflightResult, setPreflight] = useState<{ workspace: WorkflowCapabilities; value: Extract<VideoPreflightResponse, { ok: true }> } | null>(null);
  const preflight = preflightResult?.workspace === capabilities ? preflightResult?.value ?? null : null;
  const [preflightFailure, setPreflightFailure] = useState<{ workspace: WorkflowCapabilities; message: string } | null>(null);
  const preflightError = preflightFailure?.workspace === capabilities ? preflightFailure?.message : null;
  const sceneAspect = cinema.scenes[shot.sceneId]?.brief?.aspectRatio;
  const [settings, setSettings] = useState<CinemaVideoSettings>({
    aspectRatio: sceneAspect === '16:9' ? '16:9' : '9:16',
    durationSeconds: recommendedClipDuration(shot.durationSeconds),
    resolution: '720p',
    audio: false,
    outputCount: 1,
    seed: null,
  });
  const approvalScope = JSON.stringify({ projectId: cinema.projectId, sceneId: shot.sceneId, shot, prompt, approvedFrame, settings, preflight, providerMode, revision: revision?.id });
  const currentApproval = useRef(approvalScope);
  currentApproval.current = approvalScope;
  const [confirmed, setConfirmed] = useScopedConfirmation(approvalScope, capabilities);
  const [activeOperationId, setActiveOperationId] = useState<string | null>(resumableOperation?.id ?? null);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const [clipUrls, setClipUrls] = useState<Record<string, string>>({});
  const [decoded, setDecoded] = useState<Record<string, { hash: string; seconds: number; width: number; height: number }>>({});
  const [mediaRevision, refreshMedia] = useState(0);
  const [recoveryMessages, setRecoveryMessages] = useState<Record<string, string>>({});
  const [recoveringClip, setRecoveringClip] = useState<string | null>(null);
  const recoveryRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    setRecoveringClip(null); setRecoveryMessages({});
    return () => { recoveryRequest.current?.abort(); recoveryRequest.current = null; };
  }, [cinema.projectId, shot.id, onUpdate]);

  useEffect(() => {
    let active = true;
    setPreflight(null);
    setPreflightFailure(null);
    if (!canReview || !capabilities) return;
    void fetch('/api/cinema/generate-video').then(async response => parseVideoPreflight(await response.json())).then((result) => {
      if (!active) return;
      if (result.ok && result.mode === providerMode) setPreflight({ workspace: capabilities, value: result });
      else {
        const message = 'Video provider mode changed. Refresh workspace status before confirming.';
        setPreflightFailure({ workspace: capabilities, message }); onNotice(message, 'error');
      }
    }).catch(() => { if (active) {
      const message = 'Video request preflight is unavailable. Refresh workspace status to retry.';
      setPreflightFailure({ workspace: capabilities, message }); onNotice(message, 'error');
    } });
    return () => { active = false; };
  }, [onNotice, providerMode, capabilities, canReview]);

  useEffect(() => {
    if (!activeOperationId && resumableOperation && !startingRef.current) setActiveOperationId(resumableOperation.id);
  }, [activeOperationId, resumableOperation]);

  useEffect(() => {
    let disposed = false;
    const urls: string[] = [];
    void Promise.all(clips.map(async (clip) => {
      const media = await loadLocalMediaBlob(clip.blobHash);
      if (!media || disposed) return null;
      const url = URL.createObjectURL(media.blob);
      urls.push(url);
      return [clip.id, url] as const;
    })).then((entries) => {
      if (!disposed) setClipUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)));
    });
    return () => {
      disposed = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [clips, mediaRevision]);

  const latestVisual = useRef(visual);
  latestVisual.current = visual;
  const videoJournalOwner = useCallback((operation: CinemaVideoOperationRecord) => ({
    projectId: cinema.projectId,
    kind: 'video-generation' as const,
    scopeKey: `${shot.sceneId}:${operation.shotId}:${operation.revisionId}`,
  }), [cinema.projectId, shot.sceneId]);
  const observeVideoJournal = useCallback((operation: CinemaVideoOperationRecord, phase: ClientOperationPhase,
    dispatchCertainty: 'not-dispatched' | 'may-have-dispatched' | 'completed', lastError: string | null = operation.error) => {
    try { observeClientOperation(operation.id, videoJournalOwner(operation), { phase, dispatchCertainty, lastError }); } catch { /* Old projects can predate the client journal. */ }
  }, [videoJournalOwner]);
  async function recoverClip(clipId: string) {
    if (recoveryRequest.current) return;
    const clip = latestVisual.current?.videoClips[clipId], operation = clip && latestVisual.current?.videoOperations[clip.operationId];
    if (!clip || !operation) return;
    const sceneId = cinema.revisions[operation.revisionId]?.sceneId;
    if (!sceneId) return;
    const owner = captureOwner(), snapshot = JSON.stringify({ clip, operation });
    const ownsResult = () => owner() && JSON.stringify({ clip: latestVisual.current?.videoClips[clipId], operation: latestVisual.current?.videoOperations[operation.id] }) === snapshot;
    const controller = new AbortController(); recoveryRequest.current = controller; setRecoveringClip(clipId);
    setRecoveryMessages(current => ({ ...current, [clipId]: 'Checking this existing request. No new generation is started.' }));
    try {
      const response = await fetch(ownedVideoOperationUrl({ projectId: cinema.projectId, sceneId, shotId: clip.shotId, revisionId: clip.revisionId, operationId: clip.operationId }, true), { signal: controller.signal });
      const result = parseVideoOperation(await response.json(), clip.operationId);
      if (await recoverRetainedVideoClip({ result, clip, operation, ownsResult })) {
        refreshMedia(value => value + 1);
        setRecoveryMessages(current => ({ ...current, [clipId]: 'Identical video bytes recovered. Your review status is unchanged.' }));
      }
    } catch (error) {
      if (ownsResult()) setRecoveryMessages(current => ({ ...current, [clipId]: error instanceof VideoStatusUnavailable
        ? 'No retained result is available here. Use the original browser or a separate video download; this backup cannot restore these bytes.'
        : error instanceof Error ? error.message : 'The existing clip could not be recovered. No new generation was started.' }));
    } finally {
      if (recoveryRequest.current === controller) { recoveryRequest.current = null; if (owner()) setRecoveringClip(null); }
    }
  }
  const applyOperationSnapshot = useCallback(async (
    result: Extract<VideoOperationResponse, { ok: true }>, ownsResult: () => boolean,
  ) => {
    const terminal = await applyOwnedVideoSnapshot({ result, ownsResult, current: () => latestVisual.current, update: onUpdate });
    if (!ownsResult()) return false;
    const record = latestVisual.current?.videoOperations[result.operation.operationId];
    if (record) observeVideoJournal(record,
      result.operation.status === 'ready' ? 'awaiting-review'
        : result.operation.status === 'failed' ? 'failed'
          : result.operation.status === 'cancelled' ? 'tracking-stopped'
            : result.operation.status === 'expired' ? 'expired'
              : result.operation.status === 'unknown' || result.operation.status === 'timed-out' ? 'unknown' : 'running',
      result.operation.status === 'ready' || result.operation.status === 'failed' ? 'completed' : 'may-have-dispatched', result.operation.error);
    if (terminal) {
      setActiveOperationId(null);
      onNotice(result.operation.status === 'ready' ? 'Video clip is ready for review. It has not been approved.'
        : result.operation.error ?? `Video operation ${result.operation.status}.`, result.operation.status === 'ready' ? 'success' : 'info');
    }
    return terminal;
  }, [onUpdate, onNotice, observeVideoJournal]);
  const observation = useRef({ applyOperationSnapshot, onUpdate });
  observation.current = { applyOperationSnapshot, onUpdate };
  const stopSubscription = useRef<(() => void) | null>(null);
  const [trackingRevision, setTrackingRevision] = useState(0);
  const reconciliationRequest = useRef<string | null>(null);
  const trackingScope = activeOperationId && visual?.videoOperations[activeOperationId]
    ? JSON.stringify({ projectId: cinema.projectId, sceneId: cinema.revisions[visual.videoOperations[activeOperationId].revisionId]?.sceneId ?? shot.sceneId, shotId: shot.id,
      revisionId: visual.videoOperations[activeOperationId].revisionId, operationId: activeOperationId }) : null;
  useEffect(() => {
    if (!trackingScope) return;
    const scope = JSON.parse(trackingScope) as Parameters<typeof ownedVideoOperationUrl>[0];
    const ownsResult = captureOwner();
    const stop = subscribeToOperation({
      read: async signal => {
        const reconcile = reconciliationRequest.current === scope.operationId;
        reconciliationRequest.current = null; // One explicit read, not every automatic poll.
        const response = await fetch(ownedVideoOperationUrl(scope, reconcile), { signal });
        return parseVideoOperation(await response.json(), scope.operationId);
      },
      apply: (result, isCurrent) => observation.current.applyOperationSnapshot(result, () => isCurrent() && ownsResult()),
      onError: error => {
        if (!ownsResult()) return;
        if (error instanceof VideoStatusUnavailable) {
          stopSubscription.current?.(); setActiveOperationId(null);
          observation.current.onUpdate(state => {
            const record = state.videoOperations[scope.operationId];
            if (!record || record.status === 'ready') return state;
            observeVideoJournal(record, error.reason === 'expired' ? 'expired' : 'unknown', 'may-have-dispatched', error.message);
            return { ...state, videoOperations: { ...state.videoOperations, [record.id]: { ...record,
              status: error.reason === 'expired' ? 'expired' : 'unknown', error: error.message, completedAt: null, failureConfirmed: false } } };
          });
          return;
        }
        observation.current.onUpdate(state => {
          const record = state.videoOperations[scope.operationId];
          if (!record || TERMINAL.has(record.status)) return state;
          const message = error instanceof Error ? error.message : 'Video status could not be refreshed.';
          if (record.error === message) return state;
          observeVideoJournal(record, 'unknown', 'may-have-dispatched', message);
          return { ...state, videoOperations: { ...state.videoOperations, [record.id]: { ...record, error: message } } };
        });
      },
    });
    stopSubscription.current = stop;
    return stop;
  }, [trackingScope, captureOwner, trackingRevision, onUpdate, observeVideoJournal]);

  const estimate = preflight?.usdPerSecond === null || preflight?.usdPerSecond === undefined
    ? null
    : Math.round(preflight.usdPerSecond * settings.durationSeconds * 100) / 100;
  const footageShortfall = settings.durationSeconds < shot.durationSeconds;
  const preflightReady = canReview && preflight?.mode === providerMode && preflight.ready
    && preflight.capability.durations.includes(settings.durationSeconds) && preflight.capability.resolutions.includes(settings.resolution)
    && preflight.capability.aspectRatios.includes(settings.aspectRatio)
    && (estimate === null || preflight.maximumEstimatedUsd === null || estimate <= preflight.maximumEstimatedUsd);

  const changeSettings = (patch: Partial<CinemaVideoSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    setConfirmed(false);
  };

  const startGeneration = async (retryOf: string | null = null) => {
    if (!confirmed || !approvedFrame || !prompt || !revision || !preflight || !preflightReady || startingRef.current || activeOperationId || unknownOperation) return;
    const capturedApproval = approvalScope;
    const ownsResult = captureOwner();
    startingRef.current = true;
    setStarting(true);
    setConfirmed(false);
    const operationId = `video-${crypto.randomUUID()}`;
    let dispatched = false, journalRecorded = false;
    try {
      const assertWorkspace = admitWorkspace(providerMode);
      const media = await loadLocalMediaBlob(approvedFrame.blobHash);
      if (!media) throw new Error('The approved storyboard frame is missing from local storage.');
      const frameBase64 = await blobToBase64(media.blob);
      if (capturedApproval !== currentApproval.current) throw new Error('Shot or generation settings changed. Review and confirm again.');
      const request: GenerateVideoRequest = {
        version: 1,
        idempotencyKey: operationId,
        shotId: shot.id,
        projectId: cinema.projectId,
        sceneId: shot.sceneId,
        revisionId: revision.id,
        acceptedPlan: true,
        prompt: {
          id: prompt.id,
          version: prompt.version,
          text: prompt.generatedText,
          purpose: 'video',
          negativeConstraints: [...prompt.negativeConstraints],
          status: prompt.status,
        },
        startFrame: {
          id: approvedFrame.id,
          status: 'approved',
          mimeType: approvedFrame.mimeType,
          base64: frameBase64,
          byteSize: media.byteSize,
        },
        endFrame: null,
        referenceIds: [],
        settings,
        explicitConfirmation: true,
        liveProviderConsent: providerMode === 'live',
      };
      request.approval = { quoteId: preflight.quoteId, contentDigest: await requestDigest(videoApprovalContent(request, preflight.quoteId)) };
      if (capturedApproval !== currentApproval.current) throw new Error('Shot or generation settings changed during approval. Review and confirm again.');
      const now = new Date().toISOString();
      const record: CinemaVideoOperationRecord = {
        id: operationId,
        shotId: shot.id,
        revisionId: revision.id,
        promptId: prompt.id,
        promptVersion: prompt.version,
        promptText: prompt.generatedText,
        negativeConstraints: [...prompt.negativeConstraints],
        startFrameId: approvedFrame.id,
        startFrameApproval: 'approved',
        endFrameId: null,
        endFrameApproval: null,
        referenceIds: [],
        provider: preflight.capability.provider,
        model: preflight.capability.model,
        capabilityProfileVersion: preflight.capability.version,
        settings: { ...settings },
        estimatedCost: estimate,
        currency: estimate === null ? null : 'USD',
        providerOperationId: null,
        status: 'queued',
        retryOf,
        consentedAt: now,
        startedAt: now,
        completedAt: null,
        error: null,
      };
      assertWorkspace();
      if (!ownsResult()) throw Error('The target project changed before dispatch. Review again.');
      recordClientOperationIntent({ id: operationId, projectId: cinema.projectId, kind: 'video-generation',
        scopeKey: `${shot.sceneId}:${shot.id}:${revision.id}`, sourceFingerprint: request.approval.contentDigest,
        provider: preflight.capability.provider, model: preflight.capability.model, estimateUsd: estimate });
      journalRecorded = true;
      onUpdate((state) => ({ ...state, videoOperations: { ...state.videoOperations, [operationId]: record } }));
      assertWorkspace();
      observeClientOperation(operationId, videoJournalOwner(record), { phase: 'dispatched', dispatchCertainty: 'may-have-dispatched' });
      dispatched = true;
      const response = await fetch('/api/cinema/generate-video', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      const result = parseVideoOperation(await response.json(), operationId);
      if (!mounted.current || !ownsResult()) return;
      setConfirmed(false);
      const terminal = await applyOperationSnapshot(result, ownsResult);
      if (ownsResult() && !terminal) setActiveOperationId(operationId);
    } catch (error) {
      if (!mounted.current || !ownsResult()) return;
      if (journalRecorded) observeVideoJournal({ ...(latestVisual.current?.videoOperations[operationId] ?? {
        id: operationId, shotId: shot.id, revisionId: revision?.id ?? 'unknown', error: null,
      } as CinemaVideoOperationRecord) }, dispatched ? 'unknown' : 'failed', dispatched ? 'may-have-dispatched' : 'not-dispatched',
      dispatched ? `Outcome unknown. ${error instanceof Error ? error.message : 'No response was received.'}` : error instanceof Error ? error.message : 'The request was not started.');
      onUpdate((state) => {
        const record = state.videoOperations[operationId];
        if (!record) return state;
        return {
          ...state,
          videoOperations: {
            ...state.videoOperations,
            [operationId]: { ...record, status: dispatched ? 'queued' : 'failed', failureConfirmed: !dispatched, completedAt: dispatched ? null : new Date().toISOString(),
              error: dispatched ? 'Outcome unknown. Check the existing request; provider processing and billing may continue.' : error instanceof Error ? error.message : 'Video generation failed.' },
          },
        };
      });
      if (dispatched) setActiveOperationId(operationId);
      onNotice(error instanceof Error ? error.message : 'Video generation failed.', 'error');
    } finally {
      startingRef.current = false;
      if (mounted.current && ownsResult()) setStarting(false);
    }
  };

  const cancel = async () => {
    if (!activeOperationId) return;
    const ownedOperation = visual?.videoOperations[activeOperationId];
    if (!ownedOperation) return onNotice('The video operation scope is unavailable.', 'error');
    const ownsResult = captureOwner();
    stopSubscription.current?.();
    try {
      const response = await fetch(ownedVideoOperationUrl({ projectId: cinema.projectId, sceneId: cinema.revisions[ownedOperation.revisionId]?.sceneId ?? shot.sceneId, shotId: shot.id, revisionId: ownedOperation.revisionId, operationId: activeOperationId }), { method: 'DELETE' });
      const result = parseVideoOperation(await response.json(), activeOperationId);
      if (!ownsResult()) return;
      await applyOperationSnapshot(result, ownsResult);
      if (ownsResult()) { observeVideoJournal(ownedOperation, 'tracking-stopped', 'may-have-dispatched', result.operation.cancellationNote ?? 'Local tracking stopped. Provider work may continue.');
        onNotice(result.operation.cancellationNote ?? 'Local tracking stopped. Provider work may continue.', 'info'); }
    } catch {
      if (ownsResult()) { onNotice('Could not confirm tracking stopped. Checking the existing request; provider work may continue.', 'error'); setTrackingRevision(value => value + 1); }
    }
  };

  const downloadClip = async (clipId: string) => {
    const clip = visual?.videoClips[clipId];
    if (!clip) return;
    const media = await loadLocalMediaBlob(clip.blobHash);
    if (!media) return onNotice('This clip is no longer available in local storage.', 'error');
    downloadBlob(media.blob, `${shot.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${clip.id}.mp4`);
  };

  const downloadMetadata = (clipId: string) => {
    const clip = visual?.videoClips[clipId];
    const operation = clip ? visual?.videoOperations[clip.operationId] : null;
    if (!clip || !operation) return;
    downloadBlob(new Blob([JSON.stringify({ format: 'cineserye-video-metadata', version: 1, clip, operation }, null, 2)], { type: 'application/json' }), `${clip.id}.json`);
  };

  const activeRecord = activeOperationId ? visual?.videoOperations[activeOperationId] : null;
  const usableClip = (clip: CinemaVisualPreproductionData['videoClips'][string]) => {
    const value = decoded[clip.id];
    return Boolean(clipUrls[clip.id] && value?.hash === clip.blobHash && value.width === clip.width && value.height === clip.height
      && Math.abs(value.seconds - clip.durationSeconds) <= 1 / 24);
  };
  const lastRetryable = operations.find(retryableVideoOperation) ?? null;

  return <section className="video-workbench" aria-labelledby="video-workbench-title">
    <header>
      <div><span>Motion workbench</span><strong id="video-workbench-title">Animate approved frame</strong></div>
      <small>{clips.length} {clips.length === 1 ? 'version' : 'versions'}</small>
    </header>
    <WorkspaceFeatureStatus capabilities={capabilities} feature="video" />
    {activeRecord ? <div className="video-operation-status" role="status" aria-live="polite"><LoaderCircle className="spin" size={15} /><div><strong>{activeRecord.error ? 'Outcome unknown — checking existing request' : activeRecord.status.replace('-', ' ')}</strong><span>{activeRecord.error ?? 'Checking the same owned request. Stopping local tracking does not cancel provider processing or billing.'}</span></div><button type="button" className="secondary-button" onClick={() => void cancel()}><Square size={12} /> {activeRecord.provider === 'cineserye-video-fixture' ? 'Cancel' : 'Stop tracking'}</button></div> : null}
    {unknownOperation && !activeOperationId ? <div className="video-operation-status" role="status"><div><strong>Outcome unknown</strong><span>{unknownOperation.error ?? 'The provider may still be working. A new request is blocked until this request is reconciled.'}</span><small>Request: {unknownOperation.id}</small></div><button type="button" className="secondary-button" onClick={() => { reconciliationRequest.current = unknownOperation.id; setActiveOperationId(unknownOperation.id); setTrackingRevision(value => value + 1); }}>Check existing request</button></div> : null}
    {operations.filter(operation => operation.status === 'expired').map(operation => <p role="status" key={operation.id}>Request {operation.id}: retained result expired and cannot be replayed. Existing local downloads remain yours; new generation requires fresh approval.</p>)}
    {!revision ? <p className="visual-empty">Accept this scene’s shot plan before generating video.</p> : !approvedFrame ? <p className="visual-empty">Approve a current storyboard frame for this scene’s accepted revision. Earlier or stale frames stay available but cannot start a new clip.</p> : !prompt ? <p className="visual-empty">Refresh this shot’s stale or missing video motion prompt.</p> : <>
      <div className="video-anchor-summary"><Film size={16} /><div><strong>Approved start frame</strong><span>{approvedFrame.id} · prompt v{prompt.version}</span></div></div>
      <div className="video-prompt-summary"><span>Motion prompt</span><p>{prompt.generatedText}</p>{prompt.negativeConstraints.length ? <small>Avoid: {prompt.negativeConstraints.join(' · ')}</small> : null}</div>
      <div className="video-settings">
        <label><span>Duration</span><select aria-label="Video duration" value={settings.durationSeconds} disabled={Boolean(activeOperationId)} onChange={(event) => changeSettings({ durationSeconds: Number(event.target.value) as 4 | 6 | 8 })}><option value={4}>4 seconds</option><option value={6}>6 seconds</option><option value={8}>8 seconds</option></select></label>
        <label><span>Resolution</span><select aria-label="Video resolution" value={settings.resolution} disabled={Boolean(activeOperationId)} onChange={(event) => changeSettings({ resolution: event.target.value as '720p' | '1080p' })}><option value="720p">720p</option><option value="1080p">1080p</option></select></label>
        <label><span>Aspect</span><select aria-label="Video aspect ratio" value={settings.aspectRatio} disabled={Boolean(activeOperationId)} onChange={(event) => changeSettings({ aspectRatio: event.target.value as '9:16' | '16:9' })}><option value="9:16">9:16 vertical</option><option value="16:9">16:9 landscape</option></select></label>
        <div><span>Estimate</span><strong>{estimate === null ? 'Server guarded' : `$${estimate.toFixed(2)} USD`}</strong></div>
      </div>
      <p className="video-capability-note">{canReview ? preflight ? `${preflight.capability.model} · one silent clip · start/end frames supported. ` : preflightError ? '' : 'Checking video request limits. ' : ''}Separate reference images are not sent with this start-frame workflow.</p>
      {canReview && preflightError ? <p role="alert">{preflightError}</p> : null}
      {providerMode === 'fixture' && <p className="video-capability-note">Fixture test footage: actual duration and dimensions can differ from your requested settings. This is not a finished production clip.</p>}
      {preflight?.blockers.map((message) => <p role="alert" key={message}>{message}</p>)}
      {!activeRecord ? <div className="video-generation-footer">
        {footageShortfall && <p role="status">This {settings.durationSeconds}s clip is shorter than the planned {shot.durationSeconds}s shot. Choose a longer clip or revise the shot before full-story export. Shots over 8s need a revised plan or a shorter approved edit.</p>}
        {!footageShortfall && settings.durationSeconds > shot.durationSeconds && <p className="assistant-help">The planned shot uses {shot.durationSeconds}s. Extra footage can be trimmed during assembly; generation is charged for the full {settings.durationSeconds}s clip.</p>}
        <label><input type="checkbox" checked={confirmed} disabled={!preflightReady || starting || Boolean(unknownOperation)} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm one {settings.durationSeconds}s {settings.resolution} silent clip, the approved frame, prompt, content transfer, and {estimate === null ? 'server-enforced spend ceiling' : `$${estimate.toFixed(2)} estimate`}.</label>
        <div><small>Clip stays unapproved until review.</small><button type="button" className="primary-button" disabled={!confirmed || !preflightReady || starting || Boolean(unknownOperation)} onClick={() => void startGeneration()}>{starting ? <LoaderCircle className="spin" size={14} /> : <Film size={14} />} Generate one clip</button></div>
      </div> : null}
      {lastRetryable && !activeOperationId && !unknownOperation ? <button type="button" className="video-retry secondary-button" disabled={!confirmed || !preflightReady || starting} onClick={() => void startGeneration(lastRetryable.id)}><RotateCcw size={12} /> Retry as a new linked operation</button> : null}
    </>}
    {clips.length ? <div className="video-version-stack" aria-label="Video versions">{clips.map((clip) => <article key={clip.id} className={`video-version video-${clip.status}`}>
      {clipUrls[clip.id] ? <video controls muted playsInline preload="metadata" src={clipUrls[clip.id]} aria-label={`Video version for ${shot.title}`}
        onLoadedMetadata={(event) => { const element = event.currentTarget; if (Number.isFinite(element.duration)) setDecoded((current) => ({ ...current, [clip.id]: { hash: clip.blobHash, seconds: element.duration, width: element.videoWidth, height: element.videoHeight } })); }} /> : <div className="video-missing">Local clip unavailable. MP4 bytes are not included in project backups. Download from the original browser if retained; this backup cannot restore them.</div>}
      {!clipUrls[clip.id] && visual?.videoOperations[clip.operationId] && cinema.revisions[clip.revisionId] ? <button type="button" className="secondary-button" disabled={Boolean(recoveringClip)} onClick={() => void recoverClip(clip.id)}>{recoveringClip === clip.id ? 'Checking retained clip…' : 'Recover from existing request'}</button> : null}
      {recoveryMessages[clip.id] ? <p role="status">{recoveryMessages[clip.id]}</p> : null}
      <div><strong>{clip.status === 'approved' ? 'Approved clip' : 'Clip candidate'}</strong><small>Requested: {clip.settings.durationSeconds}s · {clip.settings.resolution} · {clip.model}</small>
        {clip.provider === 'cineserye-video-fixture' && <small>Offline sample only · 1s · 160×90 · not a generated production take</small>}
        {decoded[clip.id] && <small>Decoded footage: {decoded[clip.id].seconds.toFixed(2)}s · {decoded[clip.id].width}×{decoded[clip.id].height}</small>}
      </div>
      <footer><button type="button" className="secondary-button" disabled={clip.status === 'approved' || !usableClip(clip)} onClick={() => { if (usableClip(clip)) onUpdate((state) => approveVideoClip(state, clip.id)); }}><Check size={12} /> {clip.status === 'approved' ? 'Approved' : 'Approve clip'}</button><button type="button" className="icon-button" aria-label={`Reject video clip ${clip.id}`} onClick={() => onUpdate((state) => rejectVideoClip(state, clip.id))}><X size={13} /></button><button type="button" className="icon-button" aria-label={`Download video clip ${clip.id}`} onClick={() => void downloadClip(clip.id)}><Download size={13} /></button><button type="button" className="secondary-button" onClick={() => downloadMetadata(clip.id)}>Metadata</button></footer>
    </article>)}</div> : null}
    <p className="video-portability-note">Video bytes stay in this browser and are downloaded separately. Project backups include clip provenance and approvals, but intentionally exclude large MP4 bytes.</p>
  </section>;
}
