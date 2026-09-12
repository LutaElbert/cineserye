'use client';
import { useCallback, useLayoutEffect, useRef } from 'react';
import type { WorkflowCapabilities } from '../story-development/workflow-capabilities';

/** UI approval boundary, independent of the server's fresh authorization.
 * Any discovery replacement (including same-mode refresh) invalidates work
 * still preparing locally. Already dispatched operations remain recoverable. */
export function useWorkspaceAdmission(capabilities: WorkflowCapabilities | null) {
  const current = useRef<{ value: WorkflowCapabilities | null } | null>({ value: capabilities });
  useLayoutEffect(() => { current.current = { value: capabilities }; return () => { current.current = null; }; }, [capabilities]);
  return useCallback((mode: 'fixture' | 'live') => {
    const approved = current.current;
    if (!approved?.value || approved.value.mode !== mode) throw Error('Workspace status changed. Review availability and approve the request again.');
    return () => {
      if (current.current !== approved) throw Error('Workspace status changed. Review availability and approve the request again.');
    };
  }, []);
}
