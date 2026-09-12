import { expect, test, type Page } from '@playwright/test';
import { confirmCineseryeDialog, waitForSaved } from './helpers';

async function workbench(page: Page) {
  await page.goto('/'); await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Explore the sample/ }).click();
  await page.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await page.getByRole('tab', { name: 'Visuals' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Visuals' });
  await panel.getByRole('checkbox', { name: /I confirm the .* direction/ }).check();
  await panel.getByRole('button', { name: 'Generate storyboard' }).click();
  await expect(panel.locator('.storyboard-frame')).toHaveCount(3);
  await panel.locator('.storyboard-frame').first().getByRole('button', { name: 'Approve', exact: true }).click();
  return panel;
}
test('malformed video readiness cannot enable consent or dispatch', async ({ page }) => {
  let posts = 0;
  await page.route('**/api/cinema/generate-video', async route => {
    if (route.request().method() === 'POST') { posts++; return route.abort(); }
    const response = await route.fetch({ headers: { ...route.request().headers(), 'accept-encoding': 'identity' } });
    await route.fulfill({ json: { ...await response.json(), ready: 'yes' } });
  });
  const panel = await workbench(page);
  await expect(panel.getByRole('checkbox', { name: /I confirm one/ })).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'Generate one clip' })).toBeDisabled();
  await expect(panel.locator('.video-workbench')).toContainText(/preflight is unavailable/);
  expect(posts).toBe(0);
});
for (const expired of [false, true]) test(`unknown request survives reload and ${expired ? 'shows an explicit expired tombstone' : 'reconciles the same ID'} without another POST`, async ({ page }) => {
  let posts = 0, reads = 0, operationId = '';
  await page.route('**/api/cinema/generate-video**', async route => {
    if (route.request().method() === 'POST') {
      posts++; const response = await route.fetch({ headers: { ...route.request().headers(), 'accept-encoding': 'identity' } });
      const result = await response.json(); operationId = result.operation.operationId;
      return route.fulfill({ json: { ...result, operation: { ...result.operation, status: 'unknown', error: 'Connection lost; outcome unknown.', clip: null } } });
    }
    const id = new URL(route.request().url()).searchParams.get('operationId');
    if (id) {
      reads++; expect(id).toBe(operationId);
      expect(new URL(route.request().url()).searchParams.get('reconcile')).toBe(reads === 1 ? '1' : null);
      if (expired) return route.fulfill({ status: 410, json: { ok: false, error: { code: 'INVALID_REQUEST', message: 'Retention expired', retryable: false }, unavailable: { operationId, reason: 'expired' } } });
    }
    await route.continue();
  });
  let panel = await workbench(page);
  await panel.getByRole('checkbox', { name: /I confirm one/ }).check();
  await panel.getByRole('button', { name: 'Generate one clip' }).click();
  await expect(panel.getByRole('button', { name: 'Check existing request', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Generate one clip' })).toBeDisabled();
  await waitForSaved(page); expect(posts).toBe(1); expect(reads).toBe(0);
  await page.reload(); await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await page.getByRole('tab', { name: 'Visuals' }).click(); panel = page.getByRole('tabpanel', { name: 'Visuals' });
  await expect(panel.getByRole('button', { name: 'Check existing request', exact: true })).toBeVisible();
  await expect(panel.getByRole('checkbox', { name: /I confirm one/ })).toBeDisabled(); expect(reads).toBe(0);
  await panel.getByRole('button', { name: 'Check existing request', exact: true }).click();
  if (expired) {
    await expect(panel).toContainText('retained result expired and cannot be replayed');
    await expect(panel.getByRole('button', { name: 'Check existing request', exact: true })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Generate one clip' })).toBeDisabled();
    await expect(panel.getByRole('checkbox', { name: /I confirm one/ })).not.toBeChecked();
    expect(reads).toBe(1);
  } else await expect(panel.getByRole('button', { name: 'Approve clip', exact: true })).toBeEnabled({ timeout: 15000 });
  expect(posts).toBe(1);
});
for (const approved of [false, true]) test(`empty-store backup restores images but cannot ${approved ? 'render an approved' : 'approve a'} metadata-only video`, async ({ page, browser, baseURL }) => {
  const panel = await workbench(page);
  await panel.getByRole('checkbox', { name: /I confirm one/ }).check();
  await panel.getByRole('button', { name: 'Generate one clip' }).click();
  await expect(panel.getByRole('button', { name: 'Approve clip', exact: true })).toBeEnabled({ timeout: 15000 });
  if (approved) await panel.getByRole('button', { name: 'Approve clip', exact: true }).click();
  await waitForSaved(page);
  await page.getByRole('button', { name: 'Project backup and restore' }).click();
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download backup' }).click();
  const backup = await downloading; const path = (await backup.path())!;
  const context = await browser.newContext({ baseURL }); const restored = await context.newPage(); let posts = 0;
  try {
    restored.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts++; });
    await restored.goto('/'); await expect(restored.locator('main[data-ready="true"]')).toBeVisible();
    await restored.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Explore the sample/ }).click();
    await restored.getByRole('button', { name: 'Project backup and restore' }).click();
    await restored.getByLabel('Choose a Cineserye project backup').setInputFiles(path);
    await confirmCineseryeDialog(restored, 'Restore backup');
    await expect(restored.getByText(/Project backup restored/)).toBeVisible();
    await restored.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
    await restored.getByRole('tab', { name: 'Visuals' }).click();
    const media = restored.getByRole('tabpanel', { name: 'Visuals' });
    await expect(media.locator('.storyboard-frame img')).toHaveCount(3);
    await expect.poll(() => media.locator('.storyboard-frame img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await expect(media.locator('.video-missing')).toContainText('Local clip unavailable');
    if (approved) {
      await expect(media.locator('.video-version').getByRole('button', { name: 'Approved', exact: true })).toBeDisabled();
      await waitForSaved(restored); await restored.goto('/?flow=simplified&workspace=edit');
      const cut = restored.getByRole('region', { name: 'Review sequence', exact: true });
      await expect(cut).toContainText('Clip bytes are missing in this browser.');
      await expect(cut).toContainText('this backup cannot restore the video.');
      await expect(cut.getByRole('button', { name: 'Render silent MP4 locally' })).toBeDisabled();
      expect(posts).toBe(0); return;
    }
    await expect(media.getByRole('button', { name: 'Approve clip', exact: true })).toBeDisabled();
    await waitForSaved(restored); await restored.reload(); await expect(restored.locator('main[data-ready="true"]')).toBeVisible();
    await restored.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click(); await restored.getByRole('tab', { name: 'Visuals' }).click();
    await expect(restored.getByRole('button', { name: 'Approve clip', exact: true })).toBeDisabled(); expect(posts).toBe(0);
  } finally { await context.close(); }
});
