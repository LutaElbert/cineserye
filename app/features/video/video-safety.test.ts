// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MOCK_CINEMA_PROJECT_DATA } from '../../domain/cinema/mock/reel-knows-tomorrow';
import { acceptCinemaPlanRevision } from '../../domain/cinema/project-data';
import type { CinemaStoryboardFrameRecord } from '../../domain/cinema/visual-preproduction';
import { VideoPreproductionPanel, videoGenerationInputs, recommendedClipDuration } from './VideoPreproductionPanel';
import { workflowCapabilities } from '../../server/cinema/workflow-capabilities';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function sample() {
  const incoming = structuredClone(MOCK_CINEMA_PROJECT_DATA);
  for (const run of Object.values(incoming.agentRuns)) run.status = 'ready';
  const cinema = acceptCinemaPlanRevision(undefined, incoming, '2026-09-07T00:00:00Z');
  const shot = Object.values(cinema.shots)[0];
  const revision = Object.values(cinema.revisions).find((entry) => entry.sceneId === shot.sceneId && entry.status === 'active')!;
  const prompt = Object.values(cinema.prompts).find((entry) => entry.ownerNodeId === shot.nodeId && entry.purpose === 'storyboard')!;
  const frame: CinemaStoryboardFrameRecord = { id: 'current-frame', runId: 'image-run', shotId: shot.id, revisionId: revision.id,
    promptId: prompt.id, promptVersion: prompt.version, promptText: prompt.generatedText, referenceIds: [], provider: 'fixture', model: 'fixture',
    aspectRatio: '9:16', seed: 1, variantIndex: 0, intent: 'balanced', blobHash: 'a'.repeat(64), mimeType: 'image/png',
    width: 1, height: 1, byteSize: 70, safetyStatus: 'passed', status: 'approved', estimatedCost: 0, currency: 'USD', createdAt: '2026-09-07T00:00:00Z' };
  cinema.visualPreproduction!.storyboardFrames[frame.id] = frame;
  return { cinema, shot, revision, frame };
}

describe('video input provenance', () => {
  it('recommends sufficient supported footage without changing the planned duration', () => {
    expect([2, 4, 5, 6, 7, 8, 12].map(recommendedClipDuration)).toEqual([4, 4, 6, 6, 8, 8, 8]);
  });
  it('warns before purchasing footage shorter than the shot', async () => {
    const { cinema, shot } = sample(); shot.durationSeconds = 12;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ ok: false, error: { message: 'Unavailable' } }) }));
    render(createElement(VideoPreproductionPanel, { cinema, shot, capabilities: workflowCapabilities({ CINESERYE_E2E_FIXTURE: 'true' }), onUpdate: vi.fn(), onNotice: vi.fn() }));
    expect((screen.getByLabelText('Video duration') as unknown as HTMLSelectElement).value).toBe('8');
    expect(screen.getByRole('status').textContent).toContain('shorter than the planned 12s shot');
    expect(shot.durationSeconds).toBe(12);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(vi.mocked(fetch).mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  });
  it('uses the shot scene’s own active revision, not the global selected scene', () => {
    const { cinema, shot, revision } = sample();
    cinema.activeRevisionId = 'another-scenes-revision';
    const selected = videoGenerationInputs(cinema, shot);
    expect(selected.revision?.id).toBe(revision.id);
    expect(selected.approvedFrame?.id).toBe('current-frame');
    expect(selected.prompt?.runId).toBe(revision.runId);
  });
  it('refuses approved frames from superseded revisions or stale image prompts', () => {
    const { cinema, shot, frame } = sample();
    cinema.visualPreproduction!.storyboardFrames = { 'old-frame': { ...frame, id: 'old-frame', revisionId: 'old-revision' } };
    expect(videoGenerationInputs(cinema, shot).approvedFrame).toBeNull();
    cinema.visualPreproduction!.storyboardFrames = { [frame.id]: frame };
    cinema.prompts[frame.promptId].status = 'stale';
    expect(videoGenerationInputs(cinema, shot).approvedFrame).toBeNull();
  });
  it('rejects old image prompt versions, changed prompt text, unsafe frames and stale motion prompts', () => {
    const { cinema, shot, frame } = sample();
    for (const patch of [{ promptVersion: frame.promptVersion + 1 }, { promptText: 'A different image' }, { safetyStatus: 'blocked' as const }]) {
      cinema.visualPreproduction!.storyboardFrames = { [frame.id]: { ...frame, ...patch } };
      expect(videoGenerationInputs(cinema, shot).approvedFrame).toBeNull();
    }
    const motion = Object.values(cinema.prompts).find((entry) => entry.ownerNodeId === shot.nodeId && entry.purpose === 'video')!;
    motion.status = 'stale';
    expect(videoGenerationInputs(cinema, shot).prompt).toBeNull();
  });
  it('requires fresh user confirmation after settings or approved frame bytes change', async () => {
    const { cinema, shot } = sample();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ ok: true, version: 1, mode: 'fixture', ready: true, blockers: [], quoteId: 'a'.repeat(64),
      usdPerSecond: 0, maximumEstimatedUsd: 0, capability: { version: 'fixture', provider: 'fixture', model: 'fixture', supportsEndFrame: true,
        supportsReferenceImages: false, supportsAudio: false, durations: [4, 6, 8], aspectRatios: ['9:16', '16:9'], resolutions: ['720p', '1080p'], maxOutputs: 1 } }) }));
    const props = { cinema, shot, capabilities: workflowCapabilities({ CINESERYE_E2E_FIXTURE: 'true' }), onUpdate: vi.fn(), onNotice: vi.fn() };
    const view = render(createElement(VideoPreproductionPanel, props));
    await waitFor(() => expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('checkbox'));
    expect((screen.getByRole('button', { name: 'Generate one clip' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Video duration'), { target: { value: '6' } });
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole('checkbox'));
    const changed = structuredClone(cinema); changed.visualPreproduction!.storyboardFrames['current-frame'].blobHash = 'b'.repeat(64);
    view.rerender(createElement(VideoPreproductionPanel, { ...props, cinema: changed }));
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole('button', { name: 'Generate one clip' }) as HTMLButtonElement).disabled).toBe(true);
    expect(vi.mocked(fetch).mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  });
});
