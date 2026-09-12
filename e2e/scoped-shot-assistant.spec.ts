import { expect, test } from '@playwright/test';

test('idea to accepted three-scene shot plans uses explicit scope and survives reload without redispatch', async ({ page }, info) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
  expect(process.env.CINESERYE_E2E_RUNTIME).toBe('node-fixture');
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const posts: string[] = [];
  await page.route('**/api/cinema/**', async (route) => {
    if (route.request().method() === 'POST') {
      expect(route.request().postData() ?? '').not.toMatch(/"mode"\s*:\s*"live"/);
      posts.push(new URL(route.request().url()).pathname);
    }
    await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Start with an idea/ }).click();
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  await editor.getByRole('textbox', { name: 'Layer title', exact: true }).fill('The Cursed Game');
  await editor.getByRole('textbox', { name: 'Premise for development', exact: true }).fill('Four friends discover a cursed board game. A 60-second vertical horror mystery, no dialogue. All four survive.');
  await editor.getByRole('button', { name: 'Generate', exact: true }).click();
  const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'Here’s what I understood', exact: true })).toBeVisible();
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await assistant.getByRole('button', { name: 'Draft scene outline', exact: true }).click();
  await assistant.getByRole('button', { name: 'Add 3 scenes', exact: true }).click();
  const shotScope = assistant.getByRole('region', { name: 'Assistant shot planning', exact: true });
  await expect(shotScope.getByText('3 scenes selected')).toBeVisible();
  await expect(shotScope.getByRole('button', { name: 'Plan shots', exact: true })).toBeEnabled();
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0);
  const hosts = await page.locator('.react-flow__node:not([data-id^="story-assistant:"])').evaluateAll((nodes) => nodes.map((node) => ({ id: node.getAttribute('data-id'), transform: (node as HTMLElement).style.transform })));
  await shotScope.getByRole('button', { name: 'Plan shots', exact: true }).click();
  await expect(shotScope.getByRole('heading', { name: 'Review shot planning', exact: true })).toBeVisible();
  expect(posts.filter((path) => path === '/api/cinema/plan-scenes')).toHaveLength(0);
  await shotScope.getByRole('button', { name: 'Create 3 fixture plans', exact: true }).click();
  await expect(shotScope.getByRole('checkbox', { name: /Include this plan/ })).toHaveCount(3, { timeout: 20_000 });
  await expect(shotScope.getByText(/Queued work stopped/)).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('three-scene-shot-review.png') });
  await page.reload();
  await expect(shotScope.getByRole('checkbox', { name: /Include this plan/ })).toHaveCount(3);
  expect(posts.filter((path) => path === '/api/cinema/plan-scenes')).toHaveLength(1);
  await shotScope.getByRole('button', { name: 'Add selected shot plans', exact: true }).click();
  await expect(shotScope.getByRole('button', { name: /Open shots & media/ })).toHaveCount(3);
  await expect(shotScope.getByRole('alert')).toHaveCount(0);
  for (const host of hosts) {
    expect(await page.locator(`.react-flow__node[data-id="${host.id}"]`).evaluate((node) => (node as HTMLElement).style.transform)).toBe(host.transform);
  }
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('three-scene-shots-added.png') });
  await shotScope.getByRole('button', { name: /Open shots & media/ }).first().click();
  await expect(page.getByRole('button', { name: 'Close layer editor', exact: true })).toBeVisible();
  expect(posts.filter((path) => /generate-storyboard|generate-video/.test(path))).toHaveLength(0);
  expect(runtimeErrors).toEqual([]);
});
