import 'server-only';
import { ASSEMBLY_LIMITS, SequenceManifestSchema, sequenceRuntime, type SequenceManifest } from '../../features/assembly/sequence-manifest';

type NativeModules = { fs: typeof import('node:fs/promises'); os: typeof import('node:os'); path: typeof import('node:path'); child: typeof import('node:child_process'); crypto: typeof import('node:crypto') };
async function nativeModules(): Promise<NativeModules> {
  if (typeof process === 'undefined' || process.release?.name !== 'node' || typeof process.getBuiltinModule !== 'function') throw new Error('Local MP4 assembly requires a native Node server.');
  // Workers expose some Node compatibility modules but cannot spawn a renderer.
  const child = process.getBuiltinModule('node:child_process') as NativeModules['child'] | undefined;
  if (!child?.spawn) throw new Error('Local MP4 assembly is unavailable in this runtime.');
  const fsName = 'node:fs/promises';
  const fs = await import(/* @vite-ignore */ fsName) as NativeModules['fs'];
  return {
    fs, child,
    os: process.getBuiltinModule('node:os') as NativeModules['os'],
    path: process.getBuiltinModule('node:path') as NativeModules['path'],
    crypto: process.getBuiltinModule('node:crypto') as NativeModules['crypto'],
  };
}

export async function assemblyCommand(binary: 'ffmpeg' | 'ffprobe', args: string[], signal?: AbortSignal, timeoutMs: number = ASSEMBLY_LIMITS.timeoutMs): Promise<string> {
  const { child } = await nativeModules();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Local render cancelled.'));
    const operation = child.spawn(binary, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '';
    let failure: string | null = null;
    // Wait for process exit before cleanup; otherwise an aborted encoder can
    // recreate a file after its temporary directory was removed.
    const fail = (message: string) => { if (failure) return; failure = message; operation.kill('SIGKILL'); };
    const cancel = () => fail('Local render cancelled.');
    const timer = setTimeout(() => fail('Local render exceeded its time limit.'), timeoutMs);
    signal?.addEventListener('abort', cancel, { once: true });
    operation.stdout.on('data', (data: Buffer) => { output += data.toString(); if (output.length > 512_000) fail('Media metadata exceeded the local limit.'); });
    // Drain stderr, but never surface command arguments, local paths, or media contents.
    operation.stderr.on('data', () => undefined);
    operation.once('error', () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); fail('Install ffmpeg and ffprobe on this local server to assemble MP4.'); });
    operation.once('close', (code) => {
      clearTimeout(timer); signal?.removeEventListener('abort', cancel);
      if (failure) reject(new Error(failure));
      else if (code === 0) resolve(output);
      else reject(new Error('The local renderer could not decode or assemble this media.'));
    });
  });
}

export async function localAssemblyCapability() {
  try {
    await assemblyCommand('ffmpeg', ['-version'], undefined, 3_000);
    await assemblyCommand('ffprobe', ['-version'], undefined, 3_000);
    return { available: true as const, reason: null, limits: ASSEMBLY_LIMITS };
  } catch (error) {
    return { available: false as const, reason: error instanceof Error ? error.message : 'Local renderer unavailable.', limits: ASSEMBLY_LIMITS };
  }
}

export type DecodedMedia = { width: number; height: number; durationSeconds: number; audio: boolean; frames: number | null; format: string };
export async function probeAssemblyMedia(path: string, signal?: AbortSignal): Promise<DecodedMedia> {
  const text = await assemblyCommand('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-f', 'mov', '-enable_drefs', '0', '-use_absolute_path', '0', '-show_streams', '-show_format', '-of', 'json', path], signal, 10_000);
  let raw: { streams?: Array<{ codec_type?: string; width?: number; height?: number; duration?: string; nb_frames?: string; sample_aspect_ratio?: string; side_data_list?: Array<{ rotation?: number }> }>; format?: { duration?: string; format_name?: string } };
  try { raw = JSON.parse(text); } catch { throw new Error('The clip has invalid media metadata.'); }
  const streams = raw.streams ?? [];
  const videos = streams.filter((stream) => stream.codec_type === 'video');
  const video = videos[0];
  const durationSeconds = Number(video?.duration ?? raw.format?.duration);
  const width = Number(video?.width), height = Number(video?.height);
  if (videos.length !== 1 || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 120
    || !Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width * height > 3840 * 2160
    || (video?.sample_aspect_ratio && !['1:1', '0:1', 'N/A'].includes(video.sample_aspect_ratio))
    || video?.side_data_list?.some((item) => item.rotation && item.rotation % 360 !== 0)) {
    throw new Error('Use one valid MP4 video track, square pixels, no rotation metadata, and at most 4K / 120 seconds.');
  }
  return { width, height, durationSeconds, audio: streams.some((stream) => stream.codec_type === 'audio'), frames: video?.nb_frames && Number.isFinite(Number(video.nb_frames)) ? Number(video.nb_frames) : null, format: raw.format?.format_name ?? '' };
}

export function validateAssemblyInput(metadata: DecodedMedia, clip: SequenceManifest['clips'][number], aspectRatio: SequenceManifest['aspectRatio']) {
  const [x, y] = aspectRatio.split(':').map(Number);
  if (Math.abs(metadata.width / metadata.height - x / y) > 0.025) throw new Error('A clip has a different decoded aspect ratio. Generate or upload a matching take before assembly.');
  if (!metadata.format.split(',').includes('mp4')) throw new Error('A clip is not an MP4 container.');
  if ((clip.startFrame + clip.durationFrames) / 24 > metadata.durationSeconds + 0.001) {
    throw new Error('A clip is shorter than its requested trim. Fixture/sample metadata does not prove real clip duration.');
  }
}

export async function renderLocalSequence(manifestValue: unknown, blobs: Blob[], signal?: AbortSignal): Promise<{ bytes: Uint8Array; metadata: DecodedMedia }> {
  const manifest = SequenceManifestSchema.parse(manifestValue);
  if (blobs.length !== manifest.clips.length || blobs.some((blob) => blob.type !== 'video/mp4' || blob.size < 16 || blob.size > ASSEMBLY_LIMITS.maxClipBytes)
    || blobs.reduce((sum, blob) => sum + blob.size, 0) > ASSEMBLY_LIMITS.maxTotalBytes) throw new Error('The sequence exceeds the supported MP4 file count, type, or size limits.');
  const { fs, os, path, crypto } = await nativeModules();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cineserye-assembly-'));
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, ASSEMBLY_LIMITS.timeoutMs);
  try {
    const pieces: string[] = [];
    const [width, height] = manifest.aspectRatio === '9:16' ? [720, 1280] : [1280, 720];
    for (let index = 0; index < blobs.length; index += 1) {
      if (controller.signal.aborted) throw new Error('Local render cancelled or timed out.');
      const bytes = new Uint8Array(await blobs[index].arrayBuffer());
      if (crypto.createHash('sha256').update(bytes).digest('hex') !== manifest.clips[index].blobHash) throw new Error('A selected clip failed its integrity check.');
      const source = path.join(directory, `input-${index}.mp4`), output = path.join(directory, `part-${index}.mp4`);
      await fs.writeFile(source, bytes, { mode: 0o600 });
      const metadata = await probeAssemblyMedia(source, controller.signal);
      const clip = manifest.clips[index];
      validateAssemblyInput(metadata, clip, manifest.aspectRatio);
      await assemblyCommand('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-protocol_whitelist', 'file,pipe', '-f', 'mov', '-enable_drefs', '0', '-use_absolute_path', '0', '-i', source,
        '-map', '0:v:0', '-an', '-sn', '-dn', '-vf', `trim=start=${clip.startFrame / 24}:duration=${clip.durationFrames / 24},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24`,
        '-frames:v', String(clip.durationFrames), '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-map_metadata', '-1', '-movflags', '+faststart', output], controller.signal);
      pieces.push(`file 'part-${index}.mp4'`);
    }
    const list = path.join(directory, 'parts.txt'), output = path.join(directory, 'sequence.mp4');
    await fs.writeFile(list, pieces.join('\n'), { mode: 0o600 });
    await assemblyCommand('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-protocol_whitelist', 'file,pipe', '-f', 'concat', '-safe', '1', '-i', list, '-map', '0:v:0', '-an', '-c:v', 'copy', '-map_metadata', '-1', '-movflags', '+faststart', output], controller.signal);
    const metadata = await probeAssemblyMedia(output, controller.signal);
    if (metadata.width !== width || metadata.height !== height || metadata.audio || Math.abs(metadata.durationSeconds - sequenceRuntime(manifest)) > 1 / 24
      || metadata.frames !== manifest.clips.reduce((sum, clip) => sum + clip.durationFrames, 0)) throw new Error('Rendered MP4 failed its exact runtime, frame count, aspect, or silent-audio verification.');
    if ((await fs.stat(output)).size > ASSEMBLY_LIMITS.maxTotalBytes) throw new Error('Rendered MP4 exceeds the local output size limit.');
    return { bytes: new Uint8Array(await fs.readFile(output)), metadata };
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', cancel);
    await fs.rm(directory, { recursive: true, force: true });
  }
}
