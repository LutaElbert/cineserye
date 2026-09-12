import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ poll: vi.fn(), generate: vi.fn() }));
vi.mock('@google/genai', () => ({
  GenerateVideosOperation: class {},
  GoogleGenAI: class { operations = { getVideosOperation: mocks.poll }; models = { generateVideos: mocks.generate }; },
}));
import { ConfirmedVideoFailure, VertexVideoProvider } from './video-provider';
import { createVertexVideoCapabilities } from './video-capabilities';

describe('restored provider operation identity', () => {
  it('only done with an explicit provider error proves failure; transport or missing bytes remain uncertain', async () => {
    const provider = new VertexVideoProvider('test', 'test', 'veo-3.1-fast-generate-001', createVertexVideoCapabilities('veo-3.1-fast-generate-001'));
    const input = { name: 'owned-operation', startedAt: 1 }, request = { settings: { aspectRatio: '9:16' as const, durationSeconds: 4 as const, resolution: '720p' as const, audio: false as const, outputCount: 1 as const, seed: null } };
    mocks.poll.mockResolvedValueOnce({ done: true, error: { code: 3 } });
    await expect(provider.poll(input, request)).rejects.toBeInstanceOf(ConfirmedVideoFailure);
    mocks.poll.mockRejectedValueOnce(Error('Connection lost'));
    await expect(provider.poll(input, request)).rejects.not.toBeInstanceOf(ConfirmedVideoFailure);
    mocks.poll.mockResolvedValueOnce({ done: true });
    await expect(provider.poll(input, request)).rejects.not.toBeInstanceOf(ConfirmedVideoFailure);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('polls a persisted name-only SDK handle without sending a new prompt or starting generation', async () => {
    mocks.poll.mockResolvedValue({ name: 'projects/test/locations/test/operations/existing', done: false });
    const provider = new VertexVideoProvider('test', 'test', 'veo-3.1-fast-generate-001', createVertexVideoCapabilities('veo-3.1-fast-generate-001'));
    const result = await provider.poll({ name: 'projects/test/locations/test/operations/existing', startedAt: 1 }, { settings: { aspectRatio: '9:16', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null } });
    expect(result.status).toBe('running');
    expect(mocks.poll).toHaveBeenCalledWith({ operation: expect.objectContaining({ name: 'projects/test/locations/test/operations/existing' }) });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
