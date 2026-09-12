'use client';
import { useEffect, useState } from 'react';
import { APP_CONFIG } from './config';

/** One editable document per browser origin. Other tabs remain recoverable readers. */
export function useDocumentWriter() {
  const [state, setState] = useState<'pending' | 'writer' | 'reader'>('pending');
  useEffect(() => {
    let active = true;
    let release = () => {};
    if (!navigator.locks) { queueMicrotask(() => { if (active) setState('reader'); }); return () => { active = false; }; }
    // A same-tab reload can mount the new page a moment before the previous
    // page's cleanup releases its lock. Retry that brief handoff without ever
    // waiting indefinitely behind a genuinely active second editor.
    void (async () => {
      for (const delay of [0, 50, 150, 300]) {
        if (delay) await new Promise<void>((resolve) => window.setTimeout(resolve, delay));
        if (!active) return;
        let acquired = false;
        await navigator.locks.request(`${APP_CONFIG.storage.databaseName}:document-writer`, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
          if (!active || !lock) return;
          acquired = true; setState('writer');
          await new Promise<void>((resolve) => { release = resolve; });
        });
        if (acquired || !active) return;
      }
      if (active) setState('reader');
    })().catch(() => { if (active) setState('reader'); });
    return () => { active = false; release(); };
  }, []);
  useEffect(() => {
    if (state !== 'reader') return;
    const block = (event: KeyboardEvent) => {
      if (!(event.target as Element | null)?.closest?.('.document-reader-banner')) event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', block, true);
    return () => window.removeEventListener('keydown', block, true);
  }, [state]);
  return state;
}
