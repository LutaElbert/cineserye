// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { workflowCapabilities } from '../../server/cinema/workflow-capabilities';
import { useWorkspaceAdmission } from './useWorkspaceAdmission';
import type { WorkflowCapabilities } from '../story-development/workflow-capabilities';

it('invalidates captured approval on unknown, same-mode replacement and unmount', () => {
  const fixture = workflowCapabilities({ CINESERYE_E2E_FIXTURE: 'true' });
  const view = renderHook(({ value }: { value: WorkflowCapabilities | null }) => useWorkspaceAdmission(value), { initialProps: { value: fixture as WorkflowCapabilities | null } });
  const first = view.result.current('fixture'); expect(first).not.toThrow();
  expect(() => view.result.current('live')).toThrow('Workspace status changed');
  act(() => view.rerender({ value: null }));
  expect(first).toThrow('Workspace status changed');
  expect(() => view.result.current('fixture')).toThrow('Workspace status changed');
  act(() => view.rerender({ value: fixture }));
  expect(first).toThrow('Workspace status changed');
  const second = view.result.current('fixture');
  act(() => view.rerender({ value: structuredClone(fixture) }));
  expect(second).toThrow('Workspace status changed');
  const third = view.result.current('fixture'); view.unmount();
  expect(third).toThrow('Workspace status changed');
});
