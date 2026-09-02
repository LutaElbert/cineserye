import { expect, test, type Page } from '@playwright/test';
import { waitForSaved } from './helpers';

async function chooseStartScene(page: Page) {
  await expect(page.locator('main[data-ready="true"]')).toBeVisible({ timeout: 10_000 });
  const chooser = page.getByRole('dialog', { name: /Start with your scene/ });
  await expect(chooser).toBeVisible();
  await chooser.getByRole('button', { name: /Start a scene/ }).click();
  await expect(chooser).toHaveCount(0);
}

async function editSceneText(page: Page, text: string) {
  const scene = page.locator('.react-flow__node').filter({ hasText: 'Scene 01' }).first();
  await scene.locator('.concept-node').dblclick();
  await page.locator('.concept-body-editor').fill(text);
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await scene.click();
}

async function overlappingVisibleNodePairs(page: Page) {
  return page.locator('.react-flow__node').evaluateAll((elements) => {
    const nodes = elements
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((element) => ({
        label: element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) ?? 'Unnamed node',
        rectangle: element.getBoundingClientRect(),
      }));
    const overlaps: string[] = [];
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        const a = nodes[left];
        const b = nodes[right];
        if (
          a.rectangle.left < b.rectangle.right
          && a.rectangle.right > b.rectangle.left
          && a.rectangle.top < b.rectangle.bottom
          && a.rectangle.bottom > b.rectangle.top
        ) overlaps.push(`${a.label} <> ${b.label}`);
      }
    }
    return overlaps;
  });
}

async function expectVisibleNodesNotToOverlap(page: Page) {
  await expect.poll(() => overlappingVisibleNodePairs(page), { timeout: 5_000 }).toEqual([]);
}

test('offers a clean start or a deterministic local sample only on genuine first launch', async ({ page, baseURL }) => {
  const externalRequests: string[] = [];
  const appOrigin = new URL(baseURL ?? page.url()).origin;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== appOrigin) externalRequests.push(request.url());
  });

  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const chooser = page.getByRole('dialog', { name: /Start with your scene/ });
  await expect(chooser.getByRole('button', { name: /Start a scene/ })).toBeVisible();
  await expect(chooser.getByRole('button', { name: /Explore the sample/ })).toBeVisible();
  await expect(chooser).toContainText('Fixture mode');
  await chooser.getByRole('button', { name: /Explore the sample/ }).click();

  await expect(page.getByRole('heading', { name: 'Project Outline' })).toBeVisible();
  await expect(page.getByRole('button', { name: '06 · The Figure Moves Closer', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create revision' })).toBeVisible();
  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(chooser).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Project Outline' })).toBeVisible();
  expect(externalRequests).toEqual([]);
});

test('generates, curates, accepts, rejects, and persists a trustworthy fixture shot plan', async ({ page, baseURL }) => {
  const externalRequests: string[] = [];
  const appOrigin = new URL(baseURL ?? page.url()).origin;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== appOrigin) externalRequests.push(request.url());
  });

  await page.goto('/');
  await chooseStartScene(page);
  await expect(page.getByText('Fixture mode', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.plan-scene-button')).toBeDisabled();
  await editSceneText(page, 'Mara enters an abandoned cinema and sees her immediate future projected on screen.');
  await expect(page.locator('.plan-scene-button')).toBeEnabled();
  await page.locator('.plan-scene-button').click();

  let brief = page.getByRole('dialog', { name: 'Generate shot plan' });
  await expect(brief.getByLabel(/Send this scene brief/)).toHaveCount(0);
  await expect(brief.getByLabel('Selected scene text')).toContainText('Mara enters an abandoned cinema');
  await expect(brief).toContainText('AI-generation budget');
  await expect(brief).toContainText('Physical-production constraints');
  await brief.getByRole('button', { name: 'Generate shot plan' }).click();
  await expect(brief.getByRole('alert')).toContainText('Genre and tone is required');
  await brief.getByLabel('Genre and tone').fill('Claustrophobic suspense');
  await brief.getByLabel('Location and period').fill('Contemporary Manila single-screen cinema');
  await brief.getByLabel('Target duration (seconds)').fill('42');
  await brief.getByLabel('Required beats (optional)').fill('Projector awakens\nMara recognizes herself\nA figure approaches');
  await brief.getByLabel('Must include (optional)').fill('Metal flashlight\nVintage projector');
  await brief.getByLabel('Must avoid (optional)').fill('Gore\nVisible brands');
  await brief.getByLabel('AI-generation pricing basis').selectOption('currency');
  await brief.getByLabel('Optional AI-generation ceiling').fill('700');
  await brief.getByLabel('Optional physical-production ceiling').fill('50000');
  await brief.getByLabel('Available equipment (optional)').fill('Phone camera\nTripod\nMetal flashlight');
  await brief.getByRole('button', { name: 'Generate shot plan' }).click();

  const review = page.getByRole('region', { name: 'Shot proposal review' });
  await expect(review).toBeVisible();
  await expectVisibleNodesNotToOverlap(page);
  await expect(page.getByRole('button', { name: 'Review shot plan' })).toBeVisible();
  const outline = page.getByRole('navigation', { name: 'Project outline' });
  await expect(outline).toContainText('6 shots · 42s');
  await expect(outline).toContainText('₱820');
  await outline.getByRole('button', { name: 'Scene 01 · The Abandoned Cinema', exact: true }).click();
  await page.getByRole('tab', { name: 'Cost' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Cost' })).toContainText('above the ₱700 AI-generation ceiling');
  await expect(page.getByRole('tabpanel', { name: 'Cost' })).toContainText('Physical-production constraints are tracked separately');

  await outline.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await page.getByRole('tab', { name: 'Sources' }).click();
  const sourcePanel = page.getByRole('tabpanel', { name: 'Sources' });
  const sourceCard = sourcePanel.locator('.source-card').first();
  await expect(sourceCard).toContainText('Retrieved');
  await expect(sourceCard).toContainText('Used by');
  await sourceCard.getByRole('button', { name: 'Irrelevant' }).click();
  await expect(sourceCard.getByText('irrelevant', { exact: true })).toBeVisible();
  await sourceCard.getByRole('button', { name: 'Supported' }).click();
  await sourceCard.getByRole('button', { name: 'Pin' }).click();
  await expect(sourceCard.getByRole('button', { name: 'Unpin' })).toBeVisible();

  await review.getByRole('button', { name: 'Accept plan' }).click();
  await expect(review).toHaveCount(0);
  await expectVisibleNodesNotToOverlap(page);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Shot 01', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('button', { name: '06 · The Figure Moves Closer', exact: true })).toBeVisible();
  await expectVisibleNodesNotToOverlap(page);

  await waitForSaved(page);
  const storedCinema = await page.evaluate(() => new Promise<{
    briefVersion: number;
    creationMode: string;
    generationCeiling: number | null;
    productionCeiling: number | null;
    sourcePinned: boolean;
  }>((resolve, reject) => {
    const request = indexedDB.open('cineserye-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const stored = database.transaction('documents', 'readonly').objectStore('documents').get('current');
      stored.onerror = () => reject(stored.error);
      stored.onsuccess = () => {
        const briefValue = stored.result.cinema.scenes['scene-01'].brief;
        resolve({
          briefVersion: briefValue.version,
          creationMode: briefValue.creationMode,
          generationCeiling: briefValue.generationBudget.ceiling,
          productionCeiling: briefValue.productionConstraints.budgetCeiling,
          sourcePinned: Object.values(stored.result.cinema.sources).some((source: unknown) => (
            source as { creatorPinned: boolean }
          ).creatorPinned),
        });
        database.close();
      };
    };
  }));
  expect(storedCinema).toEqual({
    briefVersion: 2,
    creationMode: 'ai-generated',
    generationCeiling: 700,
    productionCeiling: 50000,
    sourcePinned: true,
  });

  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project Outline' })).toBeVisible();
  await expectVisibleNodesNotToOverlap(page);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByText('New local document created.', { exact: true })).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await editSceneText(page, 'A dancer misses the final train and hears footsteps matching her rhythm.');
  await page.locator('.plan-scene-button').click();
  brief = page.getByRole('dialog', { name: 'Generate shot plan' });
  await brief.getByLabel('Genre and tone').fill('Quiet urban mystery');
  await brief.getByLabel('Location and period').fill('Contemporary elevated train station at night');
  await brief.getByRole('button', { name: 'Generate shot plan' }).click();
  await expect(review).toBeVisible();
  await expect(review).toContainText('Unpriced');
  await review.getByRole('button', { name: 'Reject' }).click();
  await expect(review).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Shot 01', exact: true })).toBeVisible();
  expect(externalRequests).toEqual([]);
});

test('keeps first-run planning and all project actions keyboard-accessible at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await chooseStartScene(page);
  await editSceneText(page, 'A student finds a handwritten warning inside a library book she has not opened yet.');

  await page.getByRole('button', { name: 'Open project actions' }).click();
  const menu = page.getByRole('menu', { name: 'Project actions' });
  await expect(menu).toContainText('Fixture mode');
  await expect(menu.getByRole('menuitem', { name: 'Backup or restore' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Export SVG' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'New project' })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Generate shot plan' }).click();

  const brief = page.getByRole('dialog', { name: 'Generate shot plan' });
  await expect(brief).toBeVisible();
  await expect(brief.getByLabel('Genre and tone')).toBeFocused();
  const bounds = await brief.boundingBox();
  expect(bounds).toBeTruthy();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

  await page.keyboard.press('Escape');
  await expect(brief).toHaveCount(0);
  await page.getByRole('button', { name: 'Open project actions' }).click();
  await expect(menu.getByRole('menuitem', { name: 'Generate shot plan' })).toBeFocused();
});

test('shows live mode before submission and requires explicit transfer consent', async ({ page }) => {
  let planningRequests = 0;
  let planningBody: Record<string, unknown> | null = null;
  await page.route('**/api/cinema/provider-status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mode: 'live',
        requiresContentTransferConsent: true,
        research: { configured: true, provider: 'parallel' },
        planning: { configured: true, provider: 'vertex-gemini', model: 'gemini-test' },
        telemetryPolicy: 'no-content-v1',
        livePreflight: { ready: true, blockers: [], maxLiveRunCost: 1 },
      }),
    });
  });
  page.on('request', (request) => {
    if (request.url().includes('/api/cinema/plan-scene')) {
      planningRequests += 1;
      planningBody = request.postDataJSON() as Record<string, unknown>;
    }
  });

  await page.goto('/');
  await chooseStartScene(page);
  await expect(page.getByText('Live mode', { exact: true }).first()).toBeVisible();
  await editSceneText(page, 'A courier hears a voice note recorded by her future self inside a rain-soaked jeepney.');
  await page.locator('.plan-scene-button').click();
  const brief = page.getByRole('dialog', { name: 'Generate shot plan' });
  await brief.getByLabel('Genre and tone').fill('Intimate speculative suspense');
  await brief.getByLabel('Location and period').fill('Contemporary Manila jeepney at night');
  const consent = brief.getByLabel(/Send this scene brief and constraints/);
  await expect(consent).toBeVisible();
  await brief.getByRole('button', { name: 'Generate shot plan' }).click();
  await expect(brief.getByRole('alert')).toContainText('Confirm the live provider content transfer');
  await expect(consent).toBeFocused();
  expect(planningRequests).toBe(0);

  await consent.check();
  await brief.getByRole('button', { name: 'Generate shot plan' }).click();
  await expect(page.getByRole('region', { name: 'Shot proposal review' })).toBeVisible();
  expect(planningRequests).toBe(1);
  expect(planningBody).toMatchObject({
    liveProviderConsent: true,
    liveConsentReceipt: {
      policyVersion: 1,
      approvedMaxCost: 1,
      planningModel: 'gemini-test',
    },
  });
});

test('recovers a pending proposal, edits an accepted shot, and preserves revision history', async ({ page }) => {
  let planningRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/cinema/plan-scene')) planningRequests += 1;
  });
  await page.goto('/');
  await chooseStartScene(page);
  await editSceneText(page, 'Mara enters an abandoned cinema and sees a warning from her future self.');
  await page.locator('.plan-scene-button').click();
  let brief = page.getByRole('dialog', { name: 'Generate shot plan' });
  await brief.getByLabel('Genre and tone').fill('Restrained supernatural suspense');
  await brief.getByLabel('Location and period').fill('Manila cinema, late 1980s');
  await brief.getByRole('button', { name: 'Generate shot plan' }).click();
  const review = page.getByRole('region', { name: 'Shot proposal review' });
  await expect(review).toBeVisible();
  expect(planningRequests).toBe(1);

  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(review).toBeVisible();
  await expect(page.getByText('Recovered the pending shot plan without repeating provider calls.')).toBeVisible();
  expect(planningRequests).toBe(1);
  await page.getByRole('button', { name: /fixture provider mode.*local traces/i }).click();
  const traceDialog = page.getByRole('dialog', { name: 'Provider status and local traces' });
  await expect(traceDialog).toContainText('no-content-v1');
  await expect(traceDialog).toContainText('Recent agent runs');
  await expect(traceDialog.locator('.trace-list > li')).toHaveCount(1);
  await traceDialog.getByRole('button', { name: 'Close' }).click();
  await review.getByRole('button', { name: 'Accept plan' }).click();
  await expect(page.getByRole('button', { name: 'Create revision' })).toBeVisible();

  const outline = page.getByRole('navigation', { name: 'Project outline' });
  await outline.getByRole('button', { name: '01 · Entering the Auditorium', exact: true }).click();
  await page.getByRole('tab', { name: 'Details' }).click();
  await page.getByRole('button', { name: 'Edit accepted shot' }).click();
  const editor = page.getByRole('region', { name: 'Accepted shot editor' });
  await editor.getByLabel('Shot title').fill('Revised auditorium entrance');
  await editor.getByLabel('Duration (seconds)').fill('8');
  await editor.getByRole('button', { name: 'Save shot' }).click();
  await expect(outline.getByRole('button', { name: '01 · Revised auditorium entrance', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Prompt' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Prompt' })).toContainText('stale');

  await page.getByRole('button', { name: 'Create revision' }).click();
  brief = page.getByRole('dialog', { name: 'Generate shot plan' });
  await expect(brief.getByLabel('Selected scene text')).toContainText('Mara enters an abandoned cinema');
  await brief.getByRole('button', { name: 'Generate shot plan' }).click();
  await expect(review).toBeVisible();
  await review.getByRole('button', { name: 'Accept plan' }).click();
  await outline.getByRole('button', { name: 'Scene 01 · The Abandoned Cinema', exact: true }).click();
  await page.getByRole('tab', { name: 'Details' }).click();
  const history = page.locator('.revision-history');
  await expect(history).toContainText('2 revisions');
  await expect(history).toContainText('Revision 2');
  await expect(history).toContainText('Revision 1');
  expect(planningRequests).toBe(2);

  page.once('dialog', (dialog) => dialog.accept());
  await history.getByRole('button', { name: 'Restore Revision 1 as new revision' }).click();
  await expect(page.getByText('Revision 1 restored as new Revision 3.')).toBeVisible();
  await expect(history).toContainText('3 revisions');
  await expect(history.locator('li').filter({ hasText: 'Revision 3' })).toContainText('Current');
  await expect(history.getByRole('button', { name: 'Restore Revision 2 as new revision' })).toBeVisible();
  expect(planningRequests).toBe(2);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(history).toContainText('2 revisions');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(history).toContainText('3 revisions');
  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const restoredOutline = page.getByRole('navigation', { name: 'Project outline' });
  await restoredOutline.getByRole('button', { name: 'Scene 01 · The Abandoned Cinema', exact: true }).click();
  await page.getByRole('tab', { name: 'Details' }).click();
  await expect(page.locator('.revision-history')).toContainText('3 revisions');
});
