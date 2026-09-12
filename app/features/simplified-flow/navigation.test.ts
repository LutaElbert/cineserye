// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { setSimplifiedPreview, stageFromSearch, useFilmmakingNavigation, workspaceFromSearch } from './navigation';
import { useWorkspaceCapabilities } from './useWorkspaceCapabilities';
import { containModalDeletionKey } from '../../components/ConfirmationDialog';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

it('contains modal deletion keys without blocking normal text editing', () => {
  const result = render(createElement('dialog', { open: true, onKeyDownCapture: containModalDeletionKey },
    createElement('button', null, 'Refresh'), createElement('input', { 'aria-label': 'Text' }),
    createElement('div', { contentEditable: true, 'aria-label': 'Rich text' })));
  for (const key of ['Delete', 'Backspace']) {
    expect(fireEvent.keyDown(result.getByRole('button'), { key })).toBe(false);
    expect(fireEvent.keyDown(result.getByRole('textbox'), { key })).toBe(true);
    expect(fireEvent.keyDown(result.getByLabelText('Rich text'), { key })).toBe(true);
  }
});

it('derives a safe workspace from the URL and preserves unrelated parameters', () => {
  expect(workspaceFromSearch('?workspace=unknown')).toBe('story');
  expect(stageFromSearch('?workspace=shots')).toBe('references');
  expect(workspaceFromSearch('?stage=references')).toBe('shots');
  window.history.replaceState(null, '', '/?flow=simplified&project=retained');
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(useFilmmakingNavigation);
  expect(result.current.enabled).toBe(true);
  act(() => result.current.select('shots'));
  expect(result.current.workspace).toBe('shots');
  expect(result.current.stage).toBe('references');
  expect(new URLSearchParams(window.location.search).get('project')).toBe('retained');
  act(() => { window.history.replaceState(null, '', '/?flow=simplified&workspace=edit'); window.dispatchEvent(new PopStateEvent('popstate')); });
  expect(result.current.workspace).toBe('edit');
  expect(result.current.stage).toBe('final-cut');
  act(() => result.current.select('video'));
  expect(result.current.workspace).toBe('shots');
  expect(result.current.stage).toBe('video');
  expect(new URLSearchParams(window.location.search).get('stage')).toBe('video');
  act(() => setSimplifiedPreview(false));
  expect(result.current.enabled).toBe(false);
  expect(result.current.workspace).toBe('story');
  expect(result.current.stage).toBe('idea');
  act(() => setSimplifiedPreview(true));
  expect(result.current.enabled).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});

it('does not fetch capabilities when the preview is disabled', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  renderHook(() => useWorkspaceCapabilities(false));
  expect(fetch).not.toHaveBeenCalled();
});

it('treats malformed or future-version discovery as unknown', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 999, ready: true }) }));
  const { result } = renderHook(() => useWorkspaceCapabilities(true));
  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current.value).toBeNull();
});

it('aborts superseded requests and ignores their late responses', async () => {
  const pending: Array<{ signal: AbortSignal; resolve: (value: unknown) => void }> = [];
  const fetch = vi.fn((_url: string, options: { signal: AbortSignal }) => new Promise((resolve) => pending.push({ signal: options.signal, resolve })));
  vi.stubGlobal('fetch', fetch);
  const { result, unmount } = renderHook(() => useWorkspaceCapabilities(true));
  await waitFor(() => expect(pending).toHaveLength(1));
  act(() => { void result.current.refresh(); });
  expect(pending).toHaveLength(2); expect(pending[0].signal.aborted).toBe(true);
  await act(async () => { pending[0].resolve({ ok: false }); });
  expect(result.current.status).toBe('loading');
  await act(async () => { pending[1].resolve({ ok: false }); });
  expect(result.current.status).toBe('error');
  act(() => { void result.current.refresh(); });
  unmount(); expect(pending[2].signal.aborted).toBe(true);
});
