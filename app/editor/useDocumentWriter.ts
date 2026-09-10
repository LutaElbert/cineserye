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
    void navigator.locks.request(`${APP_CONFIG.storage.databaseName}:document-writer`, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      if (!active) return;
      setState(lock ? 'writer' : 'reader');
      if (lock) await new Promise<void>((resolve) => { release = resolve; });
    }).catch(() => { if (active) setState('reader'); });
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
