import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { FixtureStoryboardProvider, VertexStoryboardProvider } from '../../../server/cinema/storyboard-provider';
import * as operations from '../../../server/cinema/operation-repository';
import { storyboardPreflight } from '../../../server/cinema/storyboard-preflight';
import { storyboardApprovalContent, type GenerateStoryboardRequest } from '../../../features/storyboard/storyboard-api';
import { requestDigest } from '../../../domain/cinema/request-digest';

let repository: operations.OperationRepository;
beforeEach(async () => {
  const env = { CINESERYE_E2E_FIXTURE: 'false', CINESERYE_PROVIDER_MODE: 'live', CINESERYE_LIVE_ENABLED: 'true',
    CINESERYE_LIVE_MAX_RUN_COST: '1', CINESERYE_STORYBOARD_USD_PER_IMAGE: '0.1', CINESERYE_STORYBOARD_MAX_ESTIMATED_USD: '0.5',
    CINESERYE_STORYBOARD_MAX_OUTPUTS: '4', CINESERYE_GCLOUD_ACTIVE_ACCOUNT: 'elbertluta@gmail.com',
    GOOGLE_CLOUD_PROJECT: 'cineserye', GOOGLE_CLOUD_QUOTA_PROJECT: 'cineserye' };
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  repository = await operations.OperationRepository.open(':memory:');
  vi.spyOn(operations, 'localOperationExecutor').mockResolvedValue(new operations.OperationExecutor(repository));
  vi.spyOn(VertexStoryboardProvider.prototype, 'generate').mockImplementation((payload, signal) => new FixtureStoryboardProvider().generate(payload, signal));
});
afterEach(() => { repository.close(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function payload(): Promise<GenerateStoryboardRequest> {
  const value: GenerateStoryboardRequest = { version: 1, idempotencyKey: 'safety-storyboard-01', shotId: 'shot-01',
    revisionId: 'revision-01', acceptedPlan: true,
    prompt: { id: 'prompt-01', version: 1, text: 'An empty cinema.', purpose: 'storyboard', status: 'draft' }, references: [],
    settings: { aspectRatio: '9:16', outputCount: 2, intent: 'balanced' }, explicitConfirmation: true, liveProviderConsent: true };
  const quote = storyboardPreflight();
  value.approval = { quoteId: quote.quoteId, contentDigest: await requestDigest(storyboardApprovalContent(value, quote.quoteId)) };
  return value;
}
const send = (value: unknown) => POST(new Request('http://localhost/api/cinema/generate-storyboard', { method: 'POST', body: JSON.stringify(value) }));
describe('storyboard server safety without paid providers', () => {
  it('replays a completed live operation without another dispatch', async () => {
    const value = await payload();
    const first = await send(value); const second = await send(value);
    expect(first.status).toBe(200); expect(await second.json()).toEqual(await first.json());
    expect(VertexStoryboardProvider.prototype.generate).toHaveBeenCalledTimes(1);
  });
  it.each(['switch', 'price', 'model', 'prompt', 'reference', 'consent', 'ceiling'])('fails closed when %s changes after approval', async (change) => {
    const value = await payload();
    if (change === 'switch') vi.stubEnv('CINESERYE_LIVE_ENABLED', 'false');
    if (change === 'price') vi.stubEnv('CINESERYE_STORYBOARD_USD_PER_IMAGE', '0.2');
    if (change === 'model') vi.stubEnv('CINESERYE_VERTEX_IMAGE_MODEL', 'changed-model');
    if (change === 'prompt') value.prompt.text = 'Changed';
    if (change === 'reference') value.references = [{ id: 'new', title: 'New image', rightsStatus: 'creator-owned', approvalStatus: 'approved', allowedUses: ['image-generation'], mimeType: 'image/png', base64: 'AAAA' }];
    if (change === 'consent') value.liveProviderConsent = false;
    if (change === 'ceiling') vi.stubEnv('CINESERYE_LIVE_MAX_RUN_COST', '0.01');
    expect((await send(value)).status).toBeGreaterThanOrEqual(400);
    expect(VertexStoryboardProvider.prototype.generate).not.toHaveBeenCalled();
  });
  it('rejects changed content on an existing operation even with fresh approval', async () => {
    const value = await payload(); expect((await send(value)).status).toBe(200);
    value.prompt.text = 'New request';
    value.approval!.contentDigest = await requestDigest(storyboardApprovalContent(value, value.approval!.quoteId));
    expect((await send(value)).status).toBe(400);
    expect(VertexStoryboardProvider.prototype.generate).toHaveBeenCalledTimes(1);
  });
  it('blocks malformed reference policy and unexpected executable fields', async () => {
    expect((await send({ ...await payload(), execute: '<script>fetch("secret")</script>' })).status).toBe(400);
    expect(VertexStoryboardProvider.prototype.generate).not.toHaveBeenCalled();
  });
});
