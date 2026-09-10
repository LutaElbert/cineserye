import { test, expect, type Locator, type Page } from '@playwright/test';
import { openEditor } from './helpers';

async function assertReadable(page: Page, editor: Locator, minimumPixels: number) {
  const zoom = await page.locator('.react-flow__viewport').evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a);
  const font = await editor.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(font * zoom).toBeGreaterThanOrEqual(minimumPixels);
  const bounds = (await editor.boundingBox())!;
  const toolbar = (await page.getByRole('region', { name: 'Canvas workspace' }).locator('.canvas-toolbar').boundingBox())!;
  const controls = (await page.locator('.react-flow__controls').boundingBox())!;
  expect(bounds.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(controls.y);
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
}

test('very short editing shells retain a usable scroll body', async ({ page }, info) => {
  // CSS viewport measured in native Chrome at 200% browser zoom. This geometry
  // regression complements, but does not replace, the native zoom check.
  await page.setViewportSize({ width: 735, height: 358 });
  await openEditor(page);
  for (const [id, name, bodyClass] of [
    ['story-premise', 'Story premise layer editor', '.premise-editor-body'],
    ['scene-01', 'Scene layer editor', '.layer-editor-content'],
  ]) {
    await page.locator(`.react-flow__node[data-id="${id}"]`).dblclick();
    const editor = page.getByRole('region', { name, exact: true });
    const body = editor.locator(bodyClass);
    expect(await body.evaluate((element) => element.clientHeight)).toBeGreaterThanOrEqual(120);
    const title = editor.getByRole('textbox', { name: 'Layer title', exact: true });
    await title.click();
    await title.fill('Short viewport draft');
    await expect(title).toBeInViewport();
    await expect(editor.getByRole('button', { name: 'Done', exact: true })).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`${id}-short-shell.png`) });
    await editor.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Fit View', exact: true }).click();
  }
});

for (const viewport of [{ width: 877, height: 559 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`Story and Assistant focus remain readable at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await openEditor(page);
    await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
    await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
    const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
    await assertReadable(page, editor, viewport.width === 390 ? 10 : 12);
    const transform = await page.locator('.react-flow__viewport').getAttribute('style');
    await editor.getByLabel('Layer title', { exact: true }).pressSequentially(' readable focus', { delay: 20 });
    expect(await page.locator('.react-flow__viewport').getAttribute('style')).toBe(transform);
    await editor.getByRole('textbox', { name: 'Premise for development', exact: true }).fill('A 60-second vertical suspense story: a caretaker finds a film showing tomorrow. No dialogue.');
    expect(await page.locator('.react-flow__viewport').getAttribute('style')).toBe(transform);
    await expect(editor.getByRole('button', { name: 'Done', exact: true })).toBeInViewport();
    await page.screenshot({ path: info.outputPath('readable-story.png') });
    await editor.getByRole('button', { name: 'Generate', exact: true }).click();
    await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
    const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
    await assertReadable(page, assistant, viewport.width === 390 ? 10 : 12);
    await expect(assistant.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
    await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(assistant.getByRole('heading', { name: 'Here’s what I understood', exact: true })).toBeVisible();
    await expect(assistant.getByRole('button', { name: 'Continue', exact: true })).toBeInViewport();
    await expect(assistant.getByRole('checkbox', { name: /fixture analysis/ })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('readable-assistant.png') });
  });
  test(`Scene focus has a scrollable in-node form at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await openEditor(page);
    await page.locator('.react-flow__node[data-id="scene-01"]').dblclick();
    await page.getByRole('button', { name: 'Focus layer editor', exact: true }).click();
    const editor = page.getByRole('region', { name: 'Scene layer editor', exact: true });
    await assertReadable(page, editor, viewport.width === 390 ? 10 : 12);
    await expect(editor.getByRole('button', { name: 'Done', exact: true })).toBeInViewport();
    await editor.getByLabel('Layer title', { exact: true }).fill('A readable scene');
    await editor.getByRole('button', { name: 'Review inherited references', exact: true }).click();
    await editor.getByRole('combobox', { name: 'Reference scope', exact: true }).selectOption('scene:scene-01');
    const referenceNote = editor.getByRole('textbox', { name: 'Reference note', exact: true });
    // Unlike fill(), clicking requires a visible pointer target in every engine.
    await referenceNote.click();
    await referenceNote.fill('Native scrolling keeps the final form controls reachable.');
    await expect(editor.getByRole('textbox', { name: 'Reference note', exact: true })).toBeInViewport();
    await expect(editor.getByRole('button', { name: 'Done', exact: true })).toBeInViewport();
    await page.screenshot({ path: info.outputPath('readable-scene-references.png') });
  });
}
