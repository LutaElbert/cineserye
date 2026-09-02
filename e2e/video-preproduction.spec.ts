import { expect, test } from '@playwright/test';
import { waitForSaved } from './helpers';

async function openVideoWorkbench(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Explore the sample/ }).click();
  if ((page.viewportSize()?.width ?? 1_000) <= 720) {
    await page.getByRole('button', { name: 'Open properties panel' }).click();
  } else {
    await page.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  }
  await page.getByRole('tab', { name: 'Visuals' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Visuals' });
  await panel.getByRole('checkbox', { name: /I confirm the .* direction/ }).check();
  await panel.getByRole('button', { name: 'Generate storyboard' }).click();
  await expect(panel.locator('.storyboard-frame')).toHaveCount(3, { timeout: 10_000 });
  await panel.locator('.storyboard-frame').first().getByRole('button', { name: 'Approve' }).click();
  await expect(panel.getByText('Animate approved frame', { exact: true })).toBeVisible();
  return panel;
}

test('S6-E2E-01 approved frame becomes one reviewable and independently approved clip', async ({ page }) => {
  const panel = await openVideoWorkbench(page);
  await expect(panel.getByText(/one silent clip/)).toBeVisible();
  await panel.getByRole('checkbox', { name: /I confirm one 4s 720p silent clip/ }).check();
  await panel.getByRole('button', { name: 'Generate one clip' }).click();
  await expect(panel.locator('.video-version')).toHaveCount(1, { timeout: 10_000 });
  await expect(panel.locator('.video-version')).toContainText('Clip candidate');
  await expect(panel.locator('.video-version video')).toBeVisible();
  await panel.getByRole('button', { name: 'Approve clip' }).click();
  await expect(panel.locator('.video-version')).toContainText('Approved clip');
  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await page.getByRole('tab', { name: 'Visuals' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Visuals' }).locator('.video-version')).toContainText('Approved clip');
});

test('S6-E2E-02 setting changes invalidate confirmation and recompute the preflight estimate', async ({ page }) => {
  const panel = await openVideoWorkbench(page);
  const consent = panel.getByRole('checkbox', { name: /I confirm one/ });
  await consent.check();
  await panel.getByLabel('Video duration').selectOption('8');
  await expect(consent).not.toBeChecked();
  await expect(panel.getByRole('button', { name: 'Generate one clip' })).toBeDisabled();
  await expect(panel.getByText('$0.00 USD', { exact: true })).toBeVisible();
});

test('S6-E2E-03 cancel and linked retry remain keyboard-operable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = await openVideoWorkbench(page);
  const consent = panel.getByRole('checkbox', { name: /I confirm one 4s 720p silent clip/ });
  await consent.focus();
  await page.keyboard.press('Space');
  await panel.getByRole('button', { name: 'Generate one clip' }).click();
  const cancel = panel.getByRole('button', { name: 'Cancel' });
  await expect(cancel).toBeVisible();
  await cancel.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/fixture operation was cancelled/)).toBeVisible();
  await consent.check();
  const retry = panel.getByRole('button', { name: /Retry as a new linked operation/ });
  await expect(retry).toBeEnabled();
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(panel.locator('.video-version')).toHaveCount(1, { timeout: 10_000 });
});
