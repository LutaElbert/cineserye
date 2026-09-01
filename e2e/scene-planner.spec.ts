import { expect, test } from '@playwright/test';
import { waitForSaved } from './helpers';

test('previews, inspects, accepts, rejects, and undoes the local mock shot plan', async ({ page, baseURL }) => {
  const externalRequests: string[] = [];
  const appOrigin = new URL(baseURL ?? page.url()).origin;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== appOrigin) externalRequests.push(request.url());
  });

  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plan scene' })).toBeDisabled();
  await page.getByRole('button', { name: 'Scene 01', exact: true }).click();
  await page.getByRole('button', { name: 'Plan scene' }).click();

  let brief = page.getByRole('dialog', { name: 'Plan this scene' });
  await expect(brief.getByLabel('Selected scene text')).toHaveValue('Scene 01');
  await expect(brief.getByLabel('Tone', { exact: true })).toHaveValue('Restrained supernatural suspense');
  await expect(brief.getByLabel('Location and period', { exact: true })).toHaveValue('Manila single-screen cinema · late 1980s');
  await brief.getByRole('button', { name: 'Cancel' }).click();
  await expect(brief).toHaveCount(0);
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();

  await page.getByRole('button', { name: 'Plan scene' }).click();
  brief = page.getByRole('dialog', { name: 'Plan this scene' });
  await brief.getByLabel('Tone', { exact: true }).fill('');
  await brief.getByRole('button', { name: 'Research and draft shots' }).click();
  await expect(brief.getByRole('alert')).toContainText('Tone is required');
  await brief.getByLabel('Tone', { exact: true }).fill('Claustrophobic suspense');
  await brief.getByLabel('Optional ceiling (PHP)').fill('900');
  await brief.getByRole('button', { name: 'Research and draft shots' }).click();

  const review = page.getByRole('region', { name: 'Mock shot proposal review' });
  await expect(review).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project Outline' })).toBeVisible();
  const outline = page.getByRole('navigation', { name: 'Project outline' });
  await expect(outline).toContainText('6 shots · 36s');
  await expect(outline).toContainText('₱820');
  await expect(outline.getByRole('button', { name: 'Planning 1', exact: true })).toBeVisible();
  await expect(outline.getByRole('button', { name: 'Characters 1', exact: true })).toBeVisible();
  await expect(outline.getByRole('button', { name: 'Locations 1', exact: true })).toBeVisible();
  await expect(outline.getByRole('button', { name: 'Props 2', exact: true })).toBeVisible();
  await expect(outline.getByRole('button', { name: 'Visual Elements 1', exact: true })).toBeVisible();
  const shotNames = await outline.locator('[aria-label="Shots nodes"] .outline-item-main').evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute('aria-label')),
  );
  expect(shotNames).toEqual([
    '01 · Entering the Auditorium',
    '02 · Projector Awakens',
    '03 · The Impossible Film',
    '04 · Someone Behind Her',
    '05 · Empty Auditorium',
    '06 · The Figure Moves Closer',
  ]);
  await outline.getByRole('button', { name: 'Collapse Props' }).click();
  await expect(outline.getByRole('button', { name: 'Vintage Projector', exact: true })).toHaveCount(0);
  await outline.getByRole('button', { name: 'Expand Props' }).click();
  await outline.getByRole('button', { name: 'Vintage Projector', exact: true }).click();
  await expect(page.locator('.react-flow__node.selected').filter({ hasText: 'Vintage Projector' })).toBeVisible();
  await outline.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await expect(page.locator('.react-flow__node.proposal-ghost-node')).toHaveCount(14);
  await expect(page.getByLabel('Choose images to add to the canvas')).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Scene planner' })).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: /Prompt/ })).toContainText('Vertex · Veo');
  await expect(page.getByRole('tabpanel', { name: /Prompt/ })).toContainText('Inherits Mara, Abandoned Cinema, Vintage Projector');

  await page.getByRole('tab', { name: 'Cost' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Cost' })).toContainText('₱185');
  await review.getByRole('button', { name: 'Accept plan' }).click();

  await expect(review).toHaveCount(0);
  await expect(page.locator('.react-flow__node.proposal-ghost-node')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '06 · The Figure Moves Closer', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project Outline' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: '06 · The Figure Moves Closer', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Shot 01', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Layers' })).toBeVisible();

  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('button', { name: '06 · The Figure Moves Closer', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project Outline' })).toBeVisible();
  await waitForSaved(page);
  const storedCinema = await page.evaluate(() => new Promise<{
    schemaVersion: number;
    shotCount: number;
    tone: string;
    budgetCeiling: number;
  }>((resolve, reject) => {
    const request = indexedDB.open('cineserye-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const stored = database.transaction('documents', 'readonly').objectStore('documents').get('current');
      stored.onerror = () => reject(stored.error);
      stored.onsuccess = () => {
        resolve({
          schemaVersion: stored.result.cinema.schemaVersion,
          shotCount: Object.keys(stored.result.cinema.shots).length,
          tone: stored.result.cinema.scenes['scene-01'].brief.tone,
          budgetCeiling: stored.result.cinema.scenes['scene-01'].brief.budgetCeiling,
        });
        database.close();
      };
    };
  }));
  expect(storedCinema).toEqual({
    schemaVersion: 1,
    shotCount: 6,
    tone: 'Claustrophobic suspense',
    budgetCeiling: 900,
  });

  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project Outline' })).toBeVisible();
  await expect(page.getByRole('button', { name: '06 · The Figure Moves Closer', exact: true })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Layers' })).toBeVisible();

  await page.getByRole('button', { name: 'Scene 01', exact: true }).click();
  await page.getByRole('button', { name: 'Plan scene' }).click();
  await page.getByRole('dialog', { name: 'Plan this scene' })
    .getByRole('button', { name: 'Research and draft shots' })
    .click();
  await expect(review).toBeVisible();
  await review.getByRole('button', { name: 'Reject' }).click();
  await expect(review).toHaveCount(0);
  await expect(page.getByRole('button', { name: '06 · The Figure Moves Closer', exact: true })).toHaveCount(0);
  expect(externalRequests).toEqual([]);
});

test('keeps the one-scene brief keyboard-accessible on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();

  await page.locator('.react-flow__node').filter({ hasText: 'Scene 01' }).click();
  const planButton = page.getByRole('button', { name: 'Plan scene' });
  await expect(planButton).toBeEnabled();
  await planButton.focus();
  await page.keyboard.press('Enter');

  const brief = page.getByRole('dialog', { name: 'Plan this scene' });
  await expect(brief).toBeVisible();
  await expect(brief.getByLabel('Tone', { exact: true })).toBeFocused();
  const bounds = await brief.boundingBox();
  expect(bounds).toBeTruthy();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

  await page.keyboard.press('Escape');
  await expect(brief).toHaveCount(0);
  await expect(planButton).toBeFocused();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});
