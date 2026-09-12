import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assemblyCommand, localAssemblyCapability } from './assembly';
import { FIXTURE_VIDEO_CAPABILITIES } from './video-capabilities';
import { FixtureVideoProvider } from './video-provider';
import { inspectVideoBytes, validateDecodedVideo } from './video-media';
import type { GenerateVideoRequest } from '../../features/video/video-api';

const settings: GenerateVideoRequest['settings'] = { aspectRatio: '9:16', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null };
describe('truthful decoded video output', () => {
  it('keeps verified fixture metadata honest and refuses a sample as an actual approved production take', async () => {
    const provider = new FixtureVideoProvider(FIXTURE_VIDEO_CAPABILITIES, () => 2000);
    const sample = (await provider.poll({ name: 'fixture', startedAt: 0 }, { settings })).clip!;
    expect(await inspectVideoBytes(sample, settings, 'fixture')).toMatchObject({ width: 160, height: 90, durationSeconds: 1, byteSize: Buffer.from(sample.base64, 'base64').length });
    expect(() => validateDecodedVideo({ ...sample, audio: false, frames: 25, format: 'mov,mp4' }, settings)).toThrow(/duration/);
    await expect(inspectVideoBytes({ ...sample, base64: Buffer.from('0000ftypnot-the-fixture').toString('base64') }, settings, 'fixture')).rejects.toThrow(/verified local sample/);
  });
  it('rejects wrong duration, dimensions, audio and container based on actual metadata', () => {
    const metadata = { width: 720, height: 1280, durationSeconds: 4, audio: false, frames: 96, format: 'mov,mp4' };
    expect(() => validateDecodedVideo(metadata, settings)).not.toThrow();
    for (const changed of [{ durationSeconds: 1 }, { width: 1280, height: 720 }, { audio: true }, { format: 'webm' }]) expect(() => validateDecodedVideo({ ...metadata, ...changed }, settings)).toThrow();
  });
  it('decodes real synthetic MP4 bytes rather than trusting a provider metadata claim', async (context) => {
    const capability = await localAssemblyCapability();
    if (!capability.available) {
      if (process.env.CINESERYE_REQUIRE_RENDERER_TESTS === 'true') throw new Error(`Required video decoder tests cannot run: ${capability.reason}`);
      context.skip(); return;
    }
    const directory = await mkdtemp(join(tmpdir(), 'cineserye-video-real-test-'));
    try {
      const file = join(directory, 'synthetic.mp4');
      await assemblyCommand('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', 'color=c=purple:s=720x1280:r=24', '-t', '4', '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', file]);
      const bytes = Buffer.from(await readFile(file));
      const verified = await inspectVideoBytes({ mimeType: 'video/mp4', base64: bytes.toString('base64'), width: 1, height: 1, durationSeconds: 1 }, settings, 'live');
      expect(verified).toMatchObject({ width: 720, height: 1280, durationSeconds: 4, byteSize: bytes.length });
    } finally { await rm(directory, { recursive: true, force: true }); }
  }, 30_000);
});
