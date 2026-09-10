'use client';

import { Check, ChevronDown, Download, ImagePlus, Link2, LoaderCircle, Pin, ShieldCheck, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CinemaProjectData, CinemaShotRecord } from '../../domain/cinema/project-data';
import {
  addCinemaReference,
  approveStoryboardFrame,
  createEmptyVisualPreproductionData,
  isReferenceEligibleForImageGeneration,
  rejectStoryboardFrame,
  removeCinemaReference,
  updateCinemaReference,
  type CinemaReferenceRecord,
  type CinemaReferenceRight,
  type CinemaReferenceType,
  type CinemaReferenceUse,
  type CinemaStoryboardIntent,
  type CinemaVisualPreproductionData,
} from '../../domain/cinema/visual-preproduction';
import { validateImageFile } from '../../editor/image-file';
import { loadLocalMediaBlob, saveLocalMediaBlob } from '../../editor/persistence';
import { storyboardApprovalContent, type GenerateStoryboardRequest, type GenerateStoryboardResponse, type StoryboardPreflight } from './storyboard-api';
import { requestDigest } from '../../domain/cinema/request-digest';
import { VideoPreproductionPanel } from '../video/VideoPreproductionPanel';
import { useScopedConfirmation } from '../../components/useScopedConfirmation';
import { storyImageReferences } from '../../domain/cinema/story-reference-bridge';

type VisualUpdater = (current: CinemaVisualPreproductionData) => CinemaVisualPreproductionData;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the reference image.'));
    reader.readAsDataURL(blob);
  });
}

function base64Blob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function formatBytes(bytes: number | null) {
  if (bytes === null) return 'Link only';
  if (bytes < 1_024 * 1_024) return `${Math.max(1, Math.round(bytes / 1_024))} KB`;
  return `${(bytes / 1_024 / 1_024).toFixed(1)} MB`;
}

export function VisualPreproductionPanel({
  cinema,
  sceneId,
  shot,
  accepted,
  providerMode,
  canvasImages,
  onCleanupMedia,
  onUpdate,
  onNotice,
}: {
  cinema: CinemaProjectData;
  sceneId: string;
  shot: CinemaShotRecord | null;
  accepted: boolean;
  providerMode: 'fixture' | 'live';
  canvasImages: Array<{ nodeId: string; name: string; fileName: string; src: string; width: number; height: number }>;
  onCleanupMedia: () => Promise<void>;
  onUpdate: (updater: VisualUpdater) => void;
  onNotice: (message: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const visual = cinema.visualPreproduction ?? createEmptyVisualPreproductionData();
  const sceneRevisions = Object.values(cinema.revisions).filter((revision) => revision.sceneId === sceneId && revision.status === 'active');
  const revisionId = accepted && sceneRevisions.length === 1 && (!shot || sceneRevisions[0].snapshot.shots[shot.id]) ? sceneRevisions[0].id : null;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | CinemaReferenceType>('all');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [canvasImageId, setCanvasImageId] = useState('');
  const [outputCount, setOutputCount] = useState(3);
  const [intent, setIntent] = useState<CinemaStoryboardIntent>('balanced');
  const [generating, setGenerating] = useState(false);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [frameUrls, setFrameUrls] = useState<Record<string, string>>({});
  const controllerRef = useRef<AbortController | null>(null);
  const [preflight, setPreflight] = useState<StoryboardPreflight | null>(null);
  const [preflightError, setPreflightError] = useState('');
  const [preflightRevision, setPreflightRevision] = useState(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; controllerRef.current?.abort(); };
  }, []);
  useEffect(() => {
    if (providerMode !== 'live') return;
    const controller = new AbortController();
    void fetch('/api/cinema/generate-storyboard', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('Image preflight is unavailable. Reopen this panel to retry.');
      const value = await response.json() as StoryboardPreflight;
      if (!controller.signal.aborted) { setPreflight(value); setPreflightError(''); }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) { setPreflight(null); setPreflightError(error instanceof Error ? error.message : 'Preflight unavailable.'); }
    });
    return () => controller.abort();
  }, [providerMode, preflightRevision]);
  const estimatedCost = providerMode === 'fixture' ? 0 : preflight ? preflight.unitCost * outputCount : null;
  const preflightReady = providerMode === 'fixture' || Boolean(preflight?.ready && preflight.mode === providerMode
    && outputCount <= preflight.maxOutputs && estimatedCost !== null && estimatedCost <= preflight.maxCost);

  const references = useMemo(() => Object.values(visual.references)
    .filter((reference) => reference.sceneId === sceneId)
    .filter((reference) => filter === 'all' || reference.type === filter)
    .filter((reference) => `${reference.title} ${reference.notes} ${reference.provenance}`.toLowerCase().includes(search.toLowerCase()))
    .sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.createdAt.localeCompare(left.createdAt)), [filter, sceneId, search, visual.references]);
  const storyboardPrompt = shot
    ? Object.values(cinema.prompts).find((prompt) => prompt.ownerNodeId === shot.nodeId && prompt.purpose === 'storyboard') ?? null
    : null;
  const shotReferences = shot ? Object.values(visual.references).filter((reference) => reference.shotIds.includes(shot.id)) : [];
  const eligibleReferences = [...shotReferences.filter(isReferenceEligibleForImageGeneration), ...(shot ? storyImageReferences(cinema, shot.id) : [])];
  const referenceScopeReady = eligibleReferences.length <= 8 && eligibleReferences.reduce((sum, item) => sum + (item.byteSize ?? 0), 0) <= 12 * 1024 * 1024;
  const approvalScope = JSON.stringify({
    shotId: shot?.id, shot, revisionId, accepted, providerMode,
    prompt: storyboardPrompt, outputCount, intent, quote: preflight,
    aspectRatio: cinema.scenes[sceneId]?.brief?.aspectRatio,
    references: eligibleReferences.map(({ id, title, blobHash, mimeType, rightsStatus, allowedUses, approvalStatus }) => (
      { id, title, blobHash, mimeType, rightsStatus, allowedUses, approvalStatus }
    )),
  });
  const currentScopeRef = useRef(approvalScope);
  currentScopeRef.current = approvalScope;
  const [confirmed, setConfirmed] = useScopedConfirmation(approvalScope);
  const shotFrames = useMemo(() => shot ? Object.values(visual.storyboardFrames)
    .filter((frame) => frame.shotId === shot.id)
    .sort((left, right) => left.variantIndex - right.variantIndex) : [], [shot, visual.storyboardFrames]);
  const referenceManagerOpen = !shot || referencesOpen;

  const chooseOutputCount = (count: number) => {
    setOutputCount(count);
    setConfirmed(false);
  };

  const chooseIntent = (next: CinemaStoryboardIntent) => {
    setIntent(next);
    setConfirmed(false);
  };

  useEffect(() => {
    let disposed = false;
    const urls: string[] = [];
    void Promise.all(shotFrames.map(async (frame) => {
      const media = await loadLocalMediaBlob(frame.blobHash);
      if (!media) return null;
      const url = URL.createObjectURL(media.blob);
      urls.push(url);
      return [frame.id, url] as const;
    })).then((entries) => {
      if (!disposed) setFrameUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)));
    });
    return () => {
      disposed = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [shotFrames]);

  const uploadReference = async (file: File) => {
    setUploading(true);
    try {
      const validation = await validateImageFile(file);
      const media = await saveLocalMediaBlob(file, {
        mimeType: validation.type,
        width: validation.width,
        height: validation.height,
      });
      const reference: CinemaReferenceRecord = {
        id: `reference-${crypto.randomUUID()}`,
        sceneId,
        title: file.name.replace(/\.[^.]+$/, ''),
        type: 'other',
        origin: 'upload',
        mimeType: validation.type,
        width: validation.width,
        height: validation.height,
        byteSize: file.size,
        blobHash: media.hash,
        sourceUrl: null,
        provenance: `Uploaded locally as ${file.name}`,
        rightsStatus: 'unknown',
        allowedUses: ['research'],
        approvalStatus: 'pending',
        notes: '',
        shotIds: [],
        pinned: false,
        createdAt: new Date().toISOString(),
      };
      onUpdate((current) => addCinemaReference(current, reference));
      onNotice('Reference added to the local deck. Confirm its rights before generation.', 'success');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'The reference could not be added.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const addLink = () => {
    try {
      const url = new URL(linkUrl);
      if (url.protocol !== 'https:') throw new Error('Reference links must use HTTPS.');
      const reference: CinemaReferenceRecord = {
        id: `reference-${crypto.randomUUID()}`,
        sceneId,
        title: linkTitle.trim() || url.hostname,
        type: 'other',
        origin: 'external-link',
        mimeType: null,
        width: null,
        height: null,
        byteSize: null,
        blobHash: null,
        sourceUrl: url.toString(),
        provenance: `Creator-supplied inspiration link: ${url.hostname}`,
        rightsStatus: 'unknown',
        allowedUses: ['research'],
        approvalStatus: 'pending',
        notes: 'Inspiration only. Cineserye does not fetch or send this link to a generation provider.',
        shotIds: [],
        pinned: false,
        createdAt: new Date().toISOString(),
      };
      onUpdate((current) => addCinemaReference(current, reference));
      setLinkTitle('');
      setLinkUrl('');
      onNotice('Inspiration link added without fetching its contents.', 'success');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'The link is invalid.', 'error');
    }
  };

  const addCanvasImage = async () => {
    const source = canvasImages.find((image) => image.nodeId === canvasImageId);
    if (!source) return;
    setUploading(true);
    try {
      const blob = await (await fetch(source.src)).blob();
      const media = await saveLocalMediaBlob(blob, { mimeType: blob.type, width: source.width, height: source.height });
      onUpdate((current) => addCinemaReference(current, {
        id: `reference-${crypto.randomUUID()}`,
        sceneId,
        title: source.name,
        type: 'other',
        origin: 'canvas',
        mimeType: blob.type as CinemaReferenceRecord['mimeType'],
        width: source.width,
        height: source.height,
        byteSize: blob.size,
        blobHash: media.hash,
        sourceUrl: null,
        provenance: `Attached from canvas layer ${source.fileName}`,
        rightsStatus: 'unknown',
        allowedUses: ['research'],
        approvalStatus: 'pending',
        notes: '',
        shotIds: [],
        pinned: false,
        createdAt: new Date().toISOString(),
      }));
      setCanvasImageId('');
      onNotice('Canvas image attached. Confirm its rights before generation.', 'success');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'The canvas image could not be attached.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const setReference = (id: string, patch: Parameters<typeof updateCinemaReference>[2]) => {
    try {
      onUpdate((current) => updateCinemaReference(current, id, patch));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'The reference could not be updated.', 'error');
    }
  };

  const generate = async () => {
    if (!shot || !storyboardPrompt || !revisionId || !confirmed || generating || !preflightReady || !referenceScopeReady) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setGenerating(true);
    const runId = `storyboard-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    onUpdate((current) => ({
      ...current,
      storyboardRuns: {
        ...current.storyboardRuns,
        [runId]: {
          id: runId,
          shotId: shot.id,
          revisionId,
          promptId: storyboardPrompt.id,
          promptVersion: storyboardPrompt.version,
          referenceIds: eligibleReferences.map((reference) => reference.id),
          provider: providerMode === 'live' ? 'google-vertex-ai' : 'cineserye-storyboard-fixture',
          model: providerMode === 'live' ? preflight!.model : 'fixture-cinematic-board-v1',
          aspectRatio: cinema.scenes[shot.sceneId]?.brief?.aspectRatio ?? '9:16',
          outputCount,
          intent,
          estimatedCost,
          currency: 'USD',
          status: 'generating',
          consentedAt: now,
          startedAt: now,
          completedAt: null,
          error: null,
        },
      },
    }));
    try {
      const references = await Promise.all(eligibleReferences.map(async (reference) => {
        const media = reference.blobHash ? await loadLocalMediaBlob(reference.blobHash) : null;
        if (!media || !reference.mimeType) throw new Error(`${reference.title} is missing its local media.`);
        return {
          id: reference.id,
          title: reference.title,
          rightsStatus: reference.rightsStatus as 'creator-owned' | 'licensed' | 'public-domain',
          approvalStatus: 'approved' as const,
          allowedUses: [...reference.allowedUses],
          mimeType: reference.mimeType,
          base64: await blobToBase64(media.blob),
        };
      }));
      if (references.length > 8 || eligibleReferences.reduce((sum, reference) => sum + (reference.byteSize ?? 0), 0) > 12 * 1024 * 1024) throw new Error('Reduce the combined story and scene reference scope before generation (8 images / 12 MB).');
      const payload: GenerateStoryboardRequest = {
        version: 1,
        idempotencyKey: runId,
        shotId: shot.id,
        revisionId,
        acceptedPlan: true,
        prompt: {
          id: storyboardPrompt.id,
          version: storyboardPrompt.version,
          text: storyboardPrompt.generatedText,
          purpose: 'storyboard',
          status: storyboardPrompt.status,
        },
        references,
        settings: {
          aspectRatio: cinema.scenes[shot.sceneId]?.brief?.aspectRatio ?? '9:16',
          outputCount,
          intent,
        },
        explicitConfirmation: true,
        liveProviderConsent: providerMode === 'live',
      };
      if (providerMode === 'live' && preflight) payload.approval = {
        quoteId: preflight.quoteId,
        contentDigest: await requestDigest(storyboardApprovalContent(payload, preflight.quoteId)),
      };
      if (controller.signal.aborted || currentScopeRef.current !== approvalScope) throw new Error('Generation scope changed. Review it again.');
      const response = await fetch('/api/cinema/generate-storyboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const result = await response.json() as GenerateStoryboardResponse;
      if (!result.ok) throw new Error(result.error.message);
      if (controller.signal.aborted || !mountedRef.current || currentScopeRef.current !== approvalScope) throw new Error('The result belongs to a cancelled or changed request and was not applied.');
      const frames = await Promise.all(result.frames.map(async (frame) => {
        const blob = base64Blob(frame.base64, frame.mimeType);
        if (!blob.size) throw new Error('The provider returned an empty storyboard frame.');
        const validated = frame.mimeType === 'image/svg+xml'
          ? { type: frame.mimeType, width: frame.width, height: frame.height }
          : await validateImageFile(new File([blob], `storyboard-${frame.variantIndex + 1}`, { type: frame.mimeType }));
        const media = await saveLocalMediaBlob(blob, { mimeType: validated.type, width: validated.width, height: validated.height });
        return {
          id: frame.id,
          runId,
          shotId: shot.id,
          revisionId,
          promptId: storyboardPrompt.id,
          promptVersion: storyboardPrompt.version,
          referenceIds: eligibleReferences.map((reference) => reference.id),
          promptText: storyboardPrompt.generatedText,
          provider: result.provider,
          model: result.model,
          aspectRatio: payload.settings.aspectRatio,
          seed: frame.seed,
          variantIndex: frame.variantIndex,
          intent,
          blobHash: media.hash,
          mimeType: frame.mimeType,
          width: validated.width,
          height: validated.height,
          byteSize: blob.size,
          safetyStatus: frame.safetyStatus,
          status: 'candidate' as const,
          estimatedCost: result.estimatedCost === null ? null : result.estimatedCost / result.frames.length,
          currency: result.currency,
          createdAt: new Date().toISOString(),
        };
      }));
      if (controller.signal.aborted || !mountedRef.current || currentScopeRef.current !== approvalScope) throw new Error('The result belongs to a cancelled or changed request and was not applied.');
      onUpdate((current) => ({
        ...current,
        storyboardRuns: {
          ...current.storyboardRuns,
          [runId]: {
            ...current.storyboardRuns[runId],
            provider: result.provider,
            model: result.model,
            estimatedCost: result.estimatedCost,
            currency: result.currency,
            status: 'completed',
            completedAt: new Date().toISOString(),
          },
        },
        storyboardFrames: {
          ...current.storyboardFrames,
          ...Object.fromEntries(frames.map((frame) => [frame.id, frame])),
        },
      }));
      setConfirmed(false);
      onNotice(`${frames.length} storyboard ${frames.length === 1 ? 'variant' : 'variants'} generated for review.`, 'success');
    } catch (error) {
      if (!mountedRef.current) return;
      setConfirmed(false);
      const cancelled = controller.signal.aborted;
      onUpdate((current) => ({
        ...current,
        storyboardRuns: {
          ...current.storyboardRuns,
          [runId]: {
            ...current.storyboardRuns[runId],
            status: cancelled ? 'cancelled' : 'failed',
            completedAt: new Date().toISOString(),
            error: cancelled ? (providerMode === 'live' ? 'Cancelled locally; the provider may still finish and charge for dispatched work.' : 'Cancelled by creator.') : error instanceof Error ? error.message : 'Generation failed.',
          },
        },
      }));
      onNotice(cancelled ? (providerMode === 'live' ? 'Cancelled locally. Dispatched provider work may still incur charges; review provider activity before generating again.' : 'Storyboard generation cancelled.') : error instanceof Error ? error.message : 'Storyboard generation failed.', cancelled ? 'info' : 'error');
    } finally {
      controllerRef.current = null;
      setGenerating(false);
    }
  };

  return (
    <div className="visual-preproduction">
      {shot ? <section className="storyboard-workbench" aria-labelledby="storyboard-workbench-title">
        <header>
          <div><span>Storyboard workbench</span><strong id="storyboard-workbench-title">{shot.title}</strong></div>
          <button
            type="button"
            className="storyboard-reference-button"
            aria-expanded={referenceManagerOpen}
            aria-controls="scene-reference-manager"
            onClick={() => setReferencesOpen((current) => !current)}
          >
            {eligibleReferences.length} approved {eligibleReferences.length === 1 ? 'ref' : 'refs'}
          </button>
        </header>
        {!accepted || !revisionId ? <p className="visual-empty">Accept the shot-plan proposal before generating storyboard frames.</p> : !storyboardPrompt ? <p className="visual-empty">This shot has no storyboard prompt.</p> : <>
          <div className="storyboard-prompt-summary"><span>Prompt v{storyboardPrompt.version}</span><p>{storyboardPrompt.generatedText}</p></div>
          {!eligibleReferences.length ? <p className="storyboard-reference-guidance">No approved references. You can generate from the prompt alone, but character and prop consistency may vary. <button type="button" aria-expanded={referenceManagerOpen} aria-controls="scene-reference-manager" onClick={() => setReferencesOpen(true)}>Manage references</button></p> : null}
          {shotReferences.some((reference) => !isReferenceEligibleForImageGeneration(reference)) ? <p className="visual-policy-note">Inspiration-only references are excluded automatically. Approve rights and image use to include them.</p> : null}
          <div className="storyboard-settings">
            <div className="storyboard-variant-picker">
              <span>Variants</span>
              <div role="group" aria-label="Storyboard variants">
                {[1, 2, 3, 4].map((count) => <button key={count} type="button" aria-pressed={outputCount === count} aria-label={`${count} storyboard ${count === 1 ? 'variant' : 'variants'}`} disabled={generating} onClick={() => chooseOutputCount(count)}>{count}</button>)}
              </div>
            </div>
            <div className="storyboard-intent-picker">
              <span>Direction</span>
              <select aria-label="Storyboard creative intent" value={intent} disabled={generating} onChange={(event) => chooseIntent(event.target.value as CinemaStoryboardIntent)}>
                <option value="balanced">Balanced</option>
                <option value="production-safe">Production-safe</option>
                <option value="emotion-first">Emotion-first</option>
                <option value="visually-experimental">Visually experimental</option>
                <option value="budget-conscious">Budget-conscious</option>
              </select>
            </div>
            <div><span>Image model</span><strong>{providerMode === 'live' ? preflight?.model ?? 'Checking…' : 'Offline fixture'}</strong></div>
            <div><span>Estimated USD</span><strong>{estimatedCost === null ? 'Unavailable' : `$${estimatedCost.toFixed(4)}`}</strong></div>
            {providerMode === 'live' ? <button type="button" className="secondary-button" disabled={generating} onClick={() => { setPreflight(null); setConfirmed(false); setPreflightError(''); setPreflightRevision((value) => value + 1); }}>Refresh estimate</button> : null}
          </div>
          <div className="storyboard-generation-footer">
            {eligibleReferences.some((item) => item.id.startsWith('story-ref:')) && <p>Included story references: {eligibleReferences.filter((item) => item.id.startsWith('story-ref:')).map((item) => item.title).join(', ')}. Edit their scope in Story workspace. Notes are not sent to this image endpoint.</p>}
            {!referenceScopeReady && <p role="alert">Reduce combined story and scene references to at most 8 images and 12 MB before generating.</p>}
            {!preflightReady ? <p role="status">{preflightError || preflight?.blockers[0] || 'Checking image scope and spend limits. Reduce outputs if the estimate exceeds the limit.'}</p> : null}
            <label className="storyboard-consent"><input type="checkbox" checked={confirmed} disabled={generating || !preflightReady} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm the {intent.replaceAll('-', ' ')} direction, this prompt, {eligibleReferences.length} approved {eligibleReferences.length === 1 ? 'reference' : 'references'}, and {outputCount} {outputCount === 1 ? 'output' : 'outputs'}.{providerMode === 'live' ? ` Send this content to ${preflight?.model ?? 'the reviewed model'} at an estimated USD $${estimatedCost?.toFixed(4) ?? '—'} (operator ceiling $${preflight?.maxCost ?? '—'}).` : ''}</label>
            <div className="storyboard-actions"><small>{outputCount} {outputCount === 1 ? 'image' : 'images'} · {providerMode === 'live' ? 'Estimate, not a guaranteed provider bill' : '$0.00 fixture'}</small>{generating ? <button type="button" className="secondary-button" onClick={() => controllerRef.current?.abort()}><X size={13} /> Cancel</button> : null}<button type="button" className="primary-button" disabled={!confirmed || generating || !preflightReady || !referenceScopeReady} onClick={() => void generate()}>{generating ? <LoaderCircle className="spin" size={14} /> : <ImagePlus size={14} />} {generating ? 'Generating…' : shotFrames.length ? 'Regenerate variants' : 'Generate storyboard'}</button></div>
          </div>
        </>}
        {shotFrames.length ? <div className="storyboard-grid" aria-label="Storyboard variants">{shotFrames.map((frame) => <article key={frame.id} className={`storyboard-frame frame-${frame.status}`}>
          {/* Local object URLs are intentionally not sent through an image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {frameUrls[frame.id] ? <img src={frameUrls[frame.id]} alt={`Storyboard variant ${frame.variantIndex + 1} for ${shot.title}`} /> : <div className="storyboard-frame-loading"><LoaderCircle className="spin" /></div>}
          <div><strong>Variant {frame.variantIndex + 1}</strong><small>{frame.intent.replaceAll('-', ' ')} · {frame.status} · {frame.model}</small></div>
          {frame.referenceIds.some((id) => id.startsWith('story-ref:') && !eligibleReferences.some((reference) => reference.id === id)) && <p role="status">Story references changed or are no longer approved for this shot. This existing output is preserved; review before reusing it.</p>}
          <footer><button type="button" className="secondary-button" disabled={frame.status === 'approved'} onClick={() => onUpdate((current) => approveStoryboardFrame(current, frame.id))}><Check size={12} /> {frame.status === 'approved' ? 'Approved anchor' : 'Approve'}</button><button type="button" className="icon-button" aria-label={`Reject storyboard variant ${frame.variantIndex + 1}`} onClick={() => onUpdate((current) => rejectStoryboardFrame(current, frame.id))}><X size={13} /></button>{frameUrls[frame.id] && <a className="icon-button" href={frameUrls[frame.id]} download={`${shot.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-variant-${frame.variantIndex + 1}.${frame.mimeType === 'image/svg+xml' ? 'svg' : frame.mimeType.split('/')[1]}`} aria-label={`Download storyboard variant ${frame.variantIndex + 1}`}><Download size={13} /></a>}</footer>
        </article>)}</div> : null}
        {accepted ? <VideoPreproductionPanel
          cinema={{ ...cinema, visualPreproduction: visual }}
          shot={shot}
          providerMode={providerMode}
          onUpdate={onUpdate}
          onNotice={onNotice}
        /> : null}
      </section> : null}

      <section className={`reference-deck ${referenceManagerOpen ? 'reference-deck-open' : ''}`} aria-labelledby="reference-deck-title">
        <header>
          <div><span>Reference deck</span><strong id="reference-deck-title">Scene visual continuity</strong></div>
          {shot ? <button type="button" className="reference-deck-toggle" aria-expanded={referenceManagerOpen} aria-controls="scene-reference-manager" onClick={() => setReferencesOpen((current) => !current)}>
            <span>{references.length} {references.length === 1 ? 'reference' : 'references'}</span><ChevronDown size={14} aria-hidden="true" />
          </button> : <small>{references.length} {references.length === 1 ? 'reference' : 'references'}</small>}
        </header>
        {referenceManagerOpen ? <div id="scene-reference-manager" className="reference-manager">
          <details className="reference-policy"><summary><ShieldCheck size={13} /> Local uploads require rights approval</summary><p>Uploads stay on this device. Nothing is generation-approved until you confirm rights, permitted use, and approval.</p></details>
          <div className="reference-tools">
            <input aria-label="Search reference deck" placeholder="Search references" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select aria-label="Filter reference type" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
              <option value="all">All types</option><option value="character">Character</option><option value="location">Location</option><option value="prop">Prop</option><option value="wardrobe">Wardrobe</option><option value="style">Style</option><option value="composition">Composition</option><option value="other">Other</option>
            </select>
          </div>
          <label className="reference-upload secondary-button">
            {uploading ? <LoaderCircle className="spin" size={14} /> : <ImagePlus size={14} />} Upload reference
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadReference(file);
              event.target.value = '';
            }} />
          </label>
          {canvasImages.length ? <div className="canvas-reference-row">
            <select aria-label="Canvas image to attach" value={canvasImageId} onChange={(event) => setCanvasImageId(event.target.value)}>
              <option value="">Choose a canvas image…</option>
              {canvasImages.map((image) => <option key={image.nodeId} value={image.nodeId}>{image.name}</option>)}
            </select>
            <button type="button" className="secondary-button" disabled={!canvasImageId || uploading} onClick={() => void addCanvasImage()}>Attach canvas image</button>
          </div> : null}
          <div className="reference-link-row">
            <input aria-label="Reference link title" placeholder="Link title" value={linkTitle} onChange={(event) => setLinkTitle(event.target.value)} />
            <input aria-label="HTTPS inspiration link" placeholder="https://…" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} />
            <button type="button" className="secondary-button" onClick={addLink} disabled={!linkUrl.trim()}><Link2 size={13} /> Add link</button>
          </div>
          {references.length ? <div className="reference-list">{references.map((reference) => {
            const eligible = isReferenceEligibleForImageGeneration(reference);
            const attached = Boolean(shot?.id && reference.shotIds.includes(shot.id));
            return <article key={reference.id} className={`reference-card ${eligible ? 'reference-eligible' : ''}`}>
              <header><div><span>{reference.type} · {reference.origin.replace('-', ' ')}</span><strong>{reference.title}</strong></div><button type="button" className="icon-button" aria-label={`${reference.pinned ? 'Unpin' : 'Pin'} ${reference.title}`} onClick={() => setReference(reference.id, { pinned: !reference.pinned })}><Pin size={13} fill={reference.pinned ? 'currentColor' : 'none'} /></button></header>
              <small>{formatBytes(reference.byteSize)} · {reference.approvalStatus} · {eligible ? 'Image generation ready' : 'Inspiration only'} · Attached to {reference.shotIds.length} {reference.shotIds.length === 1 ? 'shot' : 'shots'}</small>
              <div className="reference-fields">
                <label><span>Type</span><select value={reference.type} onChange={(event) => setReference(reference.id, { type: event.target.value as CinemaReferenceType })}><option value="character">Character</option><option value="location">Location</option><option value="prop">Prop</option><option value="wardrobe">Wardrobe</option><option value="style">Style</option><option value="composition">Composition</option><option value="other">Other</option></select></label>
                <label><span>Rights</span><select value={reference.rightsStatus} onChange={(event) => setReference(reference.id, { rightsStatus: event.target.value as CinemaReferenceRight, approvalStatus: 'pending' })}><option value="unknown">Unknown</option><option value="creator-owned">Creator owned</option><option value="licensed">Licensed</option><option value="public-domain">Public domain</option></select></label>
              </div>
              <label className="reference-check"><input type="checkbox" checked={reference.allowedUses.includes('image-generation')} disabled={!reference.blobHash || reference.rightsStatus === 'unknown'} onChange={(event) => setReference(reference.id, { allowedUses: (event.target.checked ? [...new Set([...reference.allowedUses, 'image-generation' as CinemaReferenceUse])] : reference.allowedUses.filter((use) => use !== 'image-generation')), approvalStatus: 'pending' })} /> Allow for image generation</label>
              <div className="reference-actions">
                <button type="button" className="secondary-button" disabled={reference.rightsStatus === 'unknown' || !reference.allowedUses.includes('image-generation')} onClick={() => setReference(reference.id, { approvalStatus: reference.approvalStatus === 'approved' ? 'revoked' : 'approved' })}>{reference.approvalStatus === 'approved' ? <><X size={12} /> Revoke</> : <><Check size={12} /> Approve</>}</button>
                {shot ? <button type="button" className="secondary-button" onClick={() => setReference(reference.id, { shotIds: attached ? reference.shotIds.filter((id) => id !== shot.id) : [...reference.shotIds, shot.id] })}>{attached ? 'Detach from shot' : 'Attach to shot'}</button> : null}
                <button type="button" className="icon-button" aria-label={`Delete ${reference.title}`} onClick={() => { try { onUpdate((current) => removeCinemaReference(current, reference.id)); } catch (error) { onNotice(error instanceof Error ? error.message : 'The reference could not be deleted.', 'error'); } }}><Trash2 size={13} /></button>
              </div>
            </article>;
          })}</div> : <p className="visual-empty reference-empty">Upload an owned image or save an inspiration link. External links remain research-only.</p>}
          <button type="button" className="reference-cleanup" onClick={() => void onCleanupMedia()}>Clean unused local media</button>
        </div> : null}
      </section>
    </div>
  );
}
