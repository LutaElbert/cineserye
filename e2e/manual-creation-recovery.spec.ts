import { expect, test } from '@playwright/test';
import { addCinemaDraft, canvasNode, openEditor, waitForSaved } from './helpers';

const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';

test('creates typed cinema drafts with contextual relationships and reversible commands', async ({ page }) => {
  await openEditor(page);

  await page.getByRole('button', { name: 'Scene 01', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add shot', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add next scene', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add shot', exact: true }).click();
  await page.getByLabel('Concept title').fill('Close-up reveal');
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();

  const createdShot = canvasNode(page, 'Close-up reveal');
  await expect(createdShot.locator('[data-domain-type="cinema.shot"]')).toBeVisible();
  await expect(page.getByLabel('Connector from Scene 01 to Close-up reveal')).toBeVisible();
  await expect(createdShot.getByText('Draft', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close-up reveal', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close-up reveal', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Scene 01', exact: true }).click();
  await addCinemaDraft(page, 'Character');
  await page.getByLabel('Concept title').fill('Mara');
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await expect(canvasNode(page, 'Mara').locator('[data-domain-type="cinema.character"]')).toBeVisible();
  await expect(page.getByLabel('Connector from Scene 01 to Mara')).toBeVisible();

  await page.locator('.inspector-panel').getByLabel('Cinema role').selectOption('prop');
  await expect(canvasNode(page, 'Mara').locator('[data-domain-type="cinema.prop"]')).toBeVisible();
  await expect(canvasNode(page, 'Mara').getByText('Mara', { exact: true })).toBeVisible();
  await expect(page.getByText('Converted to prop.')).toBeVisible();
});

test('guards an empty canvas and supports undo plus persisted recovery', async ({ page }) => {
  await openEditor(page);
  const selectAllAndDelete = async () => {
    await page.locator('#canvas-workspace').focus();
    await page.keyboard.press(selectAllShortcut);
    await expect(page.locator('.inspector-panel').getByText('3 layers selected', { exact: true }).first()).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete unlocked layers', exact: true }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(0);
  };

  await selectAllAndDelete();
  const emptyState = page.getByRole('region', { name: 'Your project is still yours.' });
  await expect(emptyState).toBeVisible();
  await expect(emptyState.getByRole('button', { name: 'Undo delete' })).toBeVisible();
  await emptyState.getByRole('button', { name: 'Undo delete' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);

  await selectAllAndDelete();
  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
  const reloadedEmptyState = page.getByRole('region', { name: 'Your project is still yours.' });
  await expect(reloadedEmptyState.getByRole('button', { name: 'Recover last canvas' })).toBeVisible();
  await reloadedEmptyState.getByRole('button', { name: 'Recover last canvas' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Story Premise', exact: true })).toBeVisible();
});

test('creation palette exposes prerequisites and keyboard-accessible choices', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add filmmaking layer' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add a filmmaking layer' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Story premise / })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: /^Shot / })).toBeEnabled();
  await expect(dialog.getByRole('region', { name: 'Production' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Reference image / })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
