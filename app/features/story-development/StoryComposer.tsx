'use client';
import { useId, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Check, Clock3, GripVertical, ImagePlus, LoaderCircle, RectangleHorizontal, Sparkles, Tags, X } from 'lucide-react';
import type { ComponentProps } from 'react';
import type { PremiseLayerEditor } from './PremiseLayerEditor';
import { editPremiseDraft, initialPremiseDraft, type PremiseDraft } from '../../editor/premise-draft';
import { editLayerText, layerEditTarget } from '../../editor/layer-editing';
import { changeStory, storyPremise } from '../../editor/story-development-commands';
import { validateImageFile } from '../../editor/image-file';
import { saveLocalMediaBlob } from '../../editor/persistence';
import { StoryDevelopmentPanel, StoryReferencePreview } from './StoryDevelopmentPanel';
import { STORY_GENRES, storyImageAliases } from './prompt-composer-model';
import { StoryReferencePermissions } from './StoryReferencePermissions';
import { InlineDiscardButton } from '../../editor/InlineDiscardButton';

export function StoryComposer({ document, nodeId, getDocument, commit, flush, onClose, onDiscard, saveState, error, onDevelop }: ComponentProps<typeof PremiseLayerEditor>) {
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [genresOpen, setGenresOpen] = useState(false);
  const [localError, setLocalError] = useState('');
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const prompt = useRef<HTMLTextAreaElement>(null);
  const durationHintId = useId();
  const target = layerEditTarget(document, nodeId);
  if (!target) return null;
  const readOnly = target.readOnly || storyPremise(document)?.nodeId !== nodeId;
  const draft = document.cinema?.storyWorkflow?.draft ?? initialPremiseDraft(document);
  const aliases = storyImageAliases(document.cinema?.storyWorkflow).filter((item) => !item.current.archived);
  const update = (patch: Partial<PremiseDraft>) => {
    try { commit(editPremiseDraft(getDocument(), nodeId, patch)); setLocalError(''); } catch (error) { setLocalError((error as Error).message); }
  };
  const insert = (alias: string) => {
    const element = prompt.current, start = element?.selectionStart ?? target.body.length, end = element?.selectionEnd ?? start;
    update({ premise: target.body.slice(0, start) + alias + ' ' + target.body.slice(end) });
    requestAnimationFrame(() => { element?.focus({ preventScroll: true }); element?.setSelectionRange(start + alias.length + 1, start + alias.length + 1); });
  };
  const upload = async (file: File) => {
    const projectId = getDocument().cinema?.projectId;
    setUploading(true);
    try {
      const validation = await validateImageFile(file);
      const media = await saveLocalMediaBlob(file, { mimeType: validation.type, width: validation.width, height: validation.height });
      const source = getDocument();
      if (!projectId || source.cinema?.projectId !== projectId || layerEditTarget(source, nodeId)?.readOnly) throw Error('The project changed. Reopen the Story layer.');
      const id = crypto.randomUUID();
      commit(changeStory(source, (data) => {
        data.references.push({ id, versions: [{ version: 1, title: file.name, category: 'style',
          content: { kind: 'image', blobHash: media.hash, mimeType: validation.type, width: validation.width, height: validation.height, byteSize: file.size },
          provenance: 'Uploaded locally by the creator', rights: 'unknown', approval: 'pending', allowedUses: [], archived: false }] });
        let binding = data.bindings.find((item) => item.owner.kind === 'story' && item.owner.id === projectId);
        if (!binding) { binding = { owner: { kind: 'story', id: projectId }, rules: [] }; data.bindings.push(binding); }
        binding.rules.push({ action: 'add', referenceId: id });
      }));
      await flush(); setLocalError('');
    } catch (error) { setLocalError((error as Error).message); }
    finally { setUploading(false); }
  };
  return <div className="premise-editor prompt-first-editor">
    <header className="premise-editor-header layer-drag-handle" title="Drag to move this layer">
      <GripVertical size={16} aria-hidden="true" /><span><BookOpen size={16} aria-hidden="true" /> STORY PREMISE</span>
      <span className="premise-draft-badge">{readOnly ? 'Read only' : 'Draft'}</span>
      <button className="nodrag" type="button" aria-label="Close layer editor" onClick={onClose}><X size={18} /></button>
    </header>
    <div className="premise-editor-body nodrag nopan nowheel">
      {referencesOpen && document.cinema ? <>
        <button className="premise-back" type="button" onClick={() => setReferencesOpen(false)}><ArrowLeft size={15} /> Back to premise</button>
        <StoryReferencePermissions document={document} getDocument={getDocument} commit={commit} flush={flush} readOnly={readOnly} />
        <details><summary>Advanced library: notes, scope and archive</summary><fieldset disabled={readOnly}>
          <StoryDevelopmentPanel embedded referencesOnly open document={document} getDocument={getDocument} commit={commit} flush={flush}
            onClose={() => setReferencesOpen(false)} owner={{ kind: 'story', id: document.cinema.projectId }} />
        </fieldset></details>
      </> : <>
        <input className="premise-title-input" aria-label="Layer title" value={target.title} maxLength={500} disabled={readOnly}
          onChange={(event) => { try { commit(editLayerText(getDocument(), nodeId, { title: event.target.value })); } catch (error) { setLocalError((error as Error).message); } }} />
        <div className="premise-goals" role="group" aria-label="Story goal">
          {([['surprise', 'Surprise me'], ['expand', 'Expand my idea'], ['continue', 'Continue my story']] as const).map(([mode, label]) =>
            <button key={mode} type="button" aria-pressed={draft.mode === mode} disabled={readOnly} onClick={() => update({ mode })}>{label}</button>)}
        </div>
        <label className="premise-text-label">Your idea<textarea ref={prompt} aria-label="Premise for development" value={target.body} disabled={readOnly} maxLength={20_000}
          placeholder="Describe your story. Include timing, style or ending if you know them. Use @image1 to mention an attachment."
          onChange={(event) => update({ premise: event.target.value })} /></label>
        {draft.mode === 'continue' && <label className="premise-text-label">Continue after<select value={draft.anchorSceneId ?? ''} disabled={readOnly}
          onChange={(event) => update({ anchorSceneId: event.target.value || null })}><option value="">Choose an existing scene</option>
          {document.cinema?.sceneOrder.map((id) => <option key={id} value={id}>{document.cinema!.scenes[id].title}</option>)}
        </select></label>}
        <div className="composer-controls">
          <input ref={input} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file); }} />
          <button type="button" className="composer-reference-control" aria-label="Add story reference image" title={uploading ? 'Adding reference image…' : 'Add reference image'} disabled={readOnly || uploading} onClick={() => input.current?.click()}>
            {uploading ? <LoaderCircle size={18} aria-hidden="true" /> : <ImagePlus size={18} aria-hidden="true" />}
            {aliases.length > 0 && <span aria-hidden="true">{aliases.length}</span>}
          </button>
          <label title={draft.mode === 'continue' ? 'New material duration in seconds' : 'Whole-video runtime in seconds'}>
            <span id={durationHintId} className="visually-hidden">{draft.mode === 'continue' ? 'Duration of new material only, in seconds.' : 'Duration of the whole video, not each scene, in seconds.'}</span>
            <Clock3 size={17} aria-hidden="true" /><input aria-label="Total runtime in seconds" aria-describedby={durationHintId} type="number" min="1" max="86400" placeholder="Auto" disabled={readOnly} value={draft.durationSeconds ?? ''}
            onChange={(event) => { if (!event.target.value || event.target.validity.valid) update({ durationSeconds: event.target.value ? Number(event.target.value) : null }); }} /><span aria-hidden="true">s</span></label>
          <label title="Aspect ratio"><RectangleHorizontal size={17} aria-hidden="true" /><select aria-label="Story aspect ratio" disabled={readOnly} value={draft.aspectRatio ?? ''} onChange={(event) => update({ aspectRatio: event.target.value as PremiseDraft['aspectRatio'] || null })}>
            <option value="">Auto</option>{['9:16', '16:9', '1:1', '4:5'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <button type="button" aria-label={`Genres · ${draft.genres?.length ? draft.genres.join(' + ') : 'Auto'}`} title={draft.genres?.length ? `Genres: ${draft.genres.join(' + ')}` : 'Genres — choose multiple'} disabled={readOnly} aria-expanded={genresOpen} onClick={() => setGenresOpen(!genresOpen)}>
            <Tags size={17} aria-hidden="true" /><span>{draft.genres?.length ? `${draft.genres.length} selected` : 'Auto'}</span>
          </button>
        </div>
        {genresOpen && <div className="composer-genres" role="group" aria-label="Genres — choose multiple">
          {STORY_GENRES.map((genre) => <button key={genre} type="button" disabled={readOnly} aria-pressed={draft.genres?.includes(genre) ?? false} onClick={() => {
            const current = draft.genres ?? []; update({ genres: current.includes(genre) ? current.filter((value) => value !== genre) : [...current, genre] });
          }}>{genre}</button>)}<small>Optional. Combine genres; your idea still leads.</small>
        </div>}
        {aliases.length > 0 && <section className="composer-references" aria-label="Story references">
          <div className="premise-reference-strip">{aliases.map((item) => <div key={item.referenceId} className="composer-reference">
            {item.current.content.kind === 'image' && <StoryReferencePreview hash={item.current.content.blobHash} title={item.title} />}
            <button type="button" disabled={readOnly} onClick={() => insert(item.alias)} aria-label={`Mention ${item.alias}`}>{item.alias}</button>
          </div>)}</div>
          <button type="button" disabled={readOnly} onClick={() => setReferencesOpen(true)}>Review reference permissions · {aliases.length}</button>
          <small>Local only until you approve their use.</small>
        </section>}
        <details className="premise-tools"><summary>Story tools</summary>
          <button type="button" disabled={readOnly} onClick={() => setReferencesOpen(true)}>Reference library</button>
          <InlineDiscardButton onConfirm={onDiscard} disabled={readOnly} />
        </details>
        <p className="premise-help">Only your idea is needed. The Assistant will confirm missing details.</p>
      </>}
      {(localError || error) && <p role="alert" className="premise-error">{localError || error}</p>}
    </div>
    <footer className="premise-footer nodrag nopan nowheel">
      <p role="status" className={`premise-save premise-save-${saveState}`}><Check size={15} />{saveState === 'saved' ? 'Saved on this device' : saveState === 'saving' ? 'Saving locally…' : 'Not saved — keep this tab open.'}</p>
      <div className="premise-footer-actions"><button type="button" onClick={onClose}>Done</button>
        {!referencesOpen && <button type="button" className="premise-develop" disabled={readOnly || uploading || draft.mode !== 'surprise' && !target.body.trim()} onClick={onDevelop}><Sparkles size={17} aria-hidden="true" /> Generate</button>}
      </div>
      {!referencesOpen && <small>Assistant first. No images or video generated yet. Live analysis requires approval.</small>}
    </footer>
  </div>;
}
