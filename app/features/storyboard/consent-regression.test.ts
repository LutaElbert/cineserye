// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MOCK_CINEMA_PROJECT_DATA } from '../../domain/cinema/mock/reel-knows-tomorrow';
import type { CinemaReferenceRecord } from '../../domain/cinema/visual-preproduction';
import { VisualPreproductionPanel } from './VisualPreproductionPanel';

vi.mock('../video/VideoPreproductionPanel', () => ({ VideoPreproductionPanel: () => null }));
afterEach(cleanup);

describe('storyboard consent scope', () => {
  it('clears confirmation after each shot edit even when its prompt was already stale', () => {
    const cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    const shot = Object.values(cinema.shots)[0];
    for (const prompt of Object.values(cinema.prompts)) if (prompt.ownerNodeId === shot.nodeId) prompt.status = 'stale';
    const props = { cinema, sceneId: shot.sceneId, shot, accepted: true, providerMode: 'fixture' as const,
      canvasImages: [], onCleanupMedia: vi.fn(), onUpdate: vi.fn(), onNotice: vi.fn() };
    const view = render(createElement(VisualPreproductionPanel, props));
    fireEvent.click(screen.getByRole('checkbox', { name: /I confirm/ }));
    view.rerender(createElement(VisualPreproductionPanel, { ...props, shot: { ...shot, cameraMovement: 'New camera direction' } }));
    expect((screen.getByRole('checkbox', { name: /I confirm/ }) as HTMLInputElement).checked).toBe(false);
  });
  it('SAFE-02 requires fresh confirmation when an approved reference is replaced, even at the same count', () => {
    const cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    const shot = Object.values(cinema.shots)[0];
    const reference: CinemaReferenceRecord = {
      id: 'ref-a', sceneId: shot.sceneId, title: 'Owned portrait', type: 'character',
      origin: 'upload', mimeType: 'image/png', width: 1, height: 1, byteSize: 10,
      blobHash: 'hash-a', sourceUrl: null, provenance: 'local', rightsStatus: 'creator-owned',
      allowedUses: ['image-generation'], approvalStatus: 'approved', notes: '',
      shotIds: [shot.id], pinned: false, createdAt: '2026-09-06T00:00:00Z',
    };
    cinema.visualPreproduction!.references = { [reference.id]: reference };
    const props = { cinema, sceneId: shot.sceneId, shot, accepted: true,
      providerMode: 'fixture' as const, canvasImages: [], onCleanupMedia: vi.fn(),
      onUpdate: vi.fn(), onNotice: vi.fn() };
    const view = render(createElement(VisualPreproductionPanel, props));
    fireEvent.click(screen.getByRole('checkbox', { name: /I confirm/ }));
    expect((screen.getByRole('button', { name: 'Generate storyboard' }) as HTMLButtonElement).disabled).toBe(false);
    const changed = structuredClone(cinema);
    changed.visualPreproduction!.references = { 'ref-b': { ...reference, id: 'ref-b', blobHash: 'hash-b' } };
    view.rerender(createElement(VisualPreproductionPanel, { ...props, cinema: changed }));
    expect((screen.getByRole('checkbox', { name: /I confirm/ }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole('button', { name: 'Generate storyboard' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
