import 'server-only';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectImageType, MAX_DECODED_PIXELS, MAX_IMAGE_DIMENSION } from '../../editor/image-file';
import { assemblyCommand } from './assembly';
import { ProviderError } from './provider-errors';

const IMAGE_FORMATS = {
  'image/png': { demuxer: 'png_pipe', codec: 'png' },
  'image/jpeg': { demuxer: 'jpeg_pipe', codec: 'mjpeg' },
  'image/webp': { demuxer: 'webp_pipe', codec: 'webp' },
} as const;

/** Check before a paid request; an unavailable local decoder must not consume it. */
export async function requireStoryboardDecoder(signal?: AbortSignal) {
  try {
    await assemblyCommand('ffprobe', ['-version'], signal, 3_000);
    await assemblyCommand('ffmpeg', ['-version'], signal, 3_000);
  } catch {
    if (signal?.aborted) throw new ProviderError('CANCELLED', 'Storyboard generation was cancelled.');
    throw new ProviderError('INVALID_CONFIGURATION', 'Install ffmpeg and ffprobe on this local server before generating storyboard images.');
  }
}

/** Decode returned bytes, never provider URLs. Metadata is measured, not inferred
 * from the requested aspect ratio. This is media validation, not a safety review. */
export async function inspectStoryboardImage(base64: string, mimeType: string, signal?: AbortSignal) {
  if (signal?.aborted) throw new ProviderError('CANCELLED', 'Storyboard generation was cancelled.');
  if (base64.length > 20 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    throw new ProviderError('UNEXPECTED_RESPONSE', 'The image provider returned invalid or oversized image bytes.');
  }
  const bytes = Buffer.from(base64, 'base64');
  const detected = detectImageType(bytes);
  if (!detected || detected !== mimeType || bytes.toString('base64') !== base64) {
    throw new ProviderError('UNEXPECTED_RESPONSE', 'The image provider returned an unsupported or mislabeled image.');
  }
  const format = IMAGE_FORMATS[detected];
  const directory = await mkdtemp(join(tmpdir(), 'cineserye-storyboard-inspect-'));
  try {
    const source = join(directory, 'provider-image');
    await writeFile(source, bytes, { mode: 0o600 });
    const input = ['-protocol_whitelist', 'file,pipe', '-f', format.demuxer, '-i', source];
    const raw = await assemblyCommand('ffprobe', ['-v', 'error', ...input, '-show_entries', 'stream=codec_name,width,height', '-of', 'json'], signal, 10_000);
    const metadata = JSON.parse(raw) as { streams?: Array<{ codec_name?: string; width?: number; height?: number }> };
    const stream = metadata.streams?.[0];
    const width = stream?.width ?? 0, height = stream?.height ?? 0;
    if (metadata.streams?.length !== 1 || stream?.codec_name !== format.codec
      || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0
      || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || width * height > MAX_DECODED_PIXELS) {
      throw new Error('Invalid decoded dimensions.');
    }
    // Decode the whole still, not just its header. framehash exposes one line per
    // decoded frame so animated/multi-image payloads cannot masquerade as a still.
    const decoded = await assemblyCommand('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-xerror', '-nostdin', '-threads', '1', ...input,
      '-map', '0:v:0', '-an', '-sn', '-dn', '-threads', '1', '-f', 'framehash', '-'], signal, 15_000);
    if (decoded.split('\n').filter((line) => line.trim() && !line.startsWith('#')).length !== 1) throw new Error('Expected one still image.');
    return { width, height, mimeType: detected };
  } catch {
    if (signal?.aborted) throw new ProviderError('CANCELLED', 'Storyboard generation was cancelled.');
    throw new ProviderError('UNEXPECTED_RESPONSE', 'The provider image could not be decoded as one bounded PNG, JPEG, or WebP still.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
