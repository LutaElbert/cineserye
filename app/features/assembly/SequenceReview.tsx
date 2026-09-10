'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CinemaProjectData } from '../../domain/cinema/project-data';
import { loadLocalMediaBlob } from '../../editor/persistence';
import { ASSEMBLY_LIMITS, buildSequenceManifest, defaultSequenceTrim, sequenceRows, type SequenceTrim } from './sequence-manifest';
import './sequence-review.css';

type Capability = { available: boolean; token: string | null; reason: string | null };
type LocalClip = { url: string; blob: Blob; duration: number | null; width: number | null; height: number | null };

export function SequenceReview({ cinema, onNotice }: { cinema: CinemaProjectData; onNotice: (message: string, tone?: 'info' | 'success' | 'error') => void }) {
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
  const [capability, setCapability] = useState<Capability | null>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [output, setOutput] = useState<{ url: string; duration: string; signature: string } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const abort = useRef<AbortController | null>(null);
  const signature = `${identity}:${aspect}:${JSON.stringify(trims)}`;
  const currentSignature = useRef(signature);
  useEffect(() => { currentSignature.current = signature; }, [signature]);
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
      return [clip.id, { url, blob: media.blob, duration: null, width: null, height: null }] as const;
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
    let disposed = false;
    void fetch('/api/cinema/assemble').then((response) => response.json() as Promise<Capability>)
      .then((result) => { if (!disposed) setCapability(result); })
      .catch(() => { if (!disposed) setCapability({ available: false, token: null, reason: 'Local renderer is unavailable.' }); });
    return () => { disposed = true; abort.current?.abort(); };
  }, []);
  useEffect(() => () => { if (output) URL.revokeObjectURL(output.url); }, [output]);

  const total = rows.reduce((sum, row) => sum + (trims[row.shot.id] ?? defaultSequenceTrim(row.shot)).durationFrames, 0) / 24;
  const row = rows[active], clip = row?.clip ? local[row.clip.id] : null;
  const trim = row ? trims[row.shot.id] ?? defaultSequenceTrim(row.shot) : null;
  const complete = rows.length > 0 && unplannedScenes.length === 0 && rows.length <= ASSEMBLY_LIMITS.maxClips && total <= ASSEMBLY_LIMITS.maxRuntimeSeconds && !loading
    && rows.every((item) => !item.issue && item.clip && local[item.clip.id]);

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
    if (!complete || rendering) return;
    const startSignature = currentSignature.current;
    const controller = new AbortController(); abort.current = controller;
    setRendering(true); setPlaying(false); video.current?.pause();
    try {
      const manifest = buildSequenceManifest(rows, trims, aspect);
      const fresh = await fetch('/api/cinema/assemble', { signal: controller.signal }).then((response) => response.json() as Promise<Capability>);
      setCapability(fresh);
      if (!fresh.available || !fresh.token) throw new Error(fresh.reason ?? 'Local renderer unavailable.');
      const form = new FormData(); form.set('manifest', JSON.stringify(manifest));
      rows.forEach((item, index) => form.set(`clip-${index}`, local[item.clip!.id].blob, `clip-${index}.mp4`));
      const response = await fetch('/api/cinema/assemble', { method: 'POST', headers: { 'x-cineserye-local-render': fresh.token }, body: form, signal: controller.signal });
      if (!response.ok) { const error = await response.json() as { error?: string }; throw new Error(error.error ?? 'Local rendering failed.'); }
      const result = await response.blob();
      if (result.type !== 'video/mp4' || !result.size) throw new Error('The local renderer did not return an MP4.');
      if (currentSignature.current !== startSignature) throw new Error('The selected sequence changed while rendering. Review the new sequence before exporting.');
      setOutput({ url: URL.createObjectURL(result), duration: response.headers.get('x-cineserye-duration') ?? String(total), signature: startSignature });
      onNotice('Silent MP4 rendered and verified locally. Ready to review and download.', 'success');
    } catch (error) {
      onNotice(controller.signal.aborted ? 'Local render cancelled.' : error instanceof Error ? error.message : 'Local render failed.', controller.signal.aborted ? 'info' : 'error');
    } finally { setRendering(false); if (abort.current === controller) abort.current = null; }
  }

  return <section className="sequence-review nodrag nopan" aria-label="Review sequence">
    <header><strong>Review sequence</strong><span>{rows.length} shots · {total.toFixed(2)}s edit</span></header>
    <p>Approved takes in story order. This local export is silent: source audio is removed. Music, captions and transitions are not included.</p>
    {unplannedScenes.length ? <p role="status">Complete the shot plans first: {unplannedScenes.join(', ')}. Unplanned scenes will not be silently omitted.</p> : null}
    {!rows.length ? <p>Accept a shot plan, then approve video takes to review a sequence.</p> : <>
      <div className="sequence-review-preview">
        {clip && row && trim ? <video key={`${row.clip!.id}:${active}`} ref={video} src={clip.url} controls playsInline muted preload="metadata"
          aria-label={`Sequence preview: ${row.shot.title}`}
          onLoadedMetadata={(event) => {
            const element = event.currentTarget;
            setLocal((current) => ({ ...current, [row.clip!.id]: { ...current[row.clip!.id], duration: element.duration, width: element.videoWidth, height: element.videoHeight } }));
            element.currentTime = Math.min(trim.startFrame / 24, element.duration);
            if (playing) void element.play().catch(() => setPlaying(false));
          }}
          onTimeUpdate={(event) => { if (playing && event.currentTarget.currentTime >= (trim.startFrame + trim.durationFrames) / 24) { event.currentTarget.pause(); advance(); } }}
          onEnded={() => { if (playing) advance(); }} /> : <div>No local approved clip for this shot.</div>}
      </div>
      {clip?.duration !== null && clip?.duration !== undefined ? <small>Decoded clip: {clip.duration.toFixed(2)}s · {clip.width}×{clip.height}. Render validates every clip again.</small> : null}
      <button type="button" className="secondary-button" disabled={!complete || rendering} onClick={() => {
        if (playing) { setPlaying(false); video.current?.pause(); }
        else { setPlaying(true); if (video.current && trim) { video.current.currentTime = trim.startFrame / 24; void video.current.play().catch(() => setPlaying(false)); } }
      }}>{playing ? 'Pause sequence' : 'Play from selected shot'}</button>
      <ol className="sequence-review-list">{rows.map((item, index) => {
        const timing = trims[item.shot.id] ?? defaultSequenceTrim(item.shot);
        const issue = item.issue ?? (!loading && item.clip && !local[item.clip.id] ? 'Clip bytes are missing in this browser. Restore this take before rendering.' : null);
        return <li key={item.shot.id} aria-current={index === active ? 'true' : undefined}>
          <button type="button" disabled={rendering} onClick={() => { setActive(index); setPlaying(false); }}><small>{item.sceneTitle}</small><strong>{index + 1}. {item.shot.title}</strong></button>
          <div><label>Start (s)<input type="number" min="0" max="120" step="0.041667" value={Number((timing.startFrame / 24).toFixed(3))} disabled={rendering} onChange={(event) => patchTrim(item.shot.id, 'startFrame', event.target.valueAsNumber)} /></label>
            <label>Use (s)<input type="number" min="0.041667" max="120" step="0.041667" value={Number((timing.durationFrames / 24).toFixed(3))} disabled={rendering} onChange={(event) => patchTrim(item.shot.id, 'durationFrames', event.target.valueAsNumber)} /></label></div>
          {issue ? <small role="status">{issue}</small> : null}
        </li>;
      })}</ol>
      <label>Output aspect<select value={aspect} disabled={rendering} onChange={(event) => setAspect(event.target.value as '9:16' | '16:9')}><option value="9:16">9:16 portrait</option><option value="16:9">16:9 landscape</option></select></label>
      <p>720p · 24fps · up to {ASSEMBLY_LIMITS.maxClips} shots / {ASSEMBLY_LIMITS.maxRuntimeSeconds}s. Clips must match the output aspect and contain enough real footage for each trim. No stretching or freeze-frame padding.</p>
      {!capability?.available ? <p role="status">{capability?.reason ?? 'Checking local renderer…'}</p> : null}
      <small>Rendering sends selected local clips only to this local Cineserye server, never to an AI provider. Temporary server files are deleted after rendering.</small>
      <div className="sequence-review-actions"><button type="button" className="primary-button" disabled={!complete || !capability?.available || rendering} onClick={() => void render()}>{rendering ? 'Rendering silent MP4…' : 'Render silent MP4 locally'}</button>
        {rendering ? <button type="button" className="secondary-button" onClick={() => abort.current?.abort()}>Cancel render</button> : null}</div>
    </>}
    {output && output.signature === signature ? <div className="sequence-review-result"><strong>Verified silent cut · {output.duration}s</strong><video src={output.url} controls playsInline aria-label="Rendered silent sequence" /><a href={output.url} download="cineserye-sequence.mp4">Download verified MP4</a><small>Download to keep this export. It is not stored in the project backup.</small></div> : null}
  </section>;
}
