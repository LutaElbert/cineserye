import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDiagramPng, waitForSaved } from './helpers';

async function openAcceptedSample(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const chooser = page.getByRole('dialog', { name: /Start with your scene/ });
  await chooser.getByRole('button', { name: /Explore the sample/ }).click();
  await page.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await page.getByRole('tab', { name: 'Visuals' }).click();
}

async function openReferenceManager(panel: import('@playwright/test').Locator) {
  const manager = panel.locator('#scene-reference-manager');
  if (!await manager.isVisible()) await panel.getByRole('button', { name: /approved refs?/ }).click();
  await expect(manager).toBeVisible();
}

test('S4-UX-01 prioritizes the shot workbench, collapses reference management, and keeps five tabs on one row', async ({ page }) => {
  await openAcceptedSample(page);
  const panel = page.getByRole('tabpanel', { name: 'Visuals' });
  await expect(panel.getByText('The Impossible Film', { exact: true })).toBeVisible();
  await expect(panel.getByText('Prompt v1')).toBeVisible();
  await expect(panel.locator('#scene-reference-manager')).toBeHidden();
  await expect(panel.getByRole('button', { name: '3 storyboard variants' })).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByLabel('Storyboard creative intent')).toHaveValue('balanced');

  const tabTops = await page.locator('.inspector-tabs').getByRole('tab').evaluateAll((tabs) => tabs.map((tab) => Math.round(tab.getBoundingClientRect().top)));
  expect(new Set(tabTops).size).toBe(1);

  await panel.getByRole('button', { name: /approved refs?/ }).click();
  await expect(panel.locator('#scene-reference-manager')).toBeVisible();
  await panel.getByRole('button', { name: /^\d+ references?$/ }).click();
  await expect(panel.locator('#scene-reference-manager')).toBeHidden();
});

test('S3-E2E-01 creates a rights-aware reference deck and inherits shot attachments', async ({ page, baseURL }) => {
  const externalRequests: string[] = [];
  const appOrigin = new URL(baseURL ?? page.url()).origin;
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== appOrigin) externalRequests.push(request.url());
  });
  await openAcceptedSample(page);
  const panel = page.getByRole('tabpanel', { name: 'Visuals' });
  await openReferenceManager(panel);
  await panel.getByLabel('Reference link title').fill('Silent-era composition study');
  await panel.getByLabel('HTTPS inspiration link').fill('https://example.com/inspiration');
  await panel.getByRole('button', { name: 'Add link' }).click();
  const linkCard = panel.locator('.reference-card').filter({ hasText: 'Silent-era composition study' });
  await linkCard.getByRole('button', { name: 'Attach to shot' }).click();
  await expect(panel).toContainText('Inspiration-only references are excluded automatically');
  await page.getByRole('tab', { name: /Prompt/ }).click();
  await expect(page.getByRole('tabpanel', { name: /Prompt/ })).toContainText('1 visual reference attached; rights gates apply before generation');
  expect(externalRequests).toEqual([]);
});

test('S3-E2E-02 and S4-E2E-01 upload an approved reference and create three reviewable offline variants', async ({ page, baseURL }) => {
  const externalRequests: string[] = [];
  const appOrigin = new URL(baseURL ?? page.url()).origin;
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== appOrigin) externalRequests.push(request.url());
  });
  await openAcceptedSample(page);
  const panel = page.getByRole('tabpanel', { name: 'Visuals' });
  await openReferenceManager(panel);
  await panel.locator('.reference-upload input').setInputFiles({
    name: 'mara-owned-reference.png',
    mimeType: 'image/png',
    buffer: await createDiagramPng(page),
  });
  await expect(panel.locator('.reference-card')).toHaveCount(1);
  await panel.locator('.reference-upload input').setInputFiles({
    name: 'mara-owned-reference-duplicate.png',
    mimeType: 'image/png',
    buffer: await createDiagramPng(page),
  });
  await expect(panel.locator('.reference-card')).toHaveCount(2);
  const storedMediaCount = await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open('cineserye-local', 6);
    open.onsuccess = () => {
      const count = open.result.transaction('media-blobs').objectStore('media-blobs').count();
      count.onsuccess = () => { resolve(count.result); open.result.close(); };
      count.onerror = () => reject(count.error);
    };
    open.onerror = () => reject(open.error);
  }));
  expect(storedMediaCount).toBe(1);
  const reference = panel.locator('.reference-card').filter({ hasText: 'mara-owned-reference' }).first();
  await reference.getByLabel('Type').selectOption('character');
  await reference.getByLabel('Rights').selectOption('creator-owned');
  await reference.getByRole('checkbox', { name: 'Allow for image generation' }).check();
  await reference.getByRole('button', { name: 'Approve' }).click();
  await reference.getByRole('button', { name: 'Attach to shot' }).click();
  await expect(panel).toContainText('1 approved ref');
  await panel.getByLabel('Storyboard creative intent').selectOption('budget-conscious');
  await panel.getByRole('checkbox', { name: /I confirm the .* direction/ }).check();
  await panel.getByRole('button', { name: 'Generate storyboard' }).click();
  await expect(panel.locator('.storyboard-frame')).toHaveCount(3, { timeout: 10_000 });
  await expect(panel).toContainText('fixture-cinematic-board-v1');
  await expect(panel.locator('.storyboard-frame').first()).toContainText('budget conscious');
  await panel.locator('.storyboard-frame').nth(1).getByRole('button', { name: 'Approve' }).click();
  await expect(panel.locator('.storyboard-frame').nth(1)).toContainText('Approved anchor');
  await expect(panel.locator('.storyboard-frame').filter({ hasText: 'Approved anchor' })).toHaveCount(1);
  await waitForSaved(page);
  expect(externalRequests).toEqual([]);
});

test('S3-E2E-03 and S4-E2E-02 restore the approved anchor and portable local pixels', async ({ page }) => {
  await openAcceptedSample(page);
  const panel = page.getByRole('tabpanel', { name: 'Visuals' });
  await panel.getByRole('checkbox', { name: /I confirm the .* direction/ }).check();
  await panel.getByRole('button', { name: 'Generate storyboard' }).click();
  await expect(panel.locator('.storyboard-frame')).toHaveCount(3, { timeout: 10_000 });
  await panel.locator('.storyboard-frame').first().getByRole('button', { name: 'Approve' }).click();
  await waitForSaved(page);
  await page.getByRole('button', { name: 'Project backup and restore' }).click();
  const backupDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const download = await backupDownload;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const envelope = JSON.parse(await readFile(downloadPath!, 'utf8')) as { version: number; media: Array<{ hash: string; base64: string }> };
  expect(envelope.version).toBe(6);
  expect(envelope.media).toHaveLength(3);
  expect(envelope.media.every((media) => /^[a-f0-9]{64}$/.test(media.hash) && media.base64.length > 20)).toBe(true);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Choose a Cineserye project backup').setInputFiles(downloadPath!);
  await expect(page.getByText(/Project backup restored\./)).toBeVisible();
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await page.getByRole('tab', { name: 'Visuals' }).click();
  const restored = page.getByRole('tabpanel', { name: 'Visuals' });
  await expect(restored.locator('.storyboard-frame')).toHaveCount(3);
  await expect(restored.getByRole('button', { name: 'Approved anchor' })).toHaveCount(1);
  await expect(restored.locator('.storyboard-frame img')).toHaveCount(3);
});

test('S4-E2E-03 cancels cleanly and permits an explicit retry', async ({ page }) => {
  await openAcceptedSample(page);
  const panel = page.getByRole('tabpanel', { name: 'Visuals' });
  await panel.getByRole('checkbox', { name: /I confirm the .* direction/ }).check();
  await panel.getByRole('button', { name: '4 storyboard variants' }).click();
  await expect(panel.getByRole('checkbox', { name: /I confirm the .* direction/ })).not.toBeChecked();
  await expect(panel.getByRole('button', { name: 'Generate storyboard' })).toBeDisabled();
  await panel.getByRole('button', { name: '3 storyboard variants' }).click();
  await panel.getByRole('checkbox', { name: /I confirm the .* direction/ }).check();
  await panel.getByRole('button', { name: 'Generate storyboard' }).click();
  await panel.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Storyboard generation cancelled.')).toBeVisible();
  await expect(panel.locator('.storyboard-frame')).toHaveCount(0);
  await panel.getByRole('checkbox', { name: /I confirm the .* direction/ }).check();
  await panel.getByRole('button', { name: 'Generate storyboard' }).click();
  await expect(panel.locator('.storyboard-frame')).toHaveCount(3);
});

test('S3-SEC-01 and S4-IT-02 reject unapproved references and excessive outputs at the API boundary', async ({ request }) => {
  const base = {
    version: 1,
    idempotencyKey: 'storyboard-boundary-test',
    shotId: 'shot-01',
    revisionId: 'revision-01',
    acceptedPlan: true,
    prompt: { id: 'prompt-01', version: 1, text: 'Safe storyboard still.', purpose: 'storyboard', status: 'draft' },
    settings: { aspectRatio: '9:16', outputCount: 1, intent: 'balanced' },
    explicitConfirmation: true,
    liveProviderConsent: false,
  };
  const unapproved = await request.post('/api/cinema/generate-storyboard', { data: {
    ...base,
    references: [{
      id: 'reference-01', title: 'Unknown image', rightsStatus: 'creator-owned', approvalStatus: 'pending',
      allowedUses: ['research'], mimeType: 'image/png', base64: 'AAAA',
    }],
  } });
  expect(unapproved.status()).toBe(400);
  const excessive = await request.post('/api/cinema/generate-storyboard', { data: {
    ...base,
    references: [],
    settings: { aspectRatio: '9:16', outputCount: 5, intent: 'balanced' },
  } });
  expect(excessive.status()).toBe(400);
});
