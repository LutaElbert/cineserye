import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { canvasNode, openEditor } from './helpers';

test('has no serious or critical automated accessibility violations', async ({ page }) => {
  await openEditor(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter((violation) =>
    violation.impact === 'critical' || violation.impact === 'serious');
  expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([]);
});

test('supports keyboard entry, editing, cancellation, and focus restoration', async ({ page }) => {
  await openEditor(page);
  const skipLink = page.getByRole('link', { name: 'Skip to canvas' });
  // First-run choice removal leaves a browser-specific sequential-focus origin.
  // Focus the real link directly, then exercise its keyboard activation.
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Canvas workspace' })).toBeFocused();

  const researchLayer = page.getByRole('button', { name: 'Story Premise', exact: true });
  await researchLayer.focus();
  await researchLayer.press('F2');
  await expect(page.getByLabel('Layer name')).toBeFocused();
  await page.getByLabel('Layer name').press('Escape');
  await expect(researchLayer).toBeFocused();

  await researchLayer.click();
  const researchNode = canvasNode(page, 'Story Premise');
  await researchNode.focus();
  await researchNode.press('Enter');
  await expect(page.getByLabel('Concept title')).toBeFocused();
  await page.getByLabel('Concept title').press('Escape');
  await expect(researchNode).toBeFocused();
});

test('exposes layer, connector, toggle, and selection state semantically', async ({ page }) => {
  await openEditor(page);
  await expect(page.getByRole('list', { name: 'Canvas layers' })).toHaveAttribute('aria-describedby', 'layer-list-instructions');
  await expect(page.getByRole('button', { name: 'Story Premise', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Story Premise', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Story Premise', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Collapse branch from Story Premise' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Connector from Story Premise to Scene 01')).toBeVisible();
  await expect(page.getByLabel('Connector from Scene 01 to Shot 01')).toBeVisible();

  await page.getByRole('button', { name: 'Hide Story Premise', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show Story Premise', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show Story Premise', exact: true }).click();
  await page.getByRole('button', { name: 'Lock Story Premise', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unlock Story Premise', exact: true })).toBeVisible();
});

test('keeps controls usable with reduced motion and enlarged text on mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.getByRole('button', { name: 'Open layers panel' }).click();
  await expect(page.locator('.layers-panel')).toHaveClass(/panel-open/);
  await expect(page.getByRole('button', { name: 'Story Premise', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close layers panel' }).click();
  await page.getByRole('button', { name: 'Open properties panel' }).click();
  await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible();
});

test('S3-A11Y-01 and S4-A11Y-01 expose the visual workflow without serious violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const chooser = page.getByRole('dialog', { name: /Start with your scene/ });
  await chooser.getByRole('button', { name: /Explore the sample/ }).click();
  await page.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await page.getByRole('tab', { name: 'Visuals' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Visuals' });
  await expect(panel.getByLabel('Search reference deck')).toBeVisible();
  await expect(panel.getByLabel('Variants')).toHaveValue('3');
  const results = await new AxeBuilder({ page })
    .include('.visual-preproduction')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter((violation) =>
    violation.impact === 'critical' || violation.impact === 'serious');
  expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([]);
});
