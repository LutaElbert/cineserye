'use client';
import { useCallback, useLayoutEffect, useRef } from 'react';

/** Async completion owns a mounted project/target and receiver, not whichever
 * target happens to be visible when its promise settles. Capability refresh is
 * deliberately excluded: dispatched work still belongs to its original owner. */
export function useResultOwner(scope: string, receiver: unknown) {
  const current = useRef<{ scope: string; receiver: unknown; active: boolean } | null>(null);
  useLayoutEffect(() => {
    const owner = { scope, receiver, active: true };
    current.current = owner;
    return () => { owner.active = false; };
  }, [scope, receiver]);
  return useCallback(() => {
    const owner = current.current;
    return () => Boolean(owner?.active && current.current === owner);
  }, []);
}
