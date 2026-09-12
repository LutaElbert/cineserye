import { expect, type Locator, type Page } from '@playwright/test';

export async function openEditor(page: Page) {
  // The editor's readiness contract is hydration plus an actionable graph,
  // checked below, not completion of every page load resource.
  // Some engines can leave the navigation lifecycle pending after the fully
  // hydrated editor is already usable under a saturated native matrix. Commit
  // is the only navigation signal needed; the assertions below are the actual
  // application readiness contract.
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const chooser = page.getByRole('dialog', { name: /Start with your scene/ });
  if (await chooser.count()) {
    await chooser.getByRole('button', { name: /Start a scene/ }).click();
    await expect(chooser).toHaveCount(0);
  }
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  // Hydration and node counts precede the intentional first-run fit animation.
  // Pointer actionability waits for real visible, stable geometry before tests
  // measure it or derive a creation point from the current viewport.
  await page.locator('.react-flow__node').first().hover();
}

export async function addCinemaDraft(page: Page, role: string, finishEditing = false) {
  await page.getByRole('button', { name: 'Add filmmaking layer' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add a filmmaking layer' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: new RegExp(`^${role}(?: |$)`) }).click();
  if (finishEditing) {
    await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
    await page.getByRole('button', { name: 'Fit View' }).click();
  }
}

/** Planning starts inside the scene node, never from the global toolbar. */
export async function openSelectedScenePlanner(page: Page) {
  const editor = page.getByRole('region', { name: 'Scene layer editor', exact: true });
  if (!(await editor.isVisible())) {
    const selected = page.locator('.react-flow__node.selected');
    await expect(selected).toHaveCount(1);
    await selected.dblclick();
  }
  const focus = page.getByRole('button', { name: 'Focus layer editor', exact: true });
  if (await focus.isVisible()) await focus.click();
  await editor.getByRole('button', { name: 'Review shot plan', exact: true }).click();
  await expect(editor.getByRole('region', { name: 'Generate shot plan', exact: true })).toBeVisible();
}

export function canvasNode(page: Page, name: string): Locator {
  return page.locator('.react-flow__node').filter({ hasText: name }).first();
}

/** React Flow can publish hydrated nodes before a scheduled fit animation has
 * finished. Pointer tests must wait for the viewport itself, not just nodes. */
export async function waitForCanvasSettled(page: Page) {
  const viewport = page.locator('.react-flow__viewport');
  let previous: string | null = null;
  let stableSamples = 0;
  await expect.poll(async () => {
    const current = await viewport.getAttribute('style');
    stableSamples = current === previous ? stableSamples + 1 : 0;
    previous = current;
    return stableSamples;
  }, { intervals: [100], timeout: 5_000 }).toBeGreaterThanOrEqual(3);
}

export async function connectLayers(page: Page, sourceName: string, targetName: string) {
  const sourceHandle = canvasNode(page, sourceName).locator('.react-flow__handle.source').first();
  const targetHandle = canvasNode(page, targetName).locator('.react-flow__handle.target').first();
  await sourceHandle.hover();
  await targetHandle.hover();
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();
  expect(sourceBox).toBeTruthy();
  expect(targetBox).toBeTruthy();
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + targetBox!.height / 2,
    { steps: 10 },
  );
  await page.mouse.up();
}

export async function waitForSaved(page: Page) {
  const workspace = page.locator('main[data-ready="true"]');
  // Let React flush passive effects and the zero-delay dirty-state timer. The
  // save can already be complete for large renders, so "saving" is not a
  // required intermediate assertion; callers reload to verify persistence.
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect(workspace).toHaveAttribute('data-save-state', 'saved');
}

export async function confirmCineseryeDialog(page: Page, confirmLabel: string | RegExp) {
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: confirmLabel }).click();
  await expect(dialog).not.toBeVisible();
}

export async function createDiagramPng(page: Page): Promise<Buffer> {
  const bytes = await page.evaluate<number[]>(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 160;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#1f2937';
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(75, 80);
    context.lineTo(165, 80);
    context.stroke();
    context.fillStyle = '#635bff';
    context.fillRect(20, 45, 70, 70);
    context.fillStyle = '#22a06b';
    context.beginPath();
    context.arc(190, 80, 35, 0, Math.PI * 2);
    context.fill();
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG encoding failed.')), 'image/png');
    });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  return Buffer.from(bytes);
}
