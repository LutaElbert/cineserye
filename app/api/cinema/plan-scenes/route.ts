import 'server-only';
import { publicProviderError } from '../../../server/cinema/provider-errors';
import { assertLocalRequest } from '../../../server/cinema/local-request';

// This route is part of the Worker bundle so capability discovery can explain
// why planning is unavailable there. Keep the native coordinator lazy: a
// Worker request must fail the runtime guard without evaluating SQLite/Node
// dependencies from scoped-shot-planning.
const planning = () => import('../../../server/cinema/scoped-shot-planning');

function scope(request: Request) {
  const url = new URL(request.url), projectId = url.searchParams.get('projectId'), requestId = url.searchParams.get('requestId');
  if (!projectId || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(projectId) || !requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) throw Error('Invalid project operation.');
  return { projectId, requestId };
}
function failure(error: unknown, dispatchCertainty: 'not-dispatched' | 'unknown' = 'unknown') {
  const rejectedBeforeDispatch = typeof error === 'object' && error !== null && 'code' in error && error.code === 'INVALID_REQUEST';
  return Response.json({ ok: false, error: publicProviderError(error).message,
    dispatchCertainty: rejectedBeforeDispatch ? 'not-dispatched' : dispatchCertainty }, { status: 400, headers: { 'cache-control': 'no-store' } });
}
async function readPlanningBody(request: Request) {
  const max = 300_000, declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > max)) throw Error('Reduce this planning scope.');
  const reader = request.body?.getReader(); if (!reader) throw Error('Missing planning request.');
  let size = 0, timedOut = false; const chunks: Uint8Array[] = [];
  const timer = setTimeout(() => { timedOut = true; void reader.cancel(); }, 30_000);
  try {
    while (true) {
      const chunk = await reader.read(); if (timedOut) throw Error('Planning upload timed out.'); if (chunk.done) break;
      size += chunk.value.byteLength; if (size > max) { await reader.cancel(); throw Error('Reduce this planning scope.'); } chunks.push(chunk.value);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } finally { clearTimeout(timer); reader.releaseLock(); }
}
export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    const { localScopedShotCoordinator, scopedShotQuote } = await planning();
    if (!new URL(request.url).searchParams.has('requestId')) return Response.json({ ok: true, quote: scopedShotQuote() }, { headers: { 'cache-control': 'no-store' } });
    const { projectId, requestId } = scope(request);
    return Response.json({ ok: true, state: (await localScopedShotCoordinator()).read(projectId, requestId) }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  let dispatchCertainty: 'not-dispatched' | 'unknown' = 'not-dispatched';
  try {
    assertLocalRequest(request, { mutation: true, json: true });
    const { localScopedShotCoordinator, scopedShotQuote, ScopedShotRequestSchema } = await planning();
    const parsed = ScopedShotRequestSchema.parse(JSON.parse(await readPlanningBody(request)));
    const coordinator = await localScopedShotCoordinator();
    dispatchCertainty = 'unknown';
    const state = coordinator.start(parsed, scopedShotQuote());
    return Response.json({ ok: true, state }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) { return failure(error, dispatchCertainty); }
}
export async function DELETE(request: Request) {
  try {
    assertLocalRequest(request, { mutation: true });
    const { localScopedShotCoordinator } = await planning();
    const { projectId, requestId } = scope(request);
    return Response.json({ ok: true, state: (await localScopedShotCoordinator()).cancel(projectId, requestId) });
  }
  catch (error) { return failure(error); }
}
