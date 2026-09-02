import { describe, expect, it, vi } from 'vitest';
import { persistVideoClipArtifact } from './video-storage';

describe('video local storage boundary', () => {
  it('S6-IT-03 returns no accepted metadata when quota fails', async () => {
    const save = vi.fn(async () => { throw new DOMException('Full', 'QuotaExceededError'); });
    await expect(persistVideoClipArtifact({
      blob: new Blob(['video'], { type: 'video/mp4' }),
      width: 720,
      height: 1280,
    }, save)).rejects.toThrow(/storage is full/i);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('rejects empty or mislabeled video before persistence', async () => {
    const save = vi.fn();
    await expect(persistVideoClipArtifact({ blob: new Blob([]), width: 720, height: 1280 }, save)).rejects.toThrow(/invalid video/i);
    expect(save).not.toHaveBeenCalled();
  });
});
