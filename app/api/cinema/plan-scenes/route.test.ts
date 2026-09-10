import { afterEach, describe, expect, it, vi } from 'vitest';
import { scopedShotApprovalContent, type ScopedShotInput } from '../../../domain/cinema/scoped-shot-planning';
import { operationDigest } from '../../../server/cinema/operation-repository';
const mocks = vi.hoisted(() => ({ start: vi.fn(), read: vi.fn(), cancel: vi.fn() }));
vi.mock('../../../server/cinema/scoped-shot-planning', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../server/cinema/scoped-shot-planning')>(),
  localScopedShotCoordinator: async () => mocks,
}));
import { ScopedShotReviewRejection, scopedShotQuote } from '../../../server/cinema/scoped-shot-planning';
import { GET, POST } from './route';

const input: ScopedShotInput = { version: 1, projectId: 'local-project', premiseNodeId: 'story', scenes: [{ sceneId: 'scene', sourceDigest: 'a'.repeat(64), title: 'Escape', planningContext: '',
  brief: { version: 2, sceneNodeId: 'scene', sceneText: 'The friends escape together.', creationMode: 'ai-generated', aspectRatio: '9:16', targetPlatform: 'other', genreTone: 'Horror',
    locationPeriod: 'One room', dialogueAudioIntent: 'silent', targetDurationSeconds: 20, requiredBeats: [], mustInclude: [], mustAvoid: [],
    generationBudget: { pricingMode: 'unpriced', currency: null, ceiling: null, maxAttempts: 1 }, productionConstraints: { budgetBand: 'micro', currency: 'PHP', budgetCeiling: null, availableEquipment: [] } } }] };
function payload() {
  const quote = scopedShotQuote();
  return { version: 1, requestId: crypto.randomUUID(), input, quoteId: quote.quoteId, contentDigest: operationDigest(scopedShotApprovalContent(input, quote.quoteId)), mode: quote.mode, approvedEstimate: quote.perSceneEstimate, consent: true };
}
function post(body: unknown, origin = 'http://localhost') { return new Request('http://localhost/api/cinema/plan-scenes', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
afterEach(() => { vi.clearAllMocks(); });
describe('scoped planning request certainty', () => {
  it('marks validation/origin and explicit review rejections as no dispatch', async () => {
    expect(await (await POST(post({}))).json()).toMatchObject({ ok: false, dispatchCertainty: 'not-dispatched' });
    expect(await (await POST(post(payload(), 'https://other.example'))).json()).toMatchObject({ ok: false, dispatchCertainty: 'not-dispatched' });
    expect(mocks.start).not.toHaveBeenCalled();
    mocks.start.mockImplementationOnce(() => { throw new ScopedShotReviewRejection('The parent already has a reviewed successor.'); });
    expect(await (await POST(post(payload()))).json()).toMatchObject({ ok: false, dispatchCertainty: 'not-dispatched', error: 'The parent already has a reviewed successor.' });
  });
  it('never relabels arbitrary coordinator/storage failure as safe to retry', async () => {
    mocks.start.mockImplementationOnce(() => { throw Error('Unknown persistent outcome'); });
    expect(await (await POST(post(payload()))).json()).toMatchObject({ ok: false, dispatchCertainty: 'unknown' });
  });
  it('keeps successor recovery read-only and refuses oversized requests before dispatch', async () => {
    const requestId = crypto.randomUUID(), successorRequestId = crypto.randomUUID();
    mocks.read.mockReturnValue({ requestId, successorRequestId });
    expect(await (await GET(new Request(`http://localhost/api/cinema/plan-scenes?projectId=local-project&requestId=${requestId}`))).json()).toMatchObject({ state: { successorRequestId } });
    const request = post(payload()); request.headers.set('content-length', '300001');
    expect(await (await POST(request)).json()).toMatchObject({ ok: false, dispatchCertainty: 'not-dispatched' });
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
