'use client';
import type { EditorDocument } from './types';
import { layerEditTarget } from './layer-editing';
import type { CinemaShotPatch } from './cinema-domain-commands';

export function LayerEditorFields({ document, nodeId, onText, onShot }: {
  document: EditorDocument; nodeId: string; onText: (patch: { title?: string; body?: string }) => void;
  onShot: (patch: CinemaShotPatch) => void;
}) {
  const target = layerEditTarget(document, nodeId);
  if (!target) return null;
  return <fieldset disabled={target.readOnly} className="layer-editor-fields">
    <legend>{target.role === 'story' ? 'Premise' : target.role === 'scene' ? 'Scene draft' : 'Shot draft'}</legend>
    {target.readOnly && <p>Locked layer — select Unlock in the outline before editing.</p>}
    {target.node.data.locked && !target.readOnly && <p>Generated host: layout stays locked. Structured edits preserve revision history.</p>}
    <label>Layer title<input value={target.title} maxLength={500} onChange={(event) => onText({ title: event.target.value })} /></label>
    {target.role !== 'story' && <label>Layer description<textarea value={target.body} maxLength={20_000} onChange={(event) => onText({ body: event.target.value })} /></label>}
    {target.shot && <>
      <label>Shot duration (seconds)<input type="number" min="1" max="600" value={target.shot.durationSeconds} onChange={(event) => { if (event.target.value && event.target.validity.valid) onShot({ durationSeconds: Number(event.target.value) }); }} /></label>
      <label>Framing<input value={target.shot.framing} maxLength={500} onChange={(event) => onShot({ framing: event.target.value })} /></label>
      <label>Camera movement<input value={target.shot.cameraMovement} maxLength={500} onChange={(event) => onShot({ cameraMovement: event.target.value })} /></label>
      <label>Purpose<textarea value={target.shot.purpose} maxLength={20_000} onChange={(event) => onShot({ purpose: event.target.value })} /></label>
      <label>Lens (mm)<input type="number" min="1" max="300" value={target.shot.lensMm ?? ''} onChange={(event) => { if (!event.target.value || event.target.validity.valid) onShot({ lensMm: event.target.value ? Number(event.target.value) : null }); }} /></label>
      <label>Generation risk<select value={target.shot.risk} onChange={(event) => onShot({ risk: event.target.value as 'low' | 'medium' | 'high' })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      <label>Audio direction<input value={target.shot.audio} onChange={(event) => onShot({ audio: event.target.value })} /></label>
    </>}
  </fieldset>;
}
