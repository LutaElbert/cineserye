import { expect, test, type Page } from '@playwright/test';
import { waitForSaved, openSelectedScenePlanner } from './helpers';

async function openAcceptedSample(page: Page) {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible({ timeout: 10_000 });
  const chooser = page.getByRole('dialog', { name: /Start with your scene/ });
  await chooser.getByRole('button', { name: /Explore the sample/ }).click();
  await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeVisible();
}

async function importTwoScenes(page: Page) {
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  const workspace = page.getByRole('region', { name: 'Multi-scene project workspace' });
  await workspace.getByLabel('Treatment or scene outline').fill(
    'SCENE 2: The Warning\nA warning appears on the projector.\n\nSCENE 3: The Escape\nMara decides whether to leave.',
  );
  await workspace.getByRole('button', { name: 'Propose boundaries' }).click();
  await expect(workspace.getByLabel('Scene 1 title')).toHaveValue('The Warning');
  await expect(workspace.locator('.project-scene-card')).toHaveCount(1);
  await workspace.getByRole('button', { name: 'Accept 2 scenes' }).click();
  await expect(workspace.locator('.project-scene-card')).toHaveCount(3);
  return workspace;
}

async function planScene(page: Page, title: string) {
  const workspace = page.getByRole('region', { name: 'Multi-scene project workspace' });
  const card = workspace.locator('.project-scene-card').filter({ hasText: title });
  await card.getByRole('button', { name: 'Open & plan' }).click();
  await openSelectedScenePlanner(page);
  const brief = page.getByRole('region', { name: 'Generate shot plan' });
  await brief.getByLabel('Genre and tone').fill('Grounded supernatural suspense');
  await brief.getByLabel('Location and period').fill('Present-day Manila cinema');
  await brief.getByRole('button', { name: 'Generate shot plan' }).click();
  const review = page.getByRole('region', { name: 'Shot proposal review' });
  await expect(review).toBeVisible();
  await review.getByRole('button', { name: 'Accept plan' }).click();
  await expect(review).toHaveCount(0);
  await page.getByRole('button', { name: 'Project', exact: true }).click();
}

test('S7-E2E-01 creates, reviews, reorders, filters, collapses, and independently plans three scenes', async ({ page }) => {
  await openAcceptedSample(page);
  const workspace = await importTwoScenes(page);

  const escapeCard = workspace.locator('.project-scene-card').filter({ hasText: 'The Escape' });
  await escapeCard.getByRole('button', { name: /Move The Escape earlier/ }).click();
  const sceneTitles = await workspace.locator('.project-scene-card h4').allTextContents();
  expect(sceneTitles).toEqual(['Scene 01 · The Abandoned Cinema', 'The Escape', 'The Warning']);

  await workspace.getByPlaceholder('Filter scenes').fill('warning');
  await expect(workspace.locator('.project-scene-card')).toHaveCount(1);
  await workspace.getByPlaceholder('Filter scenes').fill('');
  const collapse = workspace.getByRole('button', { name: 'Collapse The Warning' });
  await collapse.click();
  await expect(workspace.getByRole('button', { name: 'Expand The Warning' })).toBeVisible();
  await workspace.getByRole('button', { name: 'Expand The Warning' }).click();

  await planScene(page, 'The Escape');
  await planScene(page, 'The Warning');
  await expect(page.getByRole('region', { name: 'Multi-scene project workspace' }).getByText('3/3 planned')).toBeVisible();
  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Multi-scene project workspace' }).getByText('3/3 planned')).toBeVisible();
});

test('S7-E2E-02 reviews shared continuity impact and saves a scene-scoped variant', async ({ page }) => {
  await openAcceptedSample(page);
  const workspace = await importTwoScenes(page);
  const firstEntity = workspace.locator('.shared-entity-list article').first();
  await firstEntity.getByRole('button', { name: 'Review impact' }).click();
  const impact = workspace.getByRole('dialog', { name: /Share .* across every scene/ });
  await expect(impact).toContainText(/currently affects 1 scenes and \d+ shots/i);
  await expect(impact).toContainText('all 3 scenes');
  await impact.getByRole('button', { name: 'Accept continuity change' }).click();
  await expect(page.getByText(/shared across 3 scenes/)).toBeVisible();
  await firstEntity.getByRole('button', { name: 'Add scene variant' }).click();
  const variant = workspace.getByRole('form', { name: 'Scene continuity variant' });
  await variant.getByLabel('Scene').selectOption({ label: 'The Warning' });
  await variant.getByLabel('Wardrobe or visual change').fill('Rain-soaked jacket');
  await variant.getByLabel('Notes').fill('Carry wet continuity through the escape.');
  await variant.getByRole('button', { name: 'Save variant' }).click();
  await expect(page.getByText('Scene-scoped continuity variant saved.')).toBeVisible();
  await expect(firstEntity).toContainText('1 variants');
});

test('S7-E2E-03 shows aggregate totals plus explicit narrative, production, and output status', async ({ page }) => {
  await openAcceptedSample(page);
  const workspace = await importTwoScenes(page);
  const totals = workspace.locator('dl[aria-label="Project totals"]');
  await expect(totals).toContainText('1/3 planned');
  await expect(totals).toContainText('6');
  await expect(totals).toContainText('₱820.00');
  const sequence = workspace.getByRole('table');
  await expect(sequence.getByRole('columnheader', { name: 'Narrative shot' })).toBeVisible();
  await expect(sequence.getByRole('columnheader', { name: 'Production' })).toBeVisible();
  await expect(sequence).toContainText('unplanned');
  await expect(sequence).toContainText('missing');
});

test('S8-E2E-01 audits a scoped continuity change, records the decision, and undoes it', async ({ page }) => {
  await openAcceptedSample(page);
  const workspace = await importTwoScenes(page);
  const firstEntity = workspace.locator('.shared-entity-list article').first();

  await firstEntity.getByRole('button', { name: 'Review impact' }).click();
  await workspace.getByRole('dialog', { name: /Share .* across every scene/ })
    .getByRole('button', { name: 'Accept continuity change' })
    .click();
  await firstEntity.getByRole('button', { name: 'Add scene variant' }).click();
  const variant = workspace.getByRole('form', { name: 'Scene continuity variant' });
  await variant.getByLabel('Scene').selectOption({ label: 'The Warning' });
  await variant.getByLabel('Wardrobe or visual change').fill('Rain-soaked jacket');
  await variant.getByRole('button', { name: 'Save variant' }).click();

  await workspace.getByRole('button', { name: 'Audit project' }).click();
  const audit = workspace.getByRole('region', { name: 'Continuity audit' });
  await expect(audit).toContainText(/1 open of \d+ ranked findings/);
  const finding = audit.locator('.audit-finding').filter({ hasText: /Review .* in The Warning/ });
  await expect(finding).toContainText('warning · wardrobe condition');
  await expect(finding).toContainText(/1 scenes · \d+ shots · deterministic/);
  await finding.getByRole('button', { name: 'Record as intentional' }).click();
  await expect(finding).toContainText('accepted');
  await expect(firstEntity).toContainText('1 exceptions');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(finding.getByRole('button', { name: 'Record as intentional' })).toBeVisible();
  await expect(firstEntity).toContainText('0 exceptions');
});
