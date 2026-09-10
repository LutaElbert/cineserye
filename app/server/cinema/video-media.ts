import 'server-only';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GenerateVideoRequest } from '../../features/video/video-api';
import { assemblyCommand, probeAssemblyMedia, type DecodedMedia } from './assembly';
import { ProviderError } from './provider-errors';
import { isFixtureVideoSample, type VideoProviderClip } from './video-provider';

export function validateDecodedVideo(metadata: DecodedMedia, settings: GenerateVideoRequest['settings']) {
  const short = settings.resolution === '1080p' ? 1080 : 720;
  const long = settings.resolution === '1080p' ? 1920 : 1280;
  const [width, height] = settings.aspectRatio === '9:16' ? [short, long] : [long, short];
  if (!metadata.format.split(',').includes('mp4') || metadata.width !== width || metadata.height !== height
    || Math.abs(metadata.durationSeconds - settings.durationSeconds) > 1 / 24 || metadata.audio) {
    throw new ProviderError('UNEXPECTED_RESPONSE', 'Decoded clip dimensions, duration, container or silent-audio policy do not match the approved video request.');
  }
}

export async function videoDecoderAvailable(): Promise<boolean> {
  try { await assemblyCommand('ffprobe', ['-version'], undefined, 3_000); await assemblyCommand('ffmpeg', ['-version'], undefined, 3_000); return true; } catch { return false; }
}

/** Inspect bytes, never a provider URL or caller-controlled filesystem path. */
export async function inspectVideoBytes(clip: VideoProviderClip, settings: GenerateVideoRequest['settings'], mode: 'fixture' | 'live'): Promise<VideoProviderClip & { byteSize: number }> {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clip.base64) || clip.base64.length > 128 * 1024 * 1024) throw new ProviderError('UNEXPECTED_RESPONSE', 'The provider clip has invalid or oversized bytes.');
  const bytes = Buffer.from(clip.base64, 'base64');
  if (bytes.length < 16 || bytes.subarray(4, 8).toString('ascii') !== 'ftyp') throw new ProviderError('UNEXPECTED_RESPONSE', 'The provider clip is not an MP4 container.');
  // The shipped fixture has fixed, locally verified metadata. Never label it as a full requested take.
  if (mode === 'fixture') {
    if (!isFixtureVideoSample(clip.base64)) throw new ProviderError('UNEXPECTED_RESPONSE', 'The fixture clip bytes do not match the verified local sample.');
    return { ...clip, width: 160, height: 90, durationSeconds: 1, byteSize: bytes.length };
  }
  const directory = await mkdtemp(join(tmpdir(), 'cineserye-video-inspect-'));
  try {
    const source = join(directory, 'provider-clip.mp4');
    await writeFile(source, bytes, { mode: 0o600 });
    const metadata = await probeAssemblyMedia(source);
    validateDecodedVideo(metadata, settings);
    // Decode the entire bounded clip as well as inspecting its container metadata.
    // No output file, external data reference, subtitle or audio stream is followed.
    await assemblyCommand('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-xerror', '-nostdin', '-protocol_whitelist', 'file,pipe', '-f', 'mov', '-enable_drefs', '0', '-use_absolute_path', '0', '-i', source, '-map', '0:v:0', '-an', '-sn', '-dn', '-f', 'null', '-'], undefined, 15_000);
    return { ...clip, width: metadata.width, height: metadata.height, durationSeconds: metadata.durationSeconds, byteSize: bytes.length };
  } finally { await rm(directory, { recursive: true, force: true }); }
}
