'use client';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, FileText, Info, Lock, Plus, X } from 'lucide-react';
import type { EditorDocument } from '../../editor/types';
import { editPremiseDraft, initialPremiseDraft, type PremiseDraft } from '../../editor/premise-draft';
import { editLayerText, layerEditTarget } from '../../editor/layer-editing';
import { resolveStoryReferences } from '../../domain/cinema/story-workflow';
import { storyPremise } from '../../editor/story-development-commands';
import { StoryDevelopmentPanel, StoryReferencePreview } from './StoryDevelopmentPanel';
import { InlineDiscardButton } from '../../editor/InlineDiscardButton';

export function PremiseLayerEditor({ document, nodeId, getDocument, commit, flush, onClose, onDiscard, saveState, error, onDevelop }: {
  document: EditorDocument; nodeId: string; getDocument: () => EditorDocument;
  commit: (next: EditorDocument, history?: boolean) => void; flush: () => Promise<unknown>;
  onClose: () => void; onDiscard: () => void;
  saveState: 'saved' | 'saving' | 'error'; error: string;
  onDevelop?: () => void;
}) {
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [localError, setLocalError] = useState('');
  const target = layerEditTarget(document, nodeId);
  if (!target) return null;
  const canonical = storyPremise(document)?.nodeId === nodeId;
  const readOnly = target.readOnly || !canonical;
  const draft = document.cinema?.storyWorkflow?.draft ?? initialPremiseDraft(document);
  const references = canonical && document.cinema ? resolveStoryReferences(document.cinema, { kind: 'story', id: document.cinema.projectId })
    .filter((item) => !item.current.archived) : [];
  const edit = (change: (source: EditorDocument) => EditorDocument) => {
    try { commit(change(getDocument())); setLocalError(''); } catch (error) { setLocalError((error as Error).message); }
  };
  const update = (patch: Partial<PremiseDraft>) => edit((source) => editPremiseDraft(source, nodeId, patch));
  return <div className="premise-editor">
    <header className="premise-editor-header layer-drag-handle" title="Drag to move this layer">
      <span><BookOpen size={17} aria-hidden="true" /> STORY PREMISE</span>
      <span className="premise-draft-badge">{readOnly ? 'Read only' : 'Draft'}</span>
      <button className="nodrag" type="button" aria-label="Close layer editor" onClick={onClose}><X size={18} /></button>
    </header>
    <div className="premise-editor-body nodrag nopan nowheel">
    {reviewOpen && !readOnly && document.cinema ? <section aria-label="Develop this story">
      <button className="premise-back" type="button" onClick={() => setReviewOpen(false)}><ArrowLeft size={15} /> Back to premise</button>
      <button type="button" onClick={onClose} aria-label="Close story development">Done reviewing</button>
      <StoryDevelopmentPanel embedded open document={document} getDocument={getDocument} commit={commit} flush={flush}
        onClose={() => setReviewOpen(false)} owner={{ kind: 'story', id: document.cinema.projectId }} />
    </section> : referencesOpen && !readOnly && document.cinema ? <>
      <button className="premise-back" type="button" onClick={() => setReferencesOpen(false)}><ArrowLeft size={15} /> Back to premise</button>
      <h2 className="premise-subtitle">Story references</h2>
      <StoryDevelopmentPanel embedded referencesOnly open document={document} getDocument={getDocument} commit={commit} flush={flush}
        onClose={() => setReferencesOpen(false)} owner={{ kind: 'story', id: document.cinema.projectId }} />
    </> : <>
      <input className="premise-title-input" aria-label="Layer title" value={target.title} maxLength={500} disabled={readOnly}
        onChange={(event) => edit((source) => editLayerText(source, nodeId, { title: event.target.value }))} />
      {readOnly && <p className="premise-help"><Lock size={14} /> {canonical ? 'Unlock this layer in the outline to edit it.' : 'Open the original premise to use this project’s story workflow.'}</p>}
      <div className="premise-goals" role="group" aria-label="Story goal">
        {([['surprise', 'Surprise me'], ['expand', 'Expand my idea'], ['continue', 'Continue my story']] as const).map(([mode, label]) =>
          <button key={mode} type="button" aria-pressed={draft.mode === mode} disabled={readOnly} onClick={() => update({ mode })}>{label}</button>)}
      </div>
      <label className="premise-text-label">Premise<textarea aria-label="Premise for development" value={target.body} disabled={readOnly} maxLength={20_000}
        placeholder="Describe your story, or choose Surprise me…" onChange={(event) => update({ premise: event.target.value })} /></label>
      {canonical && document.cinema?.storyWorkflow?.draft && draft.premise !== target.body && <div className="premise-conflict" role="status">
        A saved development draft differs from this canvas text. Choose which to use; nothing was overwritten on open.
        <button type="button" disabled={readOnly} onClick={() => update({ premise: target.body })}>Use canvas premise</button>
        <button type="button" disabled={readOnly} onClick={() => update({ premise: draft.premise })}>Use development draft</button>
      </div>}
      {draft.mode === 'continue' && canonical && <label className="premise-text-label">Continue after<select value={draft.anchorSceneId ?? ''} disabled={readOnly}
        onChange={(event) => update({ anchorSceneId: event.target.value || null })}><option value="">Choose a scene</option>
        {document.cinema?.sceneOrder.map((id) => <option key={id} value={id}>{document.cinema!.scenes[id].title}</option>)}
      </select></label>}
      <section className="premise-references" aria-label="Story references">
        <button type="button" className="premise-section-label" disabled={readOnly} onClick={() => setReferencesOpen(true)}>References · {references.length}<ChevronDown size={14} /></button>
        <div className="premise-reference-strip">
          {references.map((item) => <button type="button" key={item.referenceId} className="premise-reference-tile" disabled={readOnly} onClick={() => setReferencesOpen(true)}
            aria-label={`Review reference: ${item.current.title}`} title={`${item.current.title} · ${item.current.approval}`}>
            {item.current.content.kind === 'image' ? <StoryReferencePreview hash={item.current.content.blobHash} title={item.current.title} /> : <><FileText size={22} /><span>{item.current.title}</span></>}
          </button>)}
          <button type="button" className="premise-reference-add" aria-label="Add story reference" disabled={readOnly} onClick={() => setReferencesOpen(true)}><Plus size={24} /><span>Add</span></button>
        </div>
      </section>
      <button type="button" className="premise-details-toggle" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(!detailsOpen)}>
        {draft.aspectRatio && <span>{draft.aspectRatio}</span>}{draft.durationSeconds && <span>{draft.durationSeconds}s</span>}{draft.tone && <span>{draft.tone}</span>}
        <span>{detailsOpen ? 'Hide details' : 'Optional details'}</span><ChevronDown size={14} />
      </button>
      {detailsOpen && <fieldset className="premise-optional" disabled={readOnly}><legend>Optional direction</legend>
        <label>Format<select value={draft.aspectRatio ?? ''} onChange={(event) => update({ aspectRatio: event.target.value as PremiseDraft['aspectRatio'] || null })}><option value="">Not set</option>{['9:16', '16:9', '1:1', '4:5'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>{draft.mode === 'continue' ? 'New material duration (seconds)' : 'Target duration (seconds)'}<input type="number" min="1" max="86400" value={draft.durationSeconds ?? ''}
          onChange={(event) => { if (!event.target.value || event.target.validity.valid) update({ durationSeconds: event.target.value ? Number(event.target.value) : null }); }} /></label>
        <label>Tone<input value={draft.tone} maxLength={500} onChange={(event) => update({ tone: event.target.value })} /></label>
        <InlineDiscardButton onConfirm={onDiscard} />
      </fieldset>}
      <p className="premise-help"><Info size={14} /> You can refine the direction later.</p>
    </>}
    {(localError || error) && <p role="alert" className="premise-error">{localError || error}</p>}
    </div>
    <footer className="premise-footer nodrag nopan nowheel">
      <p role="status" className={`premise-save premise-save-${saveState}`}><Check size={15} aria-hidden="true" />{saveState === 'saved' ? 'Saved on this device' : saveState === 'saving' ? 'Saving locally…' : 'Not saved — keep this tab open and retry a backup.'}</p>
      <div className="premise-footer-actions"><button type="button" onClick={onClose}>Done</button>
        {!referencesOpen && !reviewOpen && <button type="button" className="premise-develop" disabled={readOnly} onClick={() => onDevelop ? onDevelop() : setReviewOpen(true)}>Develop story <ArrowRight size={17} /></button>}
      </div>
      {!referencesOpen && !reviewOpen && <small>Done collapses this node. Develop story opens a connected assistant.</small>}
    </footer>
  </div>;
}
