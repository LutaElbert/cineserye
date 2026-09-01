'use client';

import { Clapperboard, FolderOpen, Plus, RotateCcw, Sparkles, Undo2 } from 'lucide-react';

export function EmptyCanvasRecovery({
  canUndo,
  hasRecovery,
  onUndo,
  onRecover,
  onStartScene,
  onAdd,
  onRestore,
  onExploreSample,
}: {
  canUndo: boolean;
  hasRecovery: boolean;
  onUndo: () => void;
  onRecover: () => void;
  onStartScene: () => void;
  onAdd: () => void;
  onRestore: () => void;
  onExploreSample: () => void;
}) {
  return (
    <section className="empty-canvas-recovery" aria-labelledby="empty-canvas-title">
      <span className="empty-canvas-icon" aria-hidden="true"><Clapperboard size={22} /></span>
      <div>
        <span className="eyebrow">Empty canvas</span>
        <h2 id="empty-canvas-title">Your project is still yours.</h2>
        <p>Recover the last non-empty canvas or begin with a filmmaking structure. Cineserye will never insert sample data automatically.</p>
      </div>
      <div className="empty-canvas-primary-actions">
        {canUndo ? <button type="button" className="primary-button" onClick={onUndo}><Undo2 size={14} /> Undo delete</button> : null}
        {!canUndo && hasRecovery ? <button type="button" className="primary-button" onClick={onRecover}><RotateCcw size={14} /> Recover last canvas</button> : null}
        <button type="button" className="secondary-button" onClick={onStartScene}><Clapperboard size={14} /> Start with a scene</button>
      </div>
      <div className="empty-canvas-secondary-actions">
        <button type="button" onClick={onAdd}><Plus size={13} /> Add a layer</button>
        <button type="button" onClick={onRestore}><FolderOpen size={13} /> Restore backup</button>
        <button type="button" onClick={onExploreSample}><Sparkles size={13} /> Explore sample</button>
      </div>
    </section>
  );
}
