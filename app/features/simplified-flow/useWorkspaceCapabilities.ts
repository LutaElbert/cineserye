'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { WorkflowCapabilitiesSchema, type WorkflowCapabilities } from '../story-development/workflow-capabilities';

export type WorkspaceCapabilitiesState =
  | { status: 'loading'; value: null; error: null }
  | { status: 'loaded'; value: WorkflowCapabilities; error: null }
  | { status: 'error'; value: null; error: string };

/** One editor-owned discovery request for both canvas and simplified consumers. */
export function useWorkspaceCapabilities(enabled: boolean) {
  const [state, setState] = useState<WorkspaceCapabilitiesState>({ status: 'loading', value: null, error: null });
  const sequence = useRef(0);
  const active = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (!enabled) return;
    const requestId = ++sequence.current;
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    try {
      const response = await fetch('/api/cinema/workflow-capabilities', { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw Error('Workspace status could not be checked.');
      const value = WorkflowCapabilitiesSchema.parse(await response.json());
      if (requestId === sequence.current && !controller.signal.aborted) setState({ status: 'loaded', value, error: null });
    } catch {
      if (requestId === sequence.current && !controller.signal.aborted) setState({ status: 'error', value: null,
        error: 'Availability is unknown. Check your connection and refresh. Manual editing and backups remain accessible.' });
    }
  }, [enabled]);
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => { if (mounted) void load(); });
    return () => { mounted = false; active.current?.abort(); };
  }, [load]);
  const refresh = () => {
    setState({ status: 'loading', value: null, error: null });
    return load();
  };
  return { ...state, refresh };
}
