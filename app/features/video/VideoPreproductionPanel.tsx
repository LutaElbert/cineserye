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
import { persistVideoClipArtifact } from './video-storage';

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

function base64Blob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: 'video/mp4' });
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

const TERMINAL = new Set(['ready', 'failed', 'cancelled', 'timed-out']);

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
  providerMode,
  onUpdate,
  onNotice,
}: {
  cinema: CinemaProjectData;
  shot: CinemaShotRecord;
  providerMode: 'fixture' | 'live';
  onUpdate: (updater: VisualUpdater) => void;
  onNotice: (message: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const visual = cinema.visualPreproduction;
  const { revision, prompt, approvedFrame } = videoGenerationInputs(cinema, shot);
  const operations = useMemo(() => Object.values(visual?.videoOperations ?? {})
    .filter((operation) => operation.shotId === shot.id)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt)), [shot.id, visual?.videoOperations]);
  const clips = useMemo(() => Object.values(visual?.videoClips ?? {})
    .filter((clip) => clip.shotId === shot.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt)), [shot.id, visual?.videoClips]);
  const resumableOperation = operations.find((operation) => !TERMINAL.has(operation.status)) ?? null;
  const [preflight, setPreflight] = useState<Extract<VideoPreflightResponse, { ok: true }> | null>(null);
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
  const [confirmed, setConfirmed] = useScopedConfirmation(approvalScope);
  const [activeOperationId, setActiveOperationId] = useState<string | null>(resumableOperation?.id ?? null);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const [clipUrls, setClipUrls] = useState<Record<string, string>>({});
  const [decoded, setDecoded] = useState<Record<string, { seconds: number; width: number; height: number }>>({});

  useEffect(() => {
    let active = true;
    setPreflight(null);
    void fetch('/api/cinema/generate-video').then((response) => response.json() as Promise<VideoPreflightResponse>).then((result) => {
      if (!active) return;
      if (result.ok && result.mode === providerMode) setPreflight(result);
      else if (result.ok) onNotice('Video provider mode changed. Reload capabilities before confirming.', 'error');
      else onNotice(result.error.message, 'error');
    }).catch(() => onNotice('Video capabilities are temporarily unavailable.', 'error'));
    return () => { active = false; };
  }, [onNotice, providerMode]);

  useEffect(() => {
    if (!activeOperationId && resumableOperation) setActiveOperationId(resumableOperation.id);
  }, [activeOperationId, resumableOperation]);

  useEffect(() => {
    let disposed = false;
    const urls: string[] = [];
    void Promise.all(clips.map(async (clip) => {
      const media = await loadLocalMediaBlob(clip.blobHash);
      if (!media) return null;
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
  }, [clips]);

  const applyOperationSnapshot = useCallback(async (result: Extract<VideoOperationResponse, { ok: true }>) => {
    const operation = result.operation;
    const current = visual?.videoOperations[operation.operationId];
    if (!current) return;
    if (operation.status !== 'ready' && current.status === operation.status && current.provider === operation.provider
      && current.model === operation.model && current.providerOperationId === operation.providerOperationId && current.error === operation.error) return;
    if (operation.status === 'ready' && operation.clip && visual?.videoClips[operation.clip.id]) {
      setActiveOperationId(null);
      return;
    }
    if (operation.status === 'ready' && operation.clip && !visual?.videoClips[operation.clip.id]) {
      try {
        const blob = base64Blob(operation.clip.base64);
        if (!blob.size) throw new Error('The provider returned an empty video clip.');
        const media = await persistVideoClipArtifact({
          blob,
          width: operation.clip.width,
          height: operation.clip.height,
        });
        onUpdate((state) => ({
          ...state,
          videoOperations: {
            ...state.videoOperations,
            [operation.operationId]: {
              ...state.videoOperations[operation.operationId],
              status: 'ready',
              provider: operation.provider,
              model: operation.model,
              providerOperationId: operation.providerOperationId,
              completedAt: new Date().toISOString(),
              error: null,
            },
          },
          videoClips: {
            ...state.videoClips,
            [operation.clip!.id]: {
              id: operation.clip!.id,
              operationId: operation.operationId,
              shotId: current.shotId,
              revisionId: current.revisionId,
              promptId: current.promptId,
              promptVersion: current.promptVersion,
              startFrameId: current.startFrameId,
              endFrameId: current.endFrameId,
              referenceIds: [...current.referenceIds],
              provider: operation.provider,
              model: operation.model,
              capabilityProfileVersion: operation.capability.version,
              settings: { ...current.settings },
              blobHash: media.hash,
              mimeType: 'video/mp4',
              width: operation.clip!.width,
              height: operation.clip!.height,
              byteSize: blob.size,
              durationSeconds: operation.clip!.durationSeconds,
              status: 'candidate',
              estimatedCost: operation.estimatedCost,
              currency: operation.currency,
              createdAt: new Date().toISOString(),
            },
          },
        }));
        setActiveOperationId(null);
        onNotice('Video clip is ready for review. It has not been approved.', 'success');
      } catch (error) {
        onUpdate((state) => ({
          ...state,
          videoOperations: {
            ...state.videoOperations,
            [operation.operationId]: {
              ...state.videoOperations[operation.operationId],
              status: 'failed',
              completedAt: new Date().toISOString(),
              error: error instanceof Error ? error.message : 'The clip could not be saved locally.',
            },
          },
        }));
        setActiveOperationId(null);
        onNotice(error instanceof Error ? error.message : 'The clip could not be saved locally.', 'error');
      }
      return;
    }
    onUpdate((state) => ({
      ...state,
      videoOperations: {
        ...state.videoOperations,
        [operation.operationId]: {
          ...state.videoOperations[operation.operationId],
          status: operation.status,
          provider: operation.provider,
          model: operation.model,
          providerOperationId: operation.providerOperationId,
          completedAt: TERMINAL.has(operation.status) ? new Date().toISOString() : null,
          error: operation.error,
        },
      },
    }));
    if (TERMINAL.has(operation.status)) {
      setActiveOperationId(null);
      onNotice(operation.error ?? `Video operation ${operation.status}.`, operation.status === 'cancelled' ? 'info' : 'error');
    }
  }, [onNotice, onUpdate, visual]);

  useEffect(() => {
    if (!activeOperationId) return;
    let disposed = false;
    let timer = 0;
    const poll = async () => {
      try {
        const ownedOperation = visual?.videoOperations[activeOperationId];
        if (!ownedOperation) throw new Error('The video operation scope is unavailable.');
        const response = await fetch(ownedVideoOperationUrl({ projectId: cinema.projectId, sceneId: shot.sceneId, shotId: shot.id, revisionId: ownedOperation.revisionId, operationId: activeOperationId }));
        const result = await response.json() as VideoOperationResponse;
        if (!result.ok) throw new Error(result.error.message);
        if (!disposed) await applyOperationSnapshot(result);
        if (!disposed && !TERMINAL.has(result.operation.status)) timer = window.setTimeout(poll, 500);
      } catch (error) {
        if (!disposed) {
          timer = window.setTimeout(poll, 1_500);
          onNotice(error instanceof Error ? error.message : 'Video status could not be refreshed.', 'error');
        }
      }
    };
    void poll();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [activeOperationId, applyOperationSnapshot, onNotice, cinema.projectId, shot.id, shot.sceneId, visual?.videoOperations]);

  const estimate = preflight?.usdPerSecond === null || preflight?.usdPerSecond === undefined
    ? null
    : Math.round(preflight.usdPerSecond * settings.durationSeconds * 100) / 100;
  const footageShortfall = settings.durationSeconds < shot.durationSeconds;

  const changeSettings = (patch: Partial<CinemaVideoSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    setConfirmed(false);
  };

  const startGeneration = async (retryOf: string | null = null) => {
    if (!confirmed || !approvedFrame || !prompt || !revision || !preflight?.ready || preflight.mode !== providerMode || startingRef.current || activeOperationId) return;
    const capturedApproval = approvalScope;
    startingRef.current = true;
    setStarting(true);
    setConfirmed(false);
    const operationId = `video-${crypto.randomUUID()}`;
    try {
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
      onUpdate((state) => ({ ...state, videoOperations: { ...state.videoOperations, [operationId]: record } }));
      const response = await fetch('/api/cinema/generate-video', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      const result = await response.json() as VideoOperationResponse;
      if (!result.ok) throw new Error(result.error.message);
      setConfirmed(false);
      setActiveOperationId(operationId);
      await applyOperationSnapshot(result);
      onNotice('Video generation started. You can leave this shot and return while Cineserye tracks it.', 'success');
    } catch (error) {
      onUpdate((state) => {
        const record = state.videoOperations[operationId];
        if (!record) return state;
        return {
          ...state,
          videoOperations: {
            ...state.videoOperations,
            [operationId]: { ...record, status: 'failed', completedAt: new Date().toISOString(), error: error instanceof Error ? error.message : 'Video generation failed.' },
          },
        };
      });
      onNotice(error instanceof Error ? error.message : 'Video generation failed.', 'error');
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const cancel = async () => {
    if (!activeOperationId) return;
    const ownedOperation = visual?.videoOperations[activeOperationId];
    if (!ownedOperation) return onNotice('The video operation scope is unavailable.', 'error');
    const response = await fetch(ownedVideoOperationUrl({ projectId: cinema.projectId, sceneId: shot.sceneId, shotId: shot.id, revisionId: ownedOperation.revisionId, operationId: activeOperationId }), { method: 'DELETE' });
    const result = await response.json() as VideoOperationResponse;
    if (!result.ok) return onNotice(result.error.message, 'error');
    await applyOperationSnapshot(result);
    onNotice(result.operation.cancellationNote ?? 'Video tracking cancelled.', 'info');
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
  const lastRetryable = operations.find((operation) => ['failed', 'cancelled', 'timed-out'].includes(operation.status)) ?? null;

  return <section className="video-workbench" aria-labelledby="video-workbench-title">
    <header>
      <div><span>Motion workbench</span><strong id="video-workbench-title">Animate approved frame</strong></div>
      <small>{clips.length} {clips.length === 1 ? 'version' : 'versions'}</small>
    </header>
    {!revision ? <p className="visual-empty">Accept this scene’s shot plan before generating video.</p> : !approvedFrame ? <p className="visual-empty">Approve a current storyboard frame for this scene’s accepted revision. Earlier or stale frames stay available but cannot start a new clip.</p> : !prompt ? <p className="visual-empty">Refresh this shot’s stale or missing video motion prompt.</p> : <>
      <div className="video-anchor-summary"><Film size={16} /><div><strong>Approved start frame</strong><span>{approvedFrame.id} · prompt v{prompt.version}</span></div></div>
      <div className="video-prompt-summary"><span>Motion prompt</span><p>{prompt.generatedText}</p>{prompt.negativeConstraints.length ? <small>Avoid: {prompt.negativeConstraints.join(' · ')}</small> : null}</div>
      <div className="video-settings">
        <label><span>Duration</span><select aria-label="Video duration" value={settings.durationSeconds} disabled={Boolean(activeOperationId)} onChange={(event) => changeSettings({ durationSeconds: Number(event.target.value) as 4 | 6 | 8 })}><option value={4}>4 seconds</option><option value={6}>6 seconds</option><option value={8}>8 seconds</option></select></label>
        <label><span>Resolution</span><select aria-label="Video resolution" value={settings.resolution} disabled={Boolean(activeOperationId)} onChange={(event) => changeSettings({ resolution: event.target.value as '720p' | '1080p' })}><option value="720p">720p</option><option value="1080p">1080p</option></select></label>
        <label><span>Aspect</span><select aria-label="Video aspect ratio" value={settings.aspectRatio} disabled={Boolean(activeOperationId)} onChange={(event) => changeSettings({ aspectRatio: event.target.value as '9:16' | '16:9' })}><option value="9:16">9:16 vertical</option><option value="16:9">16:9 landscape</option></select></label>
        <div><span>Estimate</span><strong>{estimate === null ? 'Server guarded' : `$${estimate.toFixed(2)} USD`}</strong></div>
      </div>
      <p className="video-capability-note">{preflight ? `${preflight.capability.model} · one silent clip · start/end frames supported` : 'Loading provider capabilities…'} Separate reference images are not sent with this start-frame workflow.</p>
      {providerMode === 'fixture' && <p className="video-capability-note">Fixture test footage: actual duration and dimensions can differ from your requested settings. This is not a finished production clip.</p>}
      {preflight?.blockers.map((message) => <p role="alert" key={message}>{message}</p>)}
      {activeRecord ? <div className="video-operation-status" role="status" aria-live="polite"><LoaderCircle className="spin" size={15} /><div><strong>{activeRecord.status.replace('-', ' ')}</strong><span>Metadata is local. Fixture tracking resumes only while this server remains running.</span></div><button type="button" className="secondary-button" onClick={() => void cancel()}><Square size={12} /> Cancel</button></div> : <div className="video-generation-footer">
        {footageShortfall && <p role="status">This {settings.durationSeconds}s clip is shorter than the planned {shot.durationSeconds}s shot. Choose a longer clip or revise the shot before full-story export. Shots over 8s need a revised plan or a shorter approved edit.</p>}
        {!footageShortfall && settings.durationSeconds > shot.durationSeconds && <p className="assistant-help">The planned shot uses {shot.durationSeconds}s. Extra footage can be trimmed during assembly; generation is charged for the full {settings.durationSeconds}s clip.</p>}
        <label><input type="checkbox" checked={confirmed} disabled={!preflight?.ready || starting} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm one {settings.durationSeconds}s {settings.resolution} silent clip, the approved frame, prompt, content transfer, and {estimate === null ? 'server-enforced spend ceiling' : `$${estimate.toFixed(2)} estimate`}.</label>
        <div><small>Clip stays unapproved until review.</small><button type="button" className="primary-button" disabled={!confirmed || !preflight?.ready || starting} onClick={() => void startGeneration()}>{starting ? <LoaderCircle className="spin" size={14} /> : <Film size={14} />} Generate one clip</button></div>
      </div>}
      {lastRetryable && !activeOperationId ? <button type="button" className="video-retry secondary-button" disabled={!confirmed || !preflight?.ready || starting} onClick={() => void startGeneration(lastRetryable.id)}><RotateCcw size={12} /> Retry as a new linked operation</button> : null}
    </>}
    {clips.length ? <div className="video-version-stack" aria-label="Video versions">{clips.map((clip) => <article key={clip.id} className={`video-version video-${clip.status}`}>
      {clipUrls[clip.id] ? <video controls muted playsInline preload="metadata" src={clipUrls[clip.id]} aria-label={`Video version for ${shot.title}`}
        onLoadedMetadata={(event) => { const element = event.currentTarget; if (Number.isFinite(element.duration)) setDecoded((current) => ({ ...current, [clip.id]: { seconds: element.duration, width: element.videoWidth, height: element.videoHeight } })); }} /> : <div className="video-missing">Local clip unavailable</div>}
      <div><strong>{clip.status === 'approved' ? 'Approved clip' : 'Clip candidate'}</strong><small>Requested: {clip.settings.durationSeconds}s · {clip.settings.resolution} · {clip.model}</small>
        {clip.provider === 'cineserye-video-fixture' && <small>Offline sample only · 1s · 160×90 · not a generated production take</small>}
        {decoded[clip.id] && <small>Decoded footage: {decoded[clip.id].seconds.toFixed(2)}s · {decoded[clip.id].width}×{decoded[clip.id].height}</small>}
      </div>
      <footer><button type="button" className="secondary-button" disabled={clip.status === 'approved'} onClick={() => onUpdate((state) => approveVideoClip(state, clip.id))}><Check size={12} /> {clip.status === 'approved' ? 'Approved' : 'Approve clip'}</button><button type="button" className="icon-button" aria-label={`Reject video clip ${clip.id}`} onClick={() => onUpdate((state) => rejectVideoClip(state, clip.id))}><X size={13} /></button><button type="button" className="icon-button" aria-label={`Download video clip ${clip.id}`} onClick={() => void downloadClip(clip.id)}><Download size={13} /></button><button type="button" className="secondary-button" onClick={() => downloadMetadata(clip.id)}>Metadata</button></footer>
    </article>)}</div> : null}
    <p className="video-portability-note">Video bytes stay in this browser and are downloaded separately. Project backups include clip provenance and approvals, but intentionally exclude large MP4 bytes.</p>
  </section>;
}
