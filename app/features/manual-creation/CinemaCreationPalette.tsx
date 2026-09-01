'use client';

import { ImagePlus, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import {
  CINEMA_DRAFT_DESCRIPTORS,
  type CinemaDraftRole,
} from '../../domain/cinema/manual-creation';

export function CinemaCreationPalette({
  open,
  hasStory,
  hasScene,
  contextLabel,
  onClose,
  onCreate,
  onImportReference,
}: {
  open: boolean;
  hasStory: boolean;
  hasScene: boolean;
  contextLabel: string | null;
  onClose: () => void;
  onCreate: (role: CinemaDraftRole) => void;
  onImportReference: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const groups = useMemo(() => ['Story', 'Production', 'Workspace'] as const, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog?.open) {
      dialog?.showModal();
      firstButtonRef.current?.focus();
    }
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="cinema-create-dialog"
      aria-labelledby="cinema-create-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <header>
        <div>
          <span className="eyebrow">Build the canvas</span>
          <h2 id="cinema-create-title">Add a filmmaking layer</h2>
          <p>{contextLabel ? `Cineserye will connect it from ${contextLabel} when that relationship is valid.` : 'Choose a typed draft. You can edit or convert it later.'}</p>
        </div>
        <button type="button" className="icon-button" aria-label="Close add menu" onClick={onClose}><X size={15} /></button>
      </header>
      <div className="cinema-create-groups">
        {groups.map((group) => (
          <section key={group} aria-labelledby={`cinema-create-${group.toLocaleLowerCase()}`}>
            <h3 id={`cinema-create-${group.toLocaleLowerCase()}`}>{group}</h3>
            <div>
              {CINEMA_DRAFT_DESCRIPTORS.filter((descriptor) => descriptor.group === group).map((descriptor, index) => {
                const disabled = descriptor.role === 'story' ? hasStory : descriptor.role === 'shot' ? !hasScene : false;
                const reason = descriptor.role === 'story' && hasStory
                  ? 'This project already has a story premise.'
                  : descriptor.role === 'shot' && !hasScene
                    ? 'Add a scene before adding a shot.'
                    : descriptor.description;
                return (
                  <button
                    ref={group === 'Story' && index === 0 ? firstButtonRef : undefined}
                    key={descriptor.role}
                    type="button"
                    disabled={disabled}
                    suppressHydrationWarning
                    onClick={() => onCreate(descriptor.role)}
                  >
                    <span className={`cinema-create-mark role-${descriptor.role}`} aria-hidden="true">{descriptor.label.slice(0, 1)}</span>
                    <span><strong>{descriptor.label}</strong><small>{reason}</small></span>
                    <Plus size={13} aria-hidden="true" />
                  </button>
                );
              })}
              {group === 'Workspace' ? (
                <button type="button" onClick={onImportReference}>
                  <span className="cinema-create-mark role-reference" aria-hidden="true"><ImagePlus size={12} /></span>
                  <span><strong>Reference image</strong><small>Import a local PNG, JPEG, or WebP layer.</small></span>
                  <Plus size={13} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </dialog>
  );
}
