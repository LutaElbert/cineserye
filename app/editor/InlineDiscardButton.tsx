'use client';
import { useState } from 'react';

export function InlineDiscardButton({ onConfirm, label = 'Discard text / direction changes', description = 'Discard this session’s text and direction edits? References and generated media are kept.', confirmLabel = 'Confirm discard', disabled = false }: {
  onConfirm: () => void; label?: string; description?: string; confirmLabel?: string; disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  return confirming ? <section className="inline-discard nodrag" role="group" aria-label={confirmLabel}>
    <p>{description}</p>
    <button type="button" disabled={disabled} onClick={() => { onConfirm(); setConfirming(false); }}>{confirmLabel}</button>
    <button type="button" onClick={() => setConfirming(false)}>Keep editing</button>
  </section> : <button type="button" disabled={disabled} className="secondary-button nodrag" onClick={() => setConfirming(true)}>{label}</button>;
}
