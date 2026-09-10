import { test, expect, type Locator, type Page } from '@playwright/test';
import { openEditor, waitForSaved } from './helpers';

const position = (node: Locator) => node.evaluate((element) => {
  const matrix = new DOMMatrix(getComputedStyle(element).transform);
  return { x: matrix.e, y: matrix.f };
});
const graphPositions = (page: Page) => page.locator('.react-flow__node:not([data-id^="story-assistant"])').evaluateAll((nodes) => nodes
  .filter((node) => !node.querySelector('.story-assistant-node'))
  .map((node) => ({ id: (node as HTMLElement).dataset.id, transform: (node as HTMLElement).style.transform })));
const zoom = (page: Page) => page.locator('.react-flow__viewport').evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a);

async function dragFrom(page: Page, target: Locator, dx: number, dy: number) {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  // The left-hand label area is deliberately separate from header buttons.
  const x = box!.x + Math.min(box!.width * 0.28, 100);
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
  await page.mouse.up();
}

test('expanded Story uses a header drag handle at canvas zoom, protects inputs, and retains compact geometry on reload', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openEditor(page);
  const story = page.locator('.react-flow__node[data-id="story-premise"]');
  const siblings = (await graphPositions(page)).filter((node) => node.id !== 'story-premise');
  await story.dblclick();
  await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  await expect(story.getByRole('region', { name: 'Story premise layer editor', exact: true })).toBeVisible();
  const title = editor.getByLabel('Layer title', { exact: true });
  await title.fill('Header drag acceptance');
  const beforeBody = await position(story);
  const viewportBeforeBody = await page.locator('.react-flow__viewport').getAttribute('style');
  await dragFrom(page, title, 28, 4);
  expect(await position(story)).toEqual(beforeBody);
  expect(await page.locator('.react-flow__viewport').getAttribute('style')).toBe(viewportBeforeBody);
  await title.hover();
  const startZoom = await zoom(page);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -25);
  await page.keyboard.up('Control');
  await expect.poll(() => zoom(page)).toBeGreaterThan(startZoom);
  const scale = await zoom(page);
  const before = await position(story);
  await dragFrom(page, editor.locator('.layer-drag-handle').first(), 48, 32);
  await expect.poll(async () => (await position(story)).x).toBeGreaterThan(before.x + 10);
  const moved = await position(story);
  // React Flow crosses its drag threshold on the first sampled pointer move;
  // that initial 4px step establishes the drag origin rather than displacement.
  expect(Math.abs((moved.x - before.x) * scale - 48)).toBeLessThan(6);
  expect(Math.abs((moved.y - before.y) * scale - 32)).toBeLessThan(6);
  expect((await graphPositions(page)).filter((node) => node.id !== 'story-premise')).toEqual(siblings);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('story-expanded-header-drag-desktop.png') });
  await editor.getByRole('button', { name: 'Done', exact: true }).click();
  expect(await position(story)).toEqual(moved);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => position(story)).toEqual(before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(() => position(story)).toEqual(moved);
  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  expect(await position(story)).toEqual(moved);
  await expect(story).toContainText('Header drag acceptance');
  await expect(page.getByRole('region', { name: 'Story premise layer editor', exact: true })).toHaveCount(0);
});

for (const [kind, id] of [['Scene', 'scene-01'], ['Shot', 'shot-01']] as const) {
  test(`${kind} edits expand the actual canvas node without opening a popup`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const posts: string[] = [];
    page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts.push(request.url()); });
    await openEditor(page);
    const node = page.locator(`.react-flow__node[data-id="${id}"]`);
    await node.dblclick();
    await page.getByRole('button', { name: 'Focus layer editor', exact: true }).click();
    const editor = page.getByRole('region', { name: `${kind} layer editor`, exact: true });
    await expect(node.getByRole('region', { name: `${kind} layer editor`, exact: true })).toBeVisible();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await editor.getByLabel('Layer title', { exact: true }).fill(`${kind} edited on canvas`);
    const before = await position(node);
    await dragFrom(page, editor.locator('.layer-drag-handle').first(), 30, 25);
    await expect.poll(async () => (await position(node)).x).toBeGreaterThan(before.x);
    const moved = await position(node);
    await page.screenshot({ path: info.outputPath(`${kind.toLowerCase()}-expanded-desktop.png`) });
    await editor.getByLabel('Layer title', { exact: true }).press('Escape');
    await expect(editor).toHaveCount(0);
    expect(await position(node)).toEqual(moved);
    await expect(node).toContainText(`${kind} edited on canvas`);
    await node.dblclick();
    await expect(editor.getByLabel('Layer title', { exact: true })).toHaveValue(`${kind} edited on canvas`);
    expect(posts).toEqual([]);
  });
}

test('discard confirmation stays inline, cancellation retains edits, and confirmation restores the original text', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await openEditor(page);
  await page.locator('.react-flow__node[data-id="scene-01"]').dblclick();
  await page.getByRole('button', { name: 'Focus layer editor', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Scene layer editor', exact: true });
  const title = editor.getByLabel('Layer title', { exact: true });
  const originalTitle = await title.inputValue();
  await title.fill('Keep until confirmed');
  await editor.getByRole('button', { name: 'Discard text / direction changes', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Confirm discard', exact: true })).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(title).toHaveValue('Keep until confirmed');
  await editor.getByRole('button', { name: /Keep editing|Cancel discard/, exact: true }).click();
  await expect(title).toHaveValue('Keep until confirmed');
  await editor.getByRole('button', { name: 'Discard text / direction changes', exact: true }).click();
  await editor.getByRole('button', { name: 'Confirm discard', exact: true }).click();
  await expect(title).toHaveValue(originalTitle);
  expect(dialogs).toEqual([]);
});

test('Assistant header placement survives hide/reopen and reload while production nodes remain untouched', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openEditor(page);
  const before = await graphPositions(page);
  await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
  await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
  await page.getByRole('region', { name: 'Story premise layer editor', exact: true }).getByLabel('Premise for development', { exact: true }).fill('A quiet cinema reveals tomorrow.');
  await page.getByRole('region', { name: 'Story premise layer editor', exact: true }).getByRole('button', { name: 'Generate', exact: true }).click();
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
  const node = page.locator('.react-flow__node').filter({ has: assistant });
  const initial = await position(node);
  await dragFrom(page, assistant.locator('.layer-drag-handle').first(), 42, 30);
  await expect.poll(async () => (await position(node)).x).toBeGreaterThan(initial.x);
  const moved = await position(node);
  expect(await graphPositions(page)).toEqual(before);
  await page.screenshot({ path: info.outputPath('assistant-header-drag-desktop.png') });
  await assistant.getByRole('button', { name: 'Hide story assistant', exact: true }).click();
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  expect(await position(node)).toEqual(moved);
  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  expect(await position(node)).toEqual(moved);
  expect(await graphPositions(page)).toEqual(before);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  const bounds = (await assistant.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(391);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('assistant-mobile-on-canvas.png') });
});

test('locked Scene remains inspectable but its edit header cannot move the node', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openEditor(page);
  const scene = page.locator('.react-flow__node[data-id="scene-01"]');
  await scene.click();
  await page.getByLabel('Lock layer', { exact: true }).check();
  await scene.dblclick();
  await page.getByRole('button', { name: 'Focus layer editor', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Scene layer editor', exact: true });
  await expect(editor.getByLabel('Layer title', { exact: true })).toBeDisabled();
  const before = await position(scene);
  await dragFrom(page, editor.locator('.layer-drag-handle').first(), 45, 30);
  expect(await position(scene)).toEqual(before);
  await expect(editor.getByRole('button', { name: 'Review shot plan', exact: true })).toBeDisabled();
});

test('expanded Story and Assistant header dragging respects Hand and temporary Space pan modes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openEditor(page);
  const story = page.locator('.react-flow__node[data-id="story-premise"]');
  await story.dblclick();
  await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  const select = page.getByRole('button', { name: 'Select tool, V', exact: true });
  const hand = page.getByRole('button', { name: 'Hand tool, H', exact: true });
  const assertModes = async (node: Locator, header: Locator) => {
    const before = await position(node);
    await hand.click();
    await expect(hand).toHaveAttribute('aria-pressed', 'true');
    const viewportBefore = await page.locator('.react-flow__viewport').getAttribute('style');
    await dragFrom(page, header, 35, 22);
    expect(await position(node)).toEqual(before);
    await expect(page.locator('.react-flow__viewport')).not.toHaveAttribute('style', viewportBefore!);
    await select.click();
    await page.locator('#canvas-workspace').focus();
    await page.keyboard.down('Space');
    await expect(hand).toHaveAttribute('aria-pressed', 'true');
    await dragFrom(page, header, 35, 22);
    expect(await position(node)).toEqual(before);
    await page.keyboard.up('Space');
    await expect(select).toHaveAttribute('aria-pressed', 'true');
    await dragFrom(page, header, 35, 22);
    await expect.poll(async () => (await position(node)).x).toBeGreaterThan(before.x);
  };
  await assertModes(story, editor.locator('.layer-drag-handle'));
  await editor.getByLabel('Premise for development', { exact: true }).fill('A quiet cinema reveals tomorrow.');
  await editor.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
  await assertModes(page.locator('.react-flow__node').filter({ has: assistant }), assistant.locator('.layer-drag-handle'));
});

test('ordinary wheel scrolling stays native inside an expanded form without moving or zooming the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openEditor(page);
  const story = page.locator('.react-flow__node[data-id="story-premise"]');
  await story.dblclick();
  await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  // The simplified composer has no long hidden settings form. Its prompt still
  // needs native scrolling for a long story without panning the underlying graph.
  const body = editor.getByLabel('Premise for development', { exact: true });
  await body.fill(Array.from({ length: 60 }, (_, index) => `Story beat ${index + 1}: Mara searches the empty auditorium.`).join('\n'));
  expect(await body.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(100);
  await body.evaluate((element) => { element.scrollTop = 0; });
  const before = await position(story);
  const viewport = await page.locator('.react-flow__viewport').getAttribute('style');
  const box = (await body.boundingBox())!;
  // The overflowing prompt owns ordinary wheel scrolling; Ctrl-wheel stays zoom.
  await page.mouse.move(box.x + box.width - 12, box.y + box.height / 2);
  await page.mouse.wheel(0, 220);
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(30);
  expect(await position(story)).toEqual(before);
  expect(await page.locator('.react-flow__viewport').getAttribute('style')).toBe(viewport);
  await expect(editor.getByRole('button', { name: 'Done', exact: true })).toBeInViewport();
});

for (const [kind, id] of [['Scene', 'scene-01'], ['Shot', 'shot-01']] as const) {
  test(`fresh ${kind} opens references on canvas with valid parent-scene scope and retains notes`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const posts: string[] = [];
    page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts.push(request.url()); });
    await openEditor(page);
    const node = page.locator(`.react-flow__node[data-id="${id}"]`);
    await node.dblclick();
    await page.getByRole('button', { name: 'Focus layer editor', exact: true }).click();
    const editor = page.getByRole('region', { name: `${kind} layer editor`, exact: true });
    await editor.getByRole('button', { name: 'Review inherited references', exact: true }).click();
    await expect(editor.getByRole('button', { name: 'Back to layer', exact: true })).toBeVisible();
    expect(await editor.evaluate((element) => element.closest<HTMLElement>('.react-flow__node')?.dataset.id)).toBe(id);
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    const scope = editor.getByRole('combobox', { name: 'Reference scope', exact: true });
    // A manual Shot has no accepted cinema shot record yet. Its reference owner
    // must be its real parent Scene, never an invalid shot id or Story default.
    await expect(scope).toHaveValue('scene:scene-01');
    const referenceTitle = `${kind} scoped lighting note`;
    await editor.getByLabel('Reference title', { exact: true }).fill(referenceTitle);
    await editor.getByLabel('Reference note', { exact: true }).fill('Keep warm practical lighting across this scene.');
    await editor.getByRole('button', { name: 'Add note reference', exact: true }).click();
    await expect(editor.getByText(referenceTitle, { exact: true })).toBeVisible();
    await scope.selectOption({ label: 'Story default' });
    await expect(editor.getByText(referenceTitle, { exact: true })).toHaveCount(0);
    await scope.selectOption('scene:scene-01');
    await expect(editor.getByText(referenceTitle, { exact: true })).toBeVisible();
    await editor.getByRole('button', { name: 'Back to layer', exact: true }).click();
    await expect(editor.getByLabel('Layer title', { exact: true })).toBeVisible();
    await editor.getByRole('button', { name: 'Review inherited references', exact: true }).click();
    await expect(scope).toHaveValue('scene:scene-01');
    await expect(editor.getByText(referenceTitle, { exact: true })).toBeVisible();
    await editor.getByRole('button', { name: 'Done', exact: true }).click();
    await waitForSaved(page);
    await page.reload();
    await expect(page.locator('main[data-ready="true"]')).toBeVisible();
    // Hydration does not promise a fitted overview. Use the outline's actual
    // reveal-and-focus action before interacting with a potentially clipped node.
    await page.getByRole('navigation', { name: 'Project outline', exact: true }).getByRole('button', { name: `${kind} 01`, exact: true }).click();
    await expect.poll(() => node.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      return Boolean(hit && element.contains(hit));
    })).toBe(true);
    await node.dblclick();
    await page.getByRole('button', { name: 'Focus layer editor', exact: true }).click();
    await editor.getByRole('button', { name: 'Review inherited references', exact: true }).click();
    await expect(scope).toHaveValue('scene:scene-01');
    await expect(editor.getByText(referenceTitle, { exact: true })).toBeVisible();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    expect(posts).toEqual([]);
  });
}
