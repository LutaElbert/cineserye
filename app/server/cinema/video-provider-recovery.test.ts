import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ poll: vi.fn(), generate: vi.fn() }));
vi.mock('@google/genai', () => ({
  GenerateVideosOperation: class {},
  GoogleGenAI: class { operations = { getVideosOperation: mocks.poll }; models = { generateVideos: mocks.generate }; },
}));
import { VertexVideoProvider } from './video-provider';
import { createVertexVideoCapabilities } from './video-capabilities';

describe('restored provider operation identity', () => {
  it('polls a persisted name-only SDK handle without sending a new prompt or starting generation', async () => {
    mocks.poll.mockResolvedValue({ name: 'projects/test/locations/test/operations/existing', done: false });
    const provider = new VertexVideoProvider('test', 'test', 'veo-3.1-fast-generate-001', createVertexVideoCapabilities('veo-3.1-fast-generate-001'));
    const result = await provider.poll({ name: 'projects/test/locations/test/operations/existing', startedAt: 1 }, { settings: { aspectRatio: '9:16', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null } });
    expect(result.status).toBe('running');
    expect(mocks.poll).toHaveBeenCalledWith({ operation: expect.objectContaining({ name: 'projects/test/locations/test/operations/existing' }) });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
