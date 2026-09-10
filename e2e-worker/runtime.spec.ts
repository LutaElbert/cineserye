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
});

test('Worker cannot admit local rendering, even with a forged approval', async ({ request }) => {
  const capability = await (await request.get('/api/cinema/assemble')).json();
  expect(capability.available).toBe(false);
  expect(capability.token).toBeNull();
  const mutation = await request.post('/api/cinema/assemble', { headers: { 'x-cineserye-local-render': 'forged' }, data: {} });
  expect(mutation.status()).toBe(403);
});
