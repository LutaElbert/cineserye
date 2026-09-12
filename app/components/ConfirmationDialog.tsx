'use client';

import { AlertTriangle, CircleHelp, LoaderCircle, ShieldAlert } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
} from 'react';

/** Keep canvas deletion and browser Backspace navigation behind modal controls. */
export function containModalDeletionKey(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return;
  const editing = event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]');
  if (!editing) { event.preventDefault(); event.stopPropagation(); }
}

export type ConfirmationTone = 'default' | 'warning' | 'danger';

export type ConfirmationDialogOptions = Readonly<{
  tone?: ConfirmationTone;
  eyebrow?: string;
  title: string;
  description: string;
  impact?: string;
  reassurance?: string;
  confirmLabel: string;
  cancelLabel?: string;
}>;

type ConfirmationDialogProps = {
  request: ConfirmationDialogOptions | null;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationDialog({
  request,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (request && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => cancelRef.current?.focus());
    } else if (!request && dialog.open) {
      dialog.close();
    }
  }, [request]);

  useEffect(() => () => {
    if (dialogRef.current?.open) dialogRef.current.close();
  }, []);

  const settle = (confirmed: boolean) => {
    if (busy) return;
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    if (confirmed) onConfirm(); else onCancel();
  };

  const tone = request?.tone ?? 'default';
  const describedBy = request
    ? [descriptionId, request.impact ? `${descriptionId}-impact` : '', request.reassurance ? `${descriptionId}-reassurance` : '']
      .filter(Boolean)
      .join(' ')
    : undefined;

  return (
    <dialog
      ref={dialogRef}
      className={`confirmation-dialog nokey tone-${tone}`}
      onKeyDownCapture={containModalDeletionKey}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={request ? titleId : undefined}
      aria-describedby={describedBy}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        settle(false);
      }}
      onPointerDown={(event) => {
        const rectangle = event.currentTarget.getBoundingClientRect();
        const outsideContent = event.clientX < rectangle.left
          || event.clientX > rectangle.right
          || event.clientY < rectangle.top
          || event.clientY > rectangle.bottom;
        if (outsideContent || event.target === event.currentTarget) settle(false);
      }}
    >
      {request ? (
        <div className="confirmation-dialog-content">
          <div className="confirmation-dialog-icon" aria-hidden="true">
            {tone === 'danger' ? <ShieldAlert size={20} /> : tone === 'warning' ? <AlertTriangle size={20} /> : <CircleHelp size={20} />}
          </div>
          <div className="confirmation-dialog-copy">
            <span className="eyebrow">{request.eyebrow ?? (tone === 'danger' ? 'Destructive action' : tone === 'warning' ? 'Confirm change' : 'Confirmation')}</span>
            <h2 id={titleId}>{request.title}</h2>
            <p id={descriptionId}>{request.description}</p>
          </div>
          {request.impact ? <p className="confirmation-dialog-impact" id={`${descriptionId}-impact`}>{request.impact}</p> : null}
          {request.reassurance ? <p className="confirmation-dialog-reassurance" id={`${descriptionId}-reassurance`}>{request.reassurance}</p> : null}
          <div className="confirmation-dialog-actions">
            <button
              ref={cancelRef}
              type="button"
              className="secondary-button"
              disabled={busy}
              autoFocus
              onClick={() => settle(false)}
            >{request.cancelLabel ?? 'Cancel'}</button>
            <button
              type="button"
              className={`primary-button confirmation-dialog-confirm ${tone === 'danger' ? 'danger' : ''}`}
              disabled={busy}
              onClick={() => settle(true)}
            >
              {busy ? <LoaderCircle size={14} className="spin" /> : null}
              {request.confirmLabel}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
