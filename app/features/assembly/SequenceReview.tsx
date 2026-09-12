'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CinemaProjectData } from '../../domain/cinema/project-data';
import { loadLocalMediaBlob } from '../../editor/persistence';
import { ASSEMBLY_LIMITS, buildSequenceManifest, defaultSequenceTrim, sequenceRows, sequenceTimingIssue, type SequenceTrim } from './sequence-manifest';
import './sequence-review.css';
import type { WorkflowCapabilities } from '../story-development/workflow-capabilities';
import { WorkspaceFeatureStatus, workspaceFeature } from '../simplified-flow/WorkspaceFeatureStatus';
import { useWorkspaceAdmission } from '../simplified-flow/useWorkspaceAdmission';
import { RenderedCut } from './RenderedCut';

type Capability = { available: boolean; token: string | null; reason: string | null };
async function requestRenderCapability(signal: AbortSignal): Promise<Capability> {
  const response = await fetch('/api/cinema/assemble', { signal, cache: 'no-store' });
  if (!response.ok) throw Error('Local renderer preflight is unavailable.');
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object' || !('available' in value) || typeof value.available !== 'boolean'
    || !('token' in value) || !(value.token === null || typeof value.token === 'string')
    || !('reason' in value) || !(value.reason === null || typeof value.reason === 'string')
    || value.available && !value.token) throw Error('Local renderer preflight is invalid.');
  return { available: value.available, token: value.token, reason: value.reason };
}
type LocalClip = { url: string; blob: Blob; duration: number | null; width: number | null; height: number | null; error: string | null };

function inspectLocalClip(url: string): Promise<Pick<LocalClip, 'duration' | 'width' | 'height' | 'error'>> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata'; video.muted = true;
    const finish = (value: Pick<LocalClip, 'duration' | 'width' | 'height' | 'error'>) => {
      video.removeAttribute('src'); video.load(); resolve(value);
    };
    video.onloadedmetadata = () => finish({ duration: video.duration, width: video.videoWidth, height: video.videoHeight, error: null });
    video.onerror = () => finish({ duration: null, width: null, height: null, error: 'Local clip metadata could not be decoded. Replace or regenerate this take before export.' });
    video.src = url; video.load();
  });
}

export function SequenceReview({ cinema, capabilities, onNotice }: { cinema: CinemaProjectData; capabilities: WorkflowCapabilities | null; onNotice: (message: string, tone?: 'info' | 'success' | 'error') => void }) {
  const { canReview, mode } = workspaceFeature(capabilities, 'assembly');
  const admitWorkspace = useWorkspaceAdmission(capabilities);
  const rows = useMemo(() => sequenceRows(cinema), [cinema]);
  const unplannedScenes = cinema.sceneOrder.filter((sceneId) => !cinema.scenes[sceneId]?.shotIds.length)
    .map((sceneId) => cinema.scenes[sceneId]?.title ?? 'Missing scene');
  const mediaIdentity = rows.map((row) => `${row.shot.id}:${row.clip?.id}:${row.clip?.blobHash}`).join('|');
  const identity = `${unplannedScenes.join('|')}:${rows.map((row) => `${row.shot.id}:${row.shot.durationSeconds}:${row.clip?.id}:${row.clip?.blobHash}:${row.issue}`).join('|')}`;
  const [trims, setTrims] = useState<Record<string, SequenceTrim>>({});
  const [aspect, setAspect] = useState<'9:16' | '16:9'>(() => cinema.scenes[cinema.sceneOrder[0]]?.brief?.aspectRatio === '16:9' ? '16:9' : '9:16');
  const [local, setLocal] = useState<Record<string, LocalClip>>({});
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const loading = loadedIdentity !== mediaIdentity;
  const [preflightResult, setCapability] = useState<{ workspace: WorkflowCapabilities; value: Capability } | null>(null);
  const capability = preflightResult?.workspace === capabilities ? preflightResult?.value ?? null : null;
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [output, setOutput] = useState<{ url: string; duration: string; signature: string } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const abort = useRef<AbortController | null>(null);
  const signature = `${cinema.projectId}:${identity}:${aspect}:${JSON.stringify(trims)}`;
  const currentSignature = useRef(signature);
  useLayoutEffect(() => { currentSignature.current = signature; }, [signature]);
  const signatureRef = useRef(mediaIdentity);
  // Media identity, not unrelated canvas edits, drives URL loading.
  useEffect(() => {
    let disposed = false;
    const urls: string[] = [];
    const clips = rows.flatMap((row) => row.clip ? [row.clip] : []);
    void Promise.all(clips.map(async (clip) => {
      const media = await loadLocalMediaBlob(clip.blobHash);
      if (!media) return null;
      const url = URL.createObjectURL(media.blob); urls.push(url);
      if (disposed) { URL.revokeObjectURL(url); return null; }
      const metadata = await inspectLocalClip(url);
      return [clip.id, { url, blob: media.blob, ...metadata }] as const;
    })).then((entries) => {
      if (!disposed) {
        setLocal(Object.fromEntries(entries.filter((entry) => entry !== null))); setLoadedIdentity(mediaIdentity);
        if (signatureRef.current !== mediaIdentity) { setActive(0); setPlaying(false); signatureRef.current = mediaIdentity; }
      }
    }).catch(() => { if (!disposed) { setLocal({}); setLoadedIdentity(mediaIdentity); } });
    return () => { disposed = true; urls.forEach((url) => URL.revokeObjectURL(url)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaIdentity]);

  useEffect(() => {
    if (!canReview || !capabilities) return;
    const controller = new AbortController();
    void requestRenderCapability(controller.signal)
      .then((value) => { if (!controller.signal.aborted) setCapability({ workspace: capabilities, value }); })
      .catch(() => { if (!controller.signal.aborted) setCapability({ workspace: capabilities, value: { available: false, token: null, reason: 'Local renderer preflight is unavailable. Refresh workspace status to retry.' } }); });
    return () => controller.abort();
  }, [capabilities, canReview]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => () => { if (output) URL.revokeObjectURL(output.url); }, [output]);

  const issueFor = (item: (typeof rows)[number]) => item.issue ?? (!loading && item.clip && !local[item.clip.id]
    ? 'Clip bytes are missing in this browser. Project backups contain only video metadata. Download from the original browser if retained; this backup cannot restore the video.'
    : item.clip && local[item.clip.id]?.error ? local[item.clip.id].error
    : item.clip && local[item.clip.id]?.duration !== null && local[item.clip.id]?.duration !== undefined
      ? sequenceTimingIssue(trims[item.shot.id] ?? defaultSequenceTrim(item.shot), local[item.clip.id].duration!) : null);
  const total = rows.reduce((sum, row) => sum + (trims[row.shot.id] ?? defaultSequenceTrim(row.shot)).durationFrames, 0) / 24;
  const row = rows[active], clip = row?.clip ? local[row.clip.id] : null;
  const trim = row ? trims[row.shot.id] ?? defaultSequenceTrim(row.shot) : null;
  const complete = rows.length > 0 && unplannedScenes.length === 0 && rows.length <= ASSEMBLY_LIMITS.maxClips && total <= ASSEMBLY_LIMITS.maxRuntimeSeconds && !loading
    && rows.every((item) => !issueFor(item) && item.clip && local[item.clip.id]?.duration !== null);
  const activeIssue = row ? issueFor(row) : null;

  function patchTrim(shotId: string, field: keyof SequenceTrim, seconds: number) {
    const source = rows.find((item) => item.shot.id === shotId);
    if (!source || !Number.isFinite(seconds)) return;
    setPlaying(false);
    setTrims((current) => ({ ...current, [shotId]: { ...(current[shotId] ?? defaultSequenceTrim(source.shot)), [field]: Math.max(field === 'durationFrames' ? 1 : 0, Math.min(120 * 24, Math.round(seconds * 24))) } }));
  }

  function advance() {
    if (active + 1 < rows.length && rows[active + 1].clip && local[rows[active + 1].clip!.id]) setActive((value) => value + 1);
    else setPlaying(false);
  }

  async function render() {
    if (!complete || rendering || abort.current || !canReview || !capabilities || mode === 'loading') return;
    const startSignature = currentSignature.current;
    const controller = new AbortController(); abort.current = controller;
    setRendering(true); setPlaying(false); video.current?.pause();
    try {
      const assertWorkspace = admitWorkspace(mode);
      const manifest = buildSequenceManifest(rows, trims, aspect);
      const fresh = await requestRenderCapability(controller.signal);
      assertWorkspace();
      if (controller.signal.aborted || currentSignature.current !== startSignature) throw Error('The selected sequence changed. Review it before rendering.');
      setCapability({ workspace: capabilities, value: fresh });
      if (!fresh.available || !fresh.token) throw new Error(fresh.reason ?? 'Local renderer unavailable.');
      const form = new FormData(); form.set('manifest', JSON.stringify(manifest));
      rows.forEach((item, index) => form.set(`clip-${index}`, local[item.clip!.id].blob, `clip-${index}.mp4`));
      const response = await fetch('/api/cinema/assemble', { method: 'POST', headers: { 'x-cineserye-local-render': fresh.token }, body: form, signal: controller.signal });
      if (!response.ok) { const error = await response.json() as { error?: string }; throw new Error(error.error ?? 'Local rendering failed.'); }
      const result = await response.blob();
      if (result.type !== 'video/mp4' || !result.size) throw new Error('The local renderer did not return an MP4.');
      if (controller.signal.aborted || currentSignature.current !== startSignature) throw new Error('The selected sequence changed while rendering. Review the new sequence before exporting.');
      setOutput({ url: URL.createObjectURL(result), duration: response.headers.get('x-cineserye-duration') ?? String(total), signature: startSignature });
      onNotice('Silent MP4 rendered and verified locally. Ready to review and download.', 'success');
    } catch (error) {
      onNotice(controller.signal.aborted ? 'Local render cancelled.' : error instanceof Error ? error.message : 'Local render failed.', controller.signal.aborted ? 'info' : 'error');
    } finally { setRendering(false); if (abort.current === controller) abort.current = null; }
  }

  return <section className="sequence-review nodrag nopan" aria-label="Review sequence">
    <header className="sequence-review-heading"><div><span className="sequence-kicker">Edit workspace</span><strong>Review sequence</strong></div><span>{rows.length} shots · {total.toFixed(2)}s edit</span></header>
    {!rows.length ? <div className="sequence-empty"><strong>Your cut begins with approved takes</strong><p>Accept a shot plan, then approve video takes to review a sequence.</p></div> : <div className="sequence-review-layout">
      <div className="sequence-review-main">
        <div className="sequence-review-preview">
          {clip && row && trim && !clip.error && clip.duration !== null ? <video key={`${row.clip!.id}:${active}`} ref={video} src={clip.url} controls playsInline muted preload="metadata"
            aria-label={`Sequence preview: ${row.shot.title}`}
            onLoadedMetadata={(event) => {
              const element = event.currentTarget;
              setLocal((current) => ({ ...current, [row.clip!.id]: { ...current[row.clip!.id], duration: element.duration, width: element.videoWidth, height: element.videoHeight, error: null } }));
              element.currentTime = Math.min(trim.startFrame / 24, element.duration);
              if (playing) void element.play().catch(() => setPlaying(false));
            }}
            onTimeUpdate={(event) => { if (playing && event.currentTarget.currentTime >= (trim.startFrame + trim.durationFrames) / 24) { event.currentTarget.pause(); advance(); } }}
            onEnded={() => { if (playing) advance(); }} /> : <div><strong>Preview unavailable</strong><span>{!row?.clip ? 'No local approved clip for this shot.' : activeIssue ? 'This shot has no usable local preview. Review its timeline warning.' : 'Loading the local approved clip…'}</span></div>}
        </div>
        <div className="sequence-transport"><div><strong>{row ? `${active + 1}. ${row.shot.title}` : 'Sequence preview'}</strong>{clip?.duration !== null && clip?.duration !== undefined ? <small>Decoded clip: {clip.duration.toFixed(2)}s · {clip.width}×{clip.height}</small> : <small>Every clip is decoded again before export.</small>}</div>
          <button type="button" className="secondary-button" disabled={!complete || rendering} onClick={() => {
            if (playing) { setPlaying(false); video.current?.pause(); }
            else { setPlaying(true); if (video.current && trim) { video.current.currentTime = trim.startFrame / 24; void video.current.play().catch(() => setPlaying(false)); } }
          }}>{playing ? 'Pause sequence' : 'Play from selected shot'}</button></div>
        <div className="sequence-timeline-heading"><div><span className="sequence-kicker">Timeline</span><strong>Approved takes in story order</strong></div><label>Output aspect<select value={aspect} disabled={rendering} onChange={(event) => setAspect(event.target.value as '9:16' | '16:9')}><option value="9:16">9:16 portrait</option><option value="16:9">16:9 landscape</option></select></label></div>
        <ol className="sequence-review-list">{rows.map((item, index) => {
          const timing = trims[item.shot.id] ?? defaultSequenceTrim(item.shot);
          const issue = issueFor(item);
          return <li key={item.shot.id} aria-current={index === active ? 'true' : undefined} data-state={issue ? 'attention' : item.clip ? 'ready' : 'missing'}>
            <button type="button" disabled={rendering} onClick={() => { setActive(index); setPlaying(false); }}><span className="sequence-thumbnail" aria-hidden="true"><span>{String(index + 1).padStart(2, '0')}</span></span><small>{item.sceneTitle}</small><strong>{item.shot.title}</strong><span>{(timing.durationFrames / 24).toFixed(0)}s</span></button>
            <div className="sequence-trim-fields"><label>Start (s)<input type="number" min="0" max="120" step="0.041667" value={Number((timing.startFrame / 24).toFixed(3))} disabled={rendering} onChange={(event) => patchTrim(item.shot.id, 'startFrame', event.target.valueAsNumber)} /></label>
              <label>Use (s)<input type="number" min="0.041667" max="120" step="0.041667" value={Number((timing.durationFrames / 24).toFixed(3))} disabled={rendering} onChange={(event) => patchTrim(item.shot.id, 'durationFrames', event.target.valueAsNumber)} /></label></div>
            {issue ? <small role="status" className="sequence-row-issue">{issue}</small> : null}
          </li>;
        })}</ol>
      </div>
      <aside className="sequence-review-inspector" aria-label="Sequence status and export">
        <section><span className="sequence-kicker">Sequence status</span><h3>{complete ? 'Ready for local export' : 'Review required'}</h3><p>Every missing, stale or short clip stays visible. Nothing is silently omitted.</p></section>
        <WorkspaceFeatureStatus capabilities={capabilities} feature="assembly" />
        {unplannedScenes.length ? <p role="status">Complete the shot plans first: {unplannedScenes.join(', ')}. Unplanned scenes will not be silently omitted.</p> : null}
        {activeIssue ? <section className="sequence-attention" role="status"><strong>{row?.shot.title ?? 'Selected shot'} needs attention</strong><p>Resolve the selected timeline warning before export.</p></section> : row ? <section className="sequence-selected"><span className="sequence-kicker">Selected clip</span><strong>{row.shot.title}</strong><p>{row.sceneTitle} · {(trim!.durationFrames / 24).toFixed(2)}s used</p></section> : null}
        <section className="sequence-export-summary"><strong>Silent local MP4</strong><p>720p · 24fps · up to {ASSEMBLY_LIMITS.maxClips} shots / {ASSEMBLY_LIMITS.maxRuntimeSeconds}s. Source audio, music, captions and transitions are not included.</p></section>
        {canReview && !capability?.available ? <p role="status">{capability?.reason ?? 'Checking local renderer…'}</p> : null}
        <small>Selected local clips go only to this local Cineserye server, never to an AI provider. Temporary server files are deleted after rendering.</small>
        <div className="sequence-review-actions"><button type="button" className="primary-button" disabled={!complete || !canReview || !capability?.available || rendering} onClick={() => void render()}>{rendering ? 'Rendering silent MP4…' : 'Render silent MP4 locally'}</button>
          {rendering ? <button type="button" className="secondary-button" onClick={() => abort.current?.abort()}>Cancel render</button> : null}</div>
        {output && output.signature === signature ? <RenderedCut key={output.url} url={output.url} duration={output.duration} /> : null}
      </aside>
    </div>}
  </section>;
}
