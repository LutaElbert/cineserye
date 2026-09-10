'use client';
import { useEffect, useRef } from 'react';
import { APP_CONFIG } from './config';

/** Other editor tabs hold shared leases so their unsaved history cannot be GC'd. */
export function useMediaRetentionLease() {
  const holder = useRef<{ release: () => void; done: Promise<unknown> } | null>(null);
  const mounted = useRef(false);
  const name = `${APP_CONFIG.storage.databaseName}:media-retention`;
  const acquire = () => {
    if (!navigator.locks || holder.current || !mounted.current) return;
    let release!: () => void;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const done = navigator.locks.request(name, { mode: 'shared' }, () => hold);
    holder.current = { release, done };
  };
  useEffect(() => {
    mounted.current = true;
    acquire();
    return () => { mounted.current = false; holder.current?.release(); holder.current = null; };
    // The origin/database lock name is constant for the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return async <T,>(action: () => Promise<T>): Promise<T> => {
    if (!navigator.locks) throw new Error('Safe cleanup is unavailable in this browser. Your media was kept.');
    const lease = holder.current;
    if (!lease) throw new Error('Another cleanup is in progress.');
    holder.current = null;
    lease.release();
    await lease.done;
    try {
      return await navigator.locks.request(name, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
        if (!lock) throw new Error('Close other Cineserye editor tabs before cleaning media; their undo history is protected.');
        return action();
      });
    } finally { acquire(); }
  };
}
