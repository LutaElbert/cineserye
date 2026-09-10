import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SequenceManifestSchema } from '../../features/assembly/sequence-manifest';
import { assemblyCommand, localAssemblyCapability, probeAssemblyMedia, renderLocalSequence, validateAssemblyInput, type DecodedMedia } from './assembly';

const clip = { shotId: 'shot-1', clipId: 'take-1', blobHash: 'a'.repeat(64), startFrame: 0, durationFrames: 120 };
const metadata: DecodedMedia = { width: 720, height: 1280, durationSeconds: 6, audio: true, frames: 144, format: 'mov,mp4,m4a,3gp,3g2,mj2' };

describe('decoded assembly validation', () => {
  it('uses real clip duration, not requested provider metadata', () => {
    expect(() => validateAssemblyInput(metadata, clip, '9:16')).not.toThrow();
    expect(() => validateAssemblyInput({ ...metadata, durationSeconds: 1 }, clip, '9:16')).toThrow(/shorter/);
    expect(() => validateAssemblyInput({ ...metadata, width: 160, height: 90 }, clip, '9:16')).toThrow(/aspect/);
    expect(() => validateAssemblyInput({ ...metadata, format: 'matroska,webm' }, clip, '9:16')).toThrow(/MP4/);
  });
});

const capability = await localAssemblyCapability();
describe.skipIf(!capability.available)('local FFmpeg renderer (synthetic clips, no providers)', () => {
  let directory: string;
  let first: Blob, second: Blob;
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'cineserye-assembly-test-'));
    const blobs = [];
    for (const [index, color] of ['red', 'blue'].entries()) {
      const output = join(directory, `synthetic-${index}.mp4`);
      await assemblyCommand('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', `color=c=${color}:s=180x320:r=24:d=32`, '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '32', '-c:v', 'libx264', '-threads', '2', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', output]);
      blobs.push(new Blob([new Uint8Array(await readFile(output))], { type: 'video/mp4' }));
    }
    [first, second] = blobs;
  }, 60_000);
  afterAll(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

  async function manifest(blobs: Blob[], durationFrames: number) {
    return SequenceManifestSchema.parse({ version: 1, aspectRatio: '9:16', resolution: '720p', fps: 24, audio: 'silent', confirmedLocalRender: true,
      clips: await Promise.all(blobs.map(async (blob, index) => ({ shotId: `shot-${index}`, clipId: `take-${index}`, blobHash: createHash('sha256').update(new Uint8Array(await blob.arrayBuffer())).digest('hex'), startFrame: 24, durationFrames }))),
    });
  }
  it('renders a true 60-second portrait silent MP4 and cleans its temporary files', async () => {
    const before = (await readdir(tmpdir())).filter((name) => name.startsWith('cineserye-assembly-')).sort();
    const result = await renderLocalSequence(await manifest([first, second], 30 * 24), [first, second]);
    expect(result.metadata).toMatchObject({ width: 720, height: 1280, durationSeconds: 60, frames: 1440, audio: false });
    const exported = join(directory, 'verified-output.mp4');
    await writeFile(exported, result.bytes);
    expect((await probeAssemblyMedia(exported)).durationSeconds).toBe(60);
    expect((await readdir(tmpdir())).filter((name) => name.startsWith('cineserye-assembly-')).sort()).toEqual(before);
  }, 120_000);
  it('fails hash integrity without leaving files and refuses a too-long trim', async () => {
    const request = await manifest([first], 24);
    request.clips[0].blobHash = '0'.repeat(64);
    await expect(renderLocalSequence(request, [first])).rejects.toThrow(/integrity/);
    await expect(renderLocalSequence(await manifest([first], 32 * 24), [first])).rejects.toThrow(/shorter/);
  });
  it('rejects renamed/non-MP4 bytes and cancellation', async () => {
    const bogus = new Blob(['not-a-real-media-file-even-if-labelled-mp4'], { type: 'video/mp4' });
    await expect(renderLocalSequence(await manifest([bogus], 24), [bogus])).rejects.toThrow(/decode|metadata|media/i);
    const abort = new AbortController(); abort.abort();
    await expect(renderLocalSequence(await manifest([first], 24), [first], abort.signal)).rejects.toThrow(/cancel/i);
  });
});
