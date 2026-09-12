// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useResultOwner } from './useResultOwner';
afterEach(cleanup);
it('retains current callbacks across normal rerenders, invalidates scope, receiver and unmount', () => {
  const receiver = {}, view = renderHook(({ scope, receiver }) => useResultOwner(scope, receiver), { initialProps: { scope: 'project:shot', receiver } });
  const first = view.result.current(); view.rerender({ scope: 'project:shot', receiver }); expect(first()).toBe(true);
  view.rerender({ scope: 'new-project:shot', receiver }); expect(first()).toBe(false);
  const second = view.result.current(); view.rerender({ scope: 'new-project:shot', receiver: {} }); expect(second()).toBe(false);
  const third = view.result.current(); act(() => view.unmount()); expect(third()).toBe(false);
});
