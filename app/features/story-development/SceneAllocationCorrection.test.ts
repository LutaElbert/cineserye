// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { SceneAllocationCorrection } from './SceneAllocationCorrection';
import { ensureStoryProject, storySceneAllocation } from '../../editor/story-development-commands';
import { initialDocument } from '../../editor/initial-document';
import type { EditorDocument } from '../../editor/types';

afterEach(cleanup);
it('saves an explicit valid allocation locally without moving nodes or calling a provider', async () => {
  let document = ensureStoryProject(structuredClone(initialDocument));
  const originalNodes = structuredClone(document.nodes), flush = vi.fn(async () => undefined), commit = vi.fn((next: EditorDocument, history?: boolean) => { document = next; void history; });
  render(createElement(SceneAllocationCorrection, { document, getDocument: () => document, commit, flush, sceneIds: ['scene-01'], min: 6, max: 180 }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '30' } });
  fireEvent.click(screen.getByRole('button', { name: /Save duration/ }));
  await waitFor(() => expect(flush).toHaveBeenCalledOnce());
  expect(commit.mock.calls[0][1]).toBe(true);
  expect(storySceneAllocation(document, 'scene-01')).toBe(30);
  expect(document.nodes).toEqual(originalNodes);
});
it('rechecks locks and bounds at commit rather than using old form eligibility', async () => {
  const document = ensureStoryProject(structuredClone(initialDocument)), commit = vi.fn();
  const current = structuredClone(document);
  render(createElement(SceneAllocationCorrection, { document, getDocument: () => current, commit, flush: async () => undefined, sceneIds: ['scene-01'], min: 6, max: 180 }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: /Save duration/ }));
  await screen.findByText('Enter 6–180 whole seconds.');
  current.nodes.find((node) => node.id === 'story-premise')!.data.locked = true;
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '30' } });
  fireEvent.click(screen.getByRole('button', { name: /Save duration/ }));
  await screen.findByText('Unlock this scene and Story before changing duration.');
  expect(commit).not.toHaveBeenCalled();
});
