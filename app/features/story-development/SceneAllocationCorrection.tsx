'use client';
import { useState } from 'react';
import { setStorySceneAllocation, storyPremise, storySceneAllocation } from '../../editor/story-development-commands';
import type { EditorDocument } from '../../editor/types';

/** An explicit local correction, not an inferred duration or generation consent. */
export function SceneAllocationCorrection({ document, getDocument, commit, flush, sceneIds, min = 1, max = 86_400 }: {
  document: EditorDocument; getDocument: () => EditorDocument; commit: (document: EditorDocument, history?: boolean) => void;
  flush: () => Promise<unknown>; sceneIds: string[]; min?: number; max?: number;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = (source: EditorDocument, id: string) => source.nodes.some((node) =>
    (node.id === source.cinema?.scenes[id]?.nodeId || node.id === storyPremise(source)?.nodeId) && node.data.locked);
  const save = async (id: string) => {
    setError(''); setBusy(true);
    try {
      const source = getDocument(), duration = Number(drafts[id]);
      if (source.cinema?.projectId !== document.cinema?.projectId || locked(source, id)) throw Error('Unlock this scene and Story before changing duration.');
      if (!Number.isInteger(duration) || duration < min || duration > max) throw Error(`Enter ${min}–${max} whole seconds.`);
      commit(setStorySceneAllocation(source, id, duration), true); await flush();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  return <section aria-label="Resolve scene durations" className="assistant-inline-edit">
    <h4>How long are the existing scenes?</h4>
    <p>Set the missing allocation here. This saves locally and requires updated direction review; it does not generate or stretch any shots.</p>
    {sceneIds.map((id) => { const scene = document.cinema?.scenes[id]; if (!scene) return null;
      const current = storySceneAllocation(document, id);
      return <div key={id}><label>{scene.title} · seconds<input type="number" min={min} max={max} step={1} value={drafts[id] ?? current ?? ''} disabled={busy || locked(document, id)} onChange={(event) => setDrafts((values) => ({ ...values, [id]: event.target.value }))} /></label>
        <button disabled={busy || locked(document, id) || !drafts[id]} onClick={() => void save(id)}>Save duration for {scene.title}</button></div>;
    })}
    {error && <p role="alert">{error}</p>}
  </section>;
}
