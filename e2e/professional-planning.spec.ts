import { expect, test } from '@playwright/test';
import { waitForSaved } from './helpers';

async function openAcceptedSample(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible({ timeout: 10_000 });
  const chooser = page.getByRole('dialog', { name: /Start with your scene/ });
  await chooser.getByRole('button', { name: /Explore the sample/ }).click();
  await expect(page.getByRole('button', { name: 'Shot table' })).toBeVisible();
}

test('S5-E2E-01 switches canvas, table, and board while keeping shot edits synchronized', async ({ page }) => {
  await openAcceptedSample(page);
  await page.getByRole('button', { name: 'Shot table' }).click();
  const workspace = page.getByRole('region', { name: 'Professional shot planning workspace' });
  await expect(workspace).toBeVisible();
  await expect(workspace.getByRole('table', { name: 'Editable narrative shot list and production order' })).toBeVisible();
  const framing = workspace.getByLabel(/Entering the Auditorium framing/);
  await framing.fill('Handheld medium-wide');
  await framing.press('Tab');
  await expect(page.getByText('Entering the Auditorium updated.', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await expect(page.locator('.react-flow')).toBeVisible();
  await page.getByRole('button', { name: '01 · Entering the Auditorium', exact: true }).click();
  await expect(page.locator('.react-flow__node').filter({ hasText: '01 · Entering the Auditorium' })).toContainText('Handheld medium-wide');

  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await expect(workspace.locator('.storyboard-production-card')).toHaveCount(6);
  await expect(workspace).toContainText('Production 1');
  await page.getByRole('button', { name: 'Shot table' }).click();
  await expect(framing).toHaveValue('Handheld medium-wide');
  await waitForSaved(page);
});

test('S5-E2E-02 changes production order and setup without changing narrative order', async ({ page }) => {
  await openAcceptedSample(page);
  await page.getByRole('button', { name: 'Shot table' }).click();
  const workspace = page.getByRole('region', { name: 'Professional shot planning workspace' });
  const rows = workspace.locator('.shot-planning-table tbody tr');
  await expect(rows).toHaveCount(6);
  const firstNarrativeId = await rows.first().getAttribute('data-shot-id');
  const secondRow = rows.nth(1);
  await secondRow.getByRole('button', { name: /Move .* earlier in production order/ }).click();
  await expect(page.getByText('Production order updated.', { exact: true })).toBeVisible();

  await workspace.getByRole('button', { name: 'Add setup' }).click();
  await workspace.getByRole('textbox', { name: 'Name', exact: true }).fill('Projector inserts');
  await workspace.getByRole('textbox', { name: 'Camera', exact: true }).fill('Phone camera');
  await workspace.getByRole('textbox', { name: 'Lighting', exact: true }).fill('Projector practical');
  await workspace.getByRole('button', { name: 'Save setup' }).click();
  await expect(workspace).toContainText('Projector inserts');
  await rows.first().getByLabel(/production setup/).selectOption({ label: 'Projector inserts' });
  await expect(page.getByText(/moved to Projector inserts/)).toBeVisible();

  expect(await rows.first().getAttribute('data-shot-id')).toBe(firstNarrativeId);
  await expect(rows.first().locator('.production-order-control > span')).toHaveText('2');
  await expect(rows.nth(1).locator('.production-order-control > span')).toHaveText('1');
  await expect(workspace.locator('.setup-card-grid article')).toHaveCount(2);
});

test('S5-E2E-03 keeps the phone checklist, board, continuity, and local export usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAcceptedSample(page);
  await page.getByRole('button', { name: 'Shot table' }).click();
  const workspace = page.getByRole('region', { name: 'Professional shot planning workspace' });
  const bounds = await workspace.boundingBox();
  expect(bounds).toBeTruthy();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  const firstStatus = workspace.getByLabel(/production status/).first();
  await firstStatus.selectOption('ready');
  await expect(firstStatus).toHaveValue('ready');

  const continuityInputs = workspace.locator('.continuity-table input');
  if (await continuityInputs.count() > 1) {
    await continuityInputs.first().fill('screen-left');
    await continuityInputs.first().press('Tab');
    await expect(workspace.getByText(/Continuity review needed/)).toBeVisible();
  }

  await workspace.getByRole('button', { name: 'Board' }).click();
  await expect(workspace.locator('.storyboard-production-card')).toHaveCount(6);
  await expect(workspace.locator('.storyboard-production-card').first()).toHaveClass(/status-ready/);

  const downloads: string[] = [];
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  await workspace.getByRole('button', { name: 'Export handoff' }).click();
  await expect(page.getByText(/6-file handoff exported locally/)).toBeVisible();
  await expect.poll(() => downloads.length).toBe(1);
  expect(downloads[0]).toMatch(/-handoff\.zip$/);
});
