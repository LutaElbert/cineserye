'use client';

import { Check, Download, Film, LoaderCircle, RotateCcw, Square, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const prompt = Object.values(cinema.prompts).find((candidate) => candidate.ownerNodeId === shot.nodeId && candidate.purpose === 'video') ?? null;
  const approvedFrame = Object.values(visual?.storyboardFrames ?? {}).find((frame) => frame.shotId === shot.id && frame.status === 'approved') ?? null;
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
    durationSeconds: 4,
    resolution: '720p',
    audio: false,
    outputCount: 1,
    seed: null,
  });
  const [confirmed, setConfirmed] = useState(false);
  const [activeOperationId, setActiveOperationId] = useState<string | null>(resumableOperation?.id ?? null);
  const [starting, setStarting] = useState(false);
  const [clipUrls, setClipUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void fetch('/api/cinema/generate-video').then((response) => response.json() as Promise<VideoPreflightResponse>).then((result) => {
      if (!active) return;
      if (result.ok) setPreflight(result);
      else onNotice(result.error.message, 'error');
    }).catch(() => onNotice('Video capabilities are temporarily unavailable.', 'error'));
    return () => { active = false; };
  }, [onNotice]);

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
        const response = await fetch(`/api/cinema/generate-video?operationId=${encodeURIComponent(activeOperationId)}`);
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
  }, [activeOperationId, applyOperationSnapshot, onNotice]);

  const estimate = preflight?.usdPerSecond === null || preflight?.usdPerSecond === undefined
    ? null
    : Math.round(preflight.usdPerSecond * settings.durationSeconds * 100) / 100;

  const changeSettings = (patch: Partial<CinemaVideoSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    setConfirmed(false);
  };

  const startGeneration = async (retryOf: string | null = null) => {
    if (!approvedFrame || !prompt || !cinema.activeRevisionId || !preflight || starting || activeOperationId) return;
    setStarting(true);
    const operationId = `video-${crypto.randomUUID()}`;
    try {
      const media = await loadLocalMediaBlob(approvedFrame.blobHash);
      if (!media) throw new Error('The approved storyboard frame is missing from local storage.');
      const frameBase64 = await blobToBase64(media.blob);
      const request: GenerateVideoRequest = {
        version: 1,
        idempotencyKey: operationId,
        shotId: shot.id,
        revisionId: cinema.activeRevisionId,
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
      const now = new Date().toISOString();
      const record: CinemaVideoOperationRecord = {
        id: operationId,
        shotId: shot.id,
        revisionId: cinema.activeRevisionId,
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
      setStarting(false);
    }
  };

  const cancel = async () => {
    if (!activeOperationId) return;
    const response = await fetch(`/api/cinema/generate-video?operationId=${encodeURIComponent(activeOperationId)}`, { method: 'DELETE' });
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
    {!approvedFrame ? <p className="visual-empty">Approve one storyboard frame to unlock a bounded video experiment.</p> : !prompt ? <p className="visual-empty">This shot has no video motion prompt.</p> : <>
      <div className="video-anchor-summary"><Film size={16} /><div><strong>Approved start frame</strong><span>{approvedFrame.id} · prompt v{prompt.version}</span></div></div>
      <div className="video-prompt-summary"><span>Motion prompt</span><p>{prompt.generatedText}</p>{prompt.negativeConstraints.length ? <small>Avoid: {prompt.negativeConstraints.join(' · ')}</small> : null}</div>
      <div className="video-settings">
        <label><span>Duration</span><select aria-label="Video duration" value={settings.durationSeconds} disabled={Boolean(activeOperationId)} onChange={(event) => changeSettings({ durationSeconds: Number(event.target.value) as 4 | 6 | 8 })}><option value={4}>4 seconds</option><option value={6}>6 seconds</option><option value={8}>8 seconds</option></select></label>
        <label><span>Resolution</span><select aria-label="Video resolution" value={settings.resolution} disabled={Boolean(activeOperationId)} onChange={(event) => changeSettings({ resolution: event.target.value as '720p' | '1080p' })}><option value="720p">720p</option><option value="1080p">1080p</option></select></label>
        <label><span>Aspect</span><select aria-label="Video aspect ratio" value={settings.aspectRatio} disabled={Boolean(activeOperationId)} onChange={(event) => changeSettings({ aspectRatio: event.target.value as '9:16' | '16:9' })}><option value="9:16">9:16 vertical</option><option value="16:9">16:9 landscape</option></select></label>
        <div><span>Estimate</span><strong>{estimate === null ? 'Server guarded' : `$${estimate.toFixed(2)} USD`}</strong></div>
      </div>
      <p className="video-capability-note">{preflight ? `${preflight.capability.model} · one silent clip · start/end frames supported` : 'Loading provider capabilities…'} Separate reference images are not sent with this start-frame workflow.</p>
      {activeRecord ? <div className="video-operation-status" role="status" aria-live="polite"><LoaderCircle className="spin" size={15} /><div><strong>{activeRecord.status.replace('-', ' ')}</strong><span>Operation metadata is saved locally and resumes after reload.</span></div><button type="button" className="secondary-button" onClick={() => void cancel()}><Square size={12} /> Cancel</button></div> : <div className="video-generation-footer">
        <label><input type="checkbox" checked={confirmed} disabled={!preflight || starting} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm one {settings.durationSeconds}s {settings.resolution} silent clip, the approved frame, prompt, content transfer, and {estimate === null ? 'server-enforced spend ceiling' : `$${estimate.toFixed(2)} estimate`}.</label>
        <div><small>Clip stays unapproved until review.</small><button type="button" className="primary-button" disabled={!confirmed || !preflight || starting} onClick={() => void startGeneration()}>{starting ? <LoaderCircle className="spin" size={14} /> : <Film size={14} />} Generate one clip</button></div>
      </div>}
      {lastRetryable && !activeOperationId ? <button type="button" className="video-retry secondary-button" disabled={!confirmed || starting} onClick={() => void startGeneration(lastRetryable.id)}><RotateCcw size={12} /> Retry as a new linked operation</button> : null}
    </>}
    {clips.length ? <div className="video-version-stack" aria-label="Video versions">{clips.map((clip) => <article key={clip.id} className={`video-version video-${clip.status}`}>
      {clipUrls[clip.id] ? <video controls muted playsInline preload="metadata" src={clipUrls[clip.id]} aria-label={`Video version for ${shot.title}`} /> : <div className="video-missing">Local clip unavailable</div>}
      <div><strong>{clip.status === 'approved' ? 'Approved clip' : 'Clip candidate'}</strong><small>{clip.durationSeconds}s · {clip.settings.resolution} · {clip.model}</small></div>
      <footer><button type="button" className="secondary-button" disabled={clip.status === 'approved'} onClick={() => onUpdate((state) => approveVideoClip(state, clip.id))}><Check size={12} /> {clip.status === 'approved' ? 'Approved' : 'Approve clip'}</button><button type="button" className="icon-button" aria-label={`Reject video clip ${clip.id}`} onClick={() => onUpdate((state) => rejectVideoClip(state, clip.id))}><X size={13} /></button><button type="button" className="icon-button" aria-label={`Download video clip ${clip.id}`} onClick={() => void downloadClip(clip.id)}><Download size={13} /></button><button type="button" className="secondary-button" onClick={() => downloadMetadata(clip.id)}>Metadata</button></footer>
    </article>)}</div> : null}
    <p className="video-portability-note">Video bytes stay in this browser and are downloaded separately. Project backups include clip provenance and approvals, but intentionally exclude large MP4 bytes.</p>
  </section>;
}
