import { expect, test, type Page } from '@playwright/test';
import { WorkflowCapabilitiesSchema } from '../app/features/story-development/workflow-capabilities';
import { refreshWorkspaceDiscovery } from './workspace-capability-helpers';

async function sample(page: Page, simplified: boolean) {
  await page.goto(simplified ? '/?flow=simplified' : '/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Explore.*sample/i }).click();
}
const blockedReason = 'This workspace does not permit new media requests.';
async function selectStage(page: Page, workspaceName: 'Shots' | 'Edit', stageName: 'References' | 'Final Cut') {
  const workspace = page.getByRole('navigation', { name: 'Filmmaking workspaces' }).getByRole('button', { name: workspaceName, exact: true });
  if (await workspace.getAttribute('aria-current') !== 'page') await workspace.click();
  const stage = page.getByRole('navigation', { name: `${workspaceName} stages` }).getByRole('button', { name: stageName, exact: true });
  if (await stage.getAttribute('aria-current') !== 'step') await stage.click();
}

for (const width of [1440, 390]) test(`media and Final Cut share blockers while local references stay editable at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  let unknown = false, mediaGets = 0, posts = 0;
  await page.route('**/api/cinema/workflow-capabilities', async (route) => {
    if (unknown) return route.fulfill({ json: { version: 1, ready: true } });
    const response = await route.fetch({ headers: { ...route.request().headers(), 'accept-encoding': 'identity' } }); const value = WorkflowCapabilitiesSchema.parse(await response.json());
    for (const feature of ['images', 'video', 'assembly'] as const) value.stages[feature] = { ...value.stages[feature], status: 'blocked', ready: false, blockers: [blockedReason] };
    await route.fulfill({ json: WorkflowCapabilitiesSchema.parse(value) });
  });
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts++;
    if (request.method() === 'GET' && /\/api\/cinema\/(generate-storyboard|generate-video|assemble)(\?|$)/.test(request.url())) mediaGets++;
  });
  await sample(page, true);
  await selectStage(page, 'Shots', 'References');
  await page.getByRole('button', { name: 'Review references', exact: true }).first().click();
  const editor = page.getByRole('region', { name: 'Shot layer editor', exact: true });
  await expect(editor.getByRole('checkbox', { name: /I confirm the/ })).toBeDisabled();
  for (const name of ['Reference images', 'Video generation']) await expect(editor.getByRole('region', { name: `${name} workspace status` })).toContainText(blockedReason);
  await expect(editor.getByRole('button', { name: 'Generate storyboard', exact: true })).toBeDisabled();
  await editor.getByRole('button', { name: /approved refs?/ }).click();
  await editor.getByLabel('Reference link title').fill('Local planning reference');
  await editor.getByLabel('HTTPS inspiration link').fill('https://example.com/local-reference');
  await editor.getByRole('button', { name: 'Add link', exact: true }).click();
  await expect(editor.locator('.reference-card')).toContainText('Local planning reference');
  await page.screenshot({ path: info.outputPath(`blocked-media-${width}.png`) });
  await page.getByRole('button', { name: 'Workspace status', exact: true }).click();
  const status = page.getByRole('dialog', { name: 'Workspace status', exact: true });
  for (const name of ['Reference images', 'Video generation', 'Final Cut']) await expect(status.locator('li').filter({ has: page.getByText(name, { exact: true }) })).toContainText(blockedReason);
  await status.getByRole('button', { name: 'Close workspace status' }).click();
  await page.getByRole('button', { name: 'Back to shots overview', exact: true }).click();
  await selectStage(page, 'Edit', 'Final Cut');
  const cut = page.getByRole('region', { name: 'Review sequence', exact: true });
  await expect(cut.getByRole('region', { name: 'Final Cut workspace status' })).toContainText(blockedReason);
  await expect(cut.getByRole('button', { name: 'Render silent MP4 locally' })).toBeDisabled();
  unknown = true;
  await page.getByRole('button', { name: 'Workspace status', exact: true }).click();
  await status.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(status.getByRole('alert')).toContainText('Availability is unknown');
  await status.getByRole('button', { name: 'Close workspace status' }).click();
  await expect(cut.getByRole('region', { name: 'Final Cut workspace status' })).toContainText('Unknown');
  await expect(cut).not.toContainText(blockedReason);
  expect(posts).toBe(0); expect(mediaGets).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('legacy media keeps a dispatched fixture video reviewable after workspace blocking', async ({ page }) => {
  let blockVideo = false, posts = 0; let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/cinema/workflow-capabilities', async (route) => {
    const response = await route.fetch({ headers: { ...route.request().headers(), 'accept-encoding': 'identity' } }); const value = WorkflowCapabilitiesSchema.parse(await response.json());
    if (blockVideo) value.stages.video = { ...value.stages.video, status: 'blocked', ready: false, blockers: [blockedReason] };
    await route.fulfill({ json: WorkflowCapabilitiesSchema.parse(value) });
  });
  await page.route('**/api/cinema/generate-video', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    posts++; const response = await route.fetch({ headers: { ...route.request().headers(), 'accept-encoding': 'identity' } }); await gate; await route.fulfill({ response });
  });
  await sample(page, false);
  await page.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await page.getByRole('tab', { name: 'Visuals' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Visuals' });
  await panel.getByRole('checkbox', { name: /I confirm the .* direction/ }).check();
  await panel.getByRole('button', { name: 'Generate storyboard' }).click();
  await expect(panel.locator('.storyboard-frame')).toHaveCount(3);
  await panel.locator('.storyboard-frame').first().getByRole('button', { name: 'Approve', exact: true }).click();
  await panel.getByRole('checkbox', { name: /I confirm one/ }).check();
  await panel.getByRole('button', { name: 'Generate one clip' }).click();
  await expect.poll(() => posts).toBe(1);
  blockVideo = true; await refreshWorkspaceDiscovery(page); release();
  await expect(panel.getByRole('region', { name: 'Video generation workspace status' })).toContainText(blockedReason);
  await expect(panel.locator('.video-version')).toHaveCount(1, { timeout: 15_000 });
  await expect(panel.locator('.video-version')).toContainText('Clip candidate');
  await expect(panel.getByRole('button', { name: 'Generate one clip' })).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'Approve clip' })).toBeEnabled();
  expect(posts).toBe(1);
});
