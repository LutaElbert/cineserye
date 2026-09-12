import { expect, test } from '@playwright/test';

test('built Worker permits local media previews without remote media sources', async ({ request }) => {
  const response = await request.get('/');
  expect(response.headers()['content-security-policy']).toContain("media-src 'self' blob:");
});

test('Worker discovery does not advertise native story execution', async ({ request }) => {
  const response = await request.get('/api/cinema/workflow-capabilities');
  expect(response.ok()).toBe(true);
  const capability = await response.json();
  expect(capability.runtime).toBe('unsupported');
  expect(capability.proof).toBe('configuration-only');
  expect(capability.story.ready).toBe(false);
  expect(capability.analysis.ready).toBe(false);
  for (const stage of ['research', 'analysis', 'story', 'shots', 'images', 'video', 'assembly']) {
    expect(capability.stages[stage].ready).toBe(false);
    expect(capability.stages[stage].status).toBe('blocked');
  }
  expect(capability.stages.uploads.status).toBe('local-only');
  expect(capability.legacyPlanning.livePreflight.ready).toBe(false);
});

for (const route of ['develop-story', 'story-assistant', 'plan-scenes', 'generate-video', 'generate-storyboard']) {
  test(`Worker rejects same-origin ${route} before parsing or dispatch`, async ({ request, baseURL }) => {
    const response = await request.post(`/api/cinema/${route}`, {
      headers: { origin: baseURL!, 'content-type': 'application/json', 'x-host-runtime': 'node', hostruntime: 'node' }, data: 'not JSON',
    });
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('native local operator');
  });
}

test('Worker cannot admit local rendering, even with a forged approval', async ({ request }) => {
  const capability = await (await request.get('/api/cinema/assemble')).json();
  expect(capability.available).toBe(false);
  expect(capability.token).toBeNull();
  const mutation = await request.post('/api/cinema/assemble', { headers: { 'x-cineserye-local-render': 'forged' }, data: {} });
  expect(mutation.status()).toBe(403);
});
