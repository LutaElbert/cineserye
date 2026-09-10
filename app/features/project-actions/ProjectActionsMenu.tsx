'use client';

import { Download, HardDrive, MoreHorizontal, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function ProjectActionsMenu({
  providerMode,
  onBackup,
  onNew,
  onExport,
}: {
  providerMode: 'loading' | 'fixture' | 'live';
  onBackup: () => void;
  onNew: () => void;
  onExport: () => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="mobile-project-actions">
      <button
        ref={buttonRef}
        type="button"
        className="icon-button mobile-project-actions-button"
        aria-label="Open project actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal size={17} />
      </button>
      {open ? (
        <div ref={menuRef} className="mobile-project-actions-menu" role="menu" aria-label="Project actions">
          <div className="mobile-provider-row" role="status">
            <span>Provider</span>
            <strong>{providerMode === 'live' ? 'Live mode' : providerMode === 'fixture' ? 'Fixture mode' : 'Checking…'}</strong>
          </div>
          <button type="button" role="menuitem" onClick={() => run(onBackup)}><HardDrive size={14} /> Backup or restore</button>
          <button type="button" role="menuitem" onClick={() => run(onExport)}><Download size={14} /> Export SVG</button>
          <button type="button" role="menuitem" onClick={() => run(onNew)}><RotateCcw size={14} /> New project</button>
        </div>
      ) : null}
    </div>
  );
}
