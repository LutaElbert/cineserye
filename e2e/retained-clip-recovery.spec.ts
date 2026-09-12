import { expect, test } from '@playwright/test';
import { confirmCineseryeDialog, waitForSaved } from './helpers';

for (const retained of ['available', 'expired', 'different-bytes'] as const) test(`restored approved clip recovers only its identical retained bytes: ${retained}`, async ({ page, browser, baseURL }) => {
  await page.goto('/'); await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Explore the sample/ }).click();
  await page.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await page.getByRole('tab', { name: 'Visuals' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Visuals' });
  await panel.getByRole('checkbox', { name: /I confirm the .* direction/ }).check();
  await panel.getByRole('button', { name: 'Generate storyboard' }).click();
  await expect(panel.locator('.storyboard-frame')).toHaveCount(3);
  await panel.locator('.storyboard-frame').first().getByRole('button', { name: 'Approve', exact: true }).click();
  await panel.getByRole('checkbox', { name: /I confirm one/ }).check();
  await panel.getByRole('button', { name: 'Generate one clip' }).click();
  await expect(panel.getByRole('button', { name: 'Approve clip', exact: true })).toBeEnabled({ timeout: 15000 });
  await panel.getByRole('button', { name: 'Approve clip', exact: true }).click(); await waitForSaved(page);
  await page.getByRole('button', { name: 'Project backup and restore' }).click();
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download backup' }).click();
  const path = (await (await downloading).path())!;
  const context = await browser.newContext({ baseURL }), restored = await context.newPage();
  let posts = 0, reads = 0;
  try {
    restored.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts++; });
    await restored.route('**/api/cinema/generate-video?**', async route => {
      const operationId = new URL(route.request().url()).searchParams.get('operationId');
      if (!operationId) return route.continue();
      reads++;
      if (retained === 'expired') return route.fulfill({ status: 410, json: { ok: false,
        error: { code: 'INVALID_REQUEST', message: 'Expired', retryable: false }, unavailable: { operationId, reason: 'expired' } } });
      if (retained === 'different-bytes') {
        const response = await route.fetch({ headers: { ...route.request().headers(), 'accept-encoding': 'identity' } });
        const result = await response.json(), bytes = Buffer.from(result.operation.clip.base64, 'base64');
        bytes[bytes.length - 1] ^= 1; result.operation.clip.base64 = bytes.toString('base64');
        return route.fulfill({ json: result });
      }
      await route.continue();
    });
    await restored.goto('/'); await expect(restored.locator('main[data-ready="true"]')).toBeVisible();
    await restored.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Explore the sample/ }).click();
    await restored.getByRole('button', { name: 'Project backup and restore' }).click();
    await restored.getByLabel('Choose a Cineserye project backup').setInputFiles(path);
    await confirmCineseryeDialog(restored, 'Restore backup');
    await expect(restored.getByText(/Project backup restored/)).toBeVisible();
    await restored.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
    await restored.getByRole('tab', { name: 'Visuals' }).click();
    const media = restored.getByRole('tabpanel', { name: 'Visuals' });
    await expect(media.locator('.video-missing')).toBeVisible(); expect(reads).toBe(0); expect(posts).toBe(0);
    await media.getByRole('button', { name: 'Recover from existing request', exact: true }).click({ timeout: 15000 });
    if (retained === 'available') {
      await expect(media).toContainText('Identical video bytes recovered.');
      await expect.poll(() => media.locator('.video-version video').evaluateAll(elements => elements.some(element => (element as HTMLVideoElement).readyState >= 1 && (element as HTMLVideoElement).videoWidth > 0))).toBe(true);
      await expect(media.getByRole('button', { name: 'Approved', exact: true })).toBeDisabled();
      await restored.reload(); await expect(restored.locator('main[data-ready="true"]')).toBeVisible();
      await restored.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click(); await restored.getByRole('tab', { name: 'Visuals' }).click();
      await expect(restored.getByRole('tabpanel', { name: 'Visuals' }).locator('.video-version video')).toBeVisible();
    } else {
      await expect(media).toContainText(retained === 'expired' ? 'No retained result is available here.' : 'does not match its saved hash');
      await expect(media.locator('.video-missing')).toBeVisible();
    }
    expect(reads).toBe(1); expect(posts).toBe(0);
  } finally { await context.close(); }
});
