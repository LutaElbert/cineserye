import 'server-only';
import { ASSEMBLY_LIMITS, SequenceManifestSchema } from '../../../features/assembly/sequence-manifest';
import { localAssemblyCapability, renderLocalSequence } from '../../../server/cinema/assembly';

const TOKEN_AGE_MS = 10 * 60_000;
let secret: Buffer | null = null;
let busy = false;
const usedTokens = new Map<string, number>();

function gate(request: Request) {
  const url = new URL(request.url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || request.headers.has('x-forwarded-host') || request.headers.has('forwarded')) {
    throw new Error('MP4 assembly is available only on the local operator server, not on a hosted or proxied URL.');
  }
  if (typeof process === 'undefined' || process.release?.name !== 'node' || typeof process.getBuiltinModule !== 'function'
    || (process.env.NODE_ENV !== 'development' && process.env.CINESERYE_LOCAL_ASSEMBLY_ENABLED !== 'true')) {
    throw new Error('Local MP4 rendering is disabled on this server. Enable the local operator renderer explicitly outside development.');
  }
  if (request.headers.get('host') && request.headers.get('host') !== url.host) throw new Error('Local host identity does not match.');
  return url;
}

function cryptography() {
  const crypto = process.getBuiltinModule('node:crypto') as typeof import('node:crypto');
  if (!crypto?.randomBytes) throw new Error('Local operator security is unavailable.');
  secret ??= crypto.randomBytes(32);
  return crypto;
}

function issueToken(origin: string) {
  const crypto = cryptography();
  const value = `${Date.now()}.${Buffer.from(crypto.randomBytes(16)).toString('hex')}`;
  return `${value}.${crypto.createHmac('sha256', secret!).update(`${origin}:${value}`).digest('hex')}`;
}

function consumeToken(token: string | null, origin: string) {
  if (!token || !/^\d{13}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token)) throw new Error('Refresh the local render capability before exporting.');
  const [time, nonce, signature] = token.split('.');
  if (Date.now() - Number(time) > TOKEN_AGE_MS || Number(time) > Date.now() + 1_000) throw new Error('Local render approval expired. Review and try again.');
  const crypto = cryptography();
  const expected = crypto.createHmac('sha256', secret!).update(`${origin}:${time}.${nonce}`).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new Error('Local render approval is invalid.');
  for (const [key, created] of usedTokens) if (Date.now() - created > TOKEN_AGE_MS) usedTokens.delete(key);
  if (usedTokens.has(token)) throw new Error('This render approval has already been used.');
  if (usedTokens.size >= 200) throw new Error('Too many local render requests. Wait before trying again.');
  usedTokens.set(token, Number(time));
}

function failure(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = gate(request);
    const capability = await localAssemblyCapability();
    return Response.json({ ...capability, token: capability.available ? issueToken(url.origin) : null, output: 'Silent MP4 · 720p · 24fps · local server only' }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return Response.json({ available: false, token: null, reason: error instanceof Error ? error.message : 'Local renderer unavailable.', limits: ASSEMBLY_LIMITS }, { headers: { 'cache-control': 'no-store' } });
  }
}

async function boundedMultipart(request: Request): Promise<FormData> {
  const type = request.headers.get('content-type');
  if (!type?.startsWith('multipart/form-data; boundary=')) throw new Error('Use the local sequence upload form.');
  const maximum = ASSEMBLY_LIMITS.maxTotalBytes + 1024 * 1024;
  const stated = request.headers.get('content-length');
  if (stated !== null && (!/^\d+$/.test(stated) || Number(stated) > maximum)) throw new Error('The local render upload is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('The local render upload is empty.');
  const chunks: Uint8Array[] = [];
  let total = 0;
  const timer = setTimeout(() => { void reader.cancel('Upload timed out.'); }, 30_000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) { await reader.cancel(); throw new Error('The local render upload is too large.'); }
      chunks.push(value);
    }
  } finally { clearTimeout(timer); reader.releaseLock(); }
  return new Response(new Blob(chunks as BlobPart[], { type })).formData();
}

export async function POST(request: Request): Promise<Response> {
  try {
    const url = gate(request);
    if (request.headers.get('origin') !== url.origin || !['same-origin', 'none', null].includes(request.headers.get('sec-fetch-site'))) return failure('Only the local Cineserye page can request a render.', 403);
    consumeToken(request.headers.get('x-cineserye-local-render'), url.origin);
  } catch (error) { return failure(error instanceof Error ? error.message : 'Local operator approval required.', 403); }
  if (busy) return failure('Another local render is already running. Wait for it to finish.', 409);
  busy = true;
  try {
    const data = await boundedMultipart(request);
    const source = data.get('manifest');
    if (typeof source !== 'string' || source.length > 32_000) throw new Error('The sequence manifest is missing or too large.');
    const manifest = SequenceManifestSchema.parse(JSON.parse(source));
    const expected = new Set(['manifest', ...manifest.clips.map((_, index) => `clip-${index}`)]);
    const entries = [...data.entries()];
    if (entries.length !== expected.size || entries.some(([key]) => !expected.has(key))) throw new Error('Unexpected or duplicate local render upload fields.');
    const clips = manifest.clips.map((_, index) => {
      const entry = data.get(`clip-${index}`);
      if (!(entry instanceof Blob)) throw new Error('A selected clip is missing from the upload.');
      return entry;
    });
    const result = await renderLocalSequence(manifest, clips, request.signal);
    return new Response(result.bytes as BodyInit, { headers: {
      'content-type': 'video/mp4', 'content-disposition': 'attachment; filename="cineserye-sequence.mp4"',
      'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'x-cineserye-duration': String(result.metadata.durationSeconds),
      'x-cineserye-dimensions': `${result.metadata.width}x${result.metadata.height}`,
    } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local MP4 rendering failed.';
    return failure(message.startsWith('[') ? 'The sequence manifest is invalid.' : message, 400);
  } finally { busy = false; }
}
