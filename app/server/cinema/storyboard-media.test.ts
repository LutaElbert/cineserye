import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assemblyCommand, localAssemblyCapability } from './assembly';
import * as assembly from './assembly';
import { inspectStoryboardImage } from './storyboard-media';
import { VertexStoryboardProvider } from './storyboard-provider';
import type { GenerateStoryboardRequest } from '../../features/storyboard/storyboard-api';

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent }; } }));

const request: GenerateStoryboardRequest = {
  version: 1, idempotencyKey: 'measured-image-test', shotId: 'shot-1', revisionId: 'revision-1', acceptedPlan: true,
  prompt: { id: 'prompt-1', version: 1, text: 'A neutral still.', purpose: 'storyboard', status: 'approved' },
  references: [], settings: { aspectRatio: '9:16', outputCount: 1, intent: 'balanced' },
  explicitConfirmation: true, liveProviderConsent: true,
};

describe('storyboard bytes boundary', () => {
  afterEach(() => vi.restoreAllMocks());
  it('rejects malformed base64, mismatched signatures and executable image formats before decoding', async () => {
    await expect(inspectStoryboardImage('not base64!', 'image/png')).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
    await expect(inspectStoryboardImage(Buffer.from('<svg/>').toString('base64'), 'image/svg+xml')).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
    await expect(inspectStoryboardImage('iVBORw0KGgo=', 'image/jpeg')).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
    await expect(inspectStoryboardImage('A'.repeat(20 * 1024 * 1024 + 4), 'image/png')).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
  });

  it('does not call the provider for an already cancelled operation', async () => {
    generateContent.mockReset();
    const controller = new AbortController(); controller.abort();
    await expect(new VertexStoryboardProvider('local-test', 'global').generate(request, controller.signal)).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('fails before any paid dispatch if the native image decoder is unavailable', async () => {
    generateContent.mockReset();
    vi.spyOn(assembly, 'assemblyCommand').mockRejectedValueOnce(new Error('Decoder unavailable'));
    await expect(new VertexStoryboardProvider('local-test', 'global').generate(request, new AbortController().signal)).rejects.toMatchObject({ code: 'INVALID_CONFIGURATION' });
    expect(generateContent).not.toHaveBeenCalled();
  });
});

const capability = await localAssemblyCapability();
if (process.env.CINESERYE_REQUIRE_RENDERER_TESTS === 'true' && !capability.available) {
  throw new Error(`Required media decoder tests cannot run: ${capability.reason}`);
}
describe.skipIf(!capability.available)('actual storyboard still decoding (local synthetic bytes, no paid calls)', () => {
  let directory: string;
  const images: Record<string, string> = {};
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'cineserye-storyboard-test-'));
    for (const [extension, codec] of [['png', 'png'], ['jpg', 'mjpeg']]) {
      const path = join(directory, `still.${extension}`);
      await assemblyCommand('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=64x96', '-frames:v', '1', '-c:v', codec, '-threads', '1', path]);
      images[extension] = Buffer.from(await readFile(path)).toString('base64');
    }
    // A synthetic blue 64×96 still: decoding does not require a WebP encoder.
    images.webp = 'UklGRlIAAABXRUJQVlA4IEYAAAAwBACdASpAAGAAPm02mUmkIyKhIWgAgA2JaQB2AAAWZEiRIkSJEiRIj6AA/vkd2//+QH/+QH/+QH/8gP/+IXeyAwAAAAAA';
  });
  afterAll(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });
  beforeEach(() => generateContent.mockReset());

  it.each([['png', 'image/png'], ['jpg', 'image/jpeg'], ['webp', 'image/webp']])('measures actual %s dimensions and cleans temporary bytes', async (extension, mimeType) => {
    const before = (await readdir(tmpdir())).filter((name) => name.startsWith('cineserye-storyboard-inspect-')).sort();
    await expect(inspectStoryboardImage(images[extension], mimeType)).resolves.toEqual({ width: 64, height: 96, mimeType });
    expect((await readdir(tmpdir())).filter((name) => name.startsWith('cineserye-storyboard-inspect-')).sort()).toEqual(before);
  });

  it('rejects corrupted raster bytes and cleans temporary files', async () => {
    const before = (await readdir(tmpdir())).filter((name) => name.startsWith('cineserye-storyboard-inspect-')).sort();
    const truncated = Buffer.from(images.png, 'base64').subarray(0, 35).toString('base64');
    await expect(inspectStoryboardImage(truncated, 'image/png')).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
    expect((await readdir(tmpdir())).filter((name) => name.startsWith('cineserye-storyboard-inspect-')).sort()).toEqual(before);
  });

  it('reports actual provider output dimensions and unspecified seed, not requested-aspect defaults', async () => {
    generateContent.mockResolvedValue({ candidates: [{ content: { parts: [{ inlineData: { data: images.png, mimeType: 'image/png' } }] } }] });
    const result = await new VertexStoryboardProvider('local-test', 'global').generate(request, new AbortController().signal);
    expect(result.frames[0]).toMatchObject({ width: 64, height: 96, seed: null, variantIndex: 0, safetyStatus: 'passed' });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
