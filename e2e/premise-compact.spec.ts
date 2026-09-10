import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openEditor, waitForSaved, createDiagramPng } from './helpers';

test('Story entry from Project view reveals the actual canvas node, including an already open editor', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Explore the sample/ }).click();
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await page.getByRole('button', { name: /^(Story workspace|Develop this story)$/ }).click();
    await expect(page.getByRole('button', { name: 'Canvas', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
    await expect(editor).toBeVisible();
    expect(await editor.evaluate((element) => Boolean(element.closest('.react-flow__node')))).toBe(true);
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  }
});

test('premise expands inside the actual node with local editing, references and no popup', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let posts = 0;
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts++; });
  await openEditor(page);
  await page.getByRole('button', { name: 'Toggle properties panel' }).click();
  await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  await expect(editor).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(await editor.evaluate((node) => node.closest<HTMLElement>('.react-flow__node')?.dataset.id)).toBe('story-premise');
  await expect(editor.locator('.layer-drag-handle')).toHaveCount(1);
  await expect(editor.getByLabel('Layer title', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
  await expect(editor.getByLabel('Tone', { exact: true })).toHaveCount(0);
  await expect(editor.getByText('Creative direction — up to four local questions')).toHaveCount(0);
  await editor.getByLabel('Layer title', { exact: true }).fill('The Cursed Game');
  await editor.getByLabel('Premise for development', { exact: true }).fill('A 60-second vertical horror short about four friends trapped inside a cursed board game. No dialogue.');
  await editor.getByRole('button', { name: 'Surprise me', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Surprise me', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await editor.getByRole('button', { name: 'Expand my idea', exact: true }).click();
  await editor.getByRole('button', { name: 'Add story reference', exact: true }).click();
  await expect(editor.getByLabel('Tone', { exact: true })).toHaveCount(0);
  await editor.getByLabel('Reference title', { exact: true }).fill('Board layout reference');
  const png = await createDiagramPng(page);
  await editor.getByLabel('Attach reference image', { exact: true }).setInputFiles({ name: 'layout.png', mimeType: 'image/png', buffer: png });
  await expect(editor.getByText('Board layout reference', { exact: true })).toBeVisible();
  await editor.getByLabel('Reference title', { exact: true }).fill('Atmosphere notes');
  await editor.getByLabel('Reference note', { exact: true }).fill('Dim practical lighting, a confined living room.');
  await editor.getByRole('button', { name: 'Add note reference', exact: true }).click();
  await editor.getByRole('button', { name: 'Back to premise', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'References · 2' })).toBeVisible();
  await expect(editor.getByRole('img', { name: 'Board layout reference', exact: true })).toBeVisible();
  await waitForSaved(page);
  const violations = (await new AxeBuilder({ page }).include('.premise-expanded-node').analyze()).violations;
  expect(violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('expanded-premise-desktop.png') });
  await editor.getByLabel('Premise for development', { exact: true }).press('Enter');
  expect(posts).toBe(0);
  await editor.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await waitForSaved(page); await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
  await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
  await expect(editor.getByLabel('Layer title', { exact: true })).toHaveValue('The Cursed Game');
  await expect(editor.getByRole('button', { name: 'References · 2' })).toBeVisible();
  await editor.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Story Assistant', exact: true })).toBeVisible();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(posts).toBe(0);
});

test('premise stays inside the canvas on mobile; explicit focus and Escape work without a sheet', async ({ page }, testInfo) => {
  await openEditor(page);
  await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  await editor.getByLabel('Layer title', { exact: true }).fill('A smaller screen');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(await editor.evaluate((node) => node.closest<HTMLElement>('.react-flow__node')?.dataset.id)).toBe('story-premise');
  const box = (await editor.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(391);
  await expect(editor.getByRole('button', { name: 'Done', exact: true })).toBeInViewport();
  await waitForSaved(page);
  await page.screenshot({ path: testInfo.outputPath('expanded-premise-mobile.png') });
  await editor.getByLabel('Premise for development', { exact: true }).press('Escape');
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.react-flow__node[data-id="story-premise"]')).toContainText('A smaller screen');
});

test('Story toolbar and keyboard use the compact editor; pasted images inside it do not reach the canvas', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Story workspace', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  await expect(editor).toBeVisible();
  await editor.getByLabel('Layer title', { exact: true }).fill('One editor');
  await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
  // Generation belongs to the canvas; the removed toolbar shortcut cannot reset the edit origin.
  await expect(page.locator('.topbar').getByRole('button', { name: 'Develop this story', exact: true })).toHaveCount(0);
  await expect(editor).toHaveCount(1);
  const intercepted = await editor.getByRole('button', { name: 'Done', exact: true }).evaluate((button) => {
    const clipboardData = new DataTransfer();
    clipboardData.items.add(new File(['image'], 'clipboard.png', { type: 'image/png' }));
    const event = new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    const dropped = new DragEvent('drop', { dataTransfer: clipboardData, bubbles: true, cancelable: true });
    button.dispatchEvent(dropped);
    return { paste: event.defaultPrevented, drop: dropped.defaultPrevented };
  });
  expect(intercepted).toEqual({ paste: false, drop: true });
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await editor.getByRole('button', { name: 'Close layer editor', exact: true }).click();
  await expect(editor).toHaveCount(0);
  const story = page.locator('.react-flow__node[data-id="story-premise"]');
  await expect(story).toBeFocused();
  await story.focus(); await story.press('Enter');
  await expect(editor.getByLabel('Layer title', { exact: true })).toHaveValue('One editor');
  await editor.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(story).toContainText('Story Premise');
});

test('node expansion reroutes attached handles without moving siblings or saving expanded geometry', async ({ page }) => {
  await openEditor(page);
  await waitForSaved(page);
  const story = page.locator('.react-flow__node[data-id="story-premise"]');
  const geometry = () => page.locator('.react-flow__node').evaluateAll((nodes) => nodes.map((node) => ({
    id: (node as HTMLElement).dataset.id, transform: (node as HTMLElement).style.transform,
    width: (node as HTMLElement).style.width, height: (node as HTMLElement).style.height,
  })));
  const before = await geometry();
  const edge = page.locator('.react-flow__edge[data-id="story-premise-scene-01"] .react-flow__edge-path');
  const pathBefore = await edge.getAttribute('d');
  await story.dblclick();
  await expect(story).toHaveCSS('width', '440px');
  // Expanded geometry is now constrained by available canvas height. The
  // connection/persistence invariants below must hold for that responsive size.
  await expect.poll(async () => Number.parseFloat(await story.evaluate((element) => getComputedStyle(element).height))).toBeGreaterThanOrEqual(220);
  expect(Number.parseFloat(await story.evaluate((element) => getComputedStyle(element).height))).toBeLessThanOrEqual(640);
  await expect(edge).not.toHaveAttribute('d', pathBefore!);
  const expanded = await geometry();
  expect(expanded.filter((node) => node.id !== 'story-premise')).toEqual(before.filter((node) => node.id !== 'story-premise'));
  expect(expanded.find((node) => node.id === 'story-premise')!.transform).toBe(before.find((node) => node.id === 'story-premise')!.transform);
  await expect.poll(async () => {
    const handle = (await story.locator('.react-flow__handle-right.source').boundingBox())!;
    const start = await edge.evaluate((path) => {
      const svg = path as SVGPathElement;
      const point = svg.getPointAtLength(0);
      const transformed = new DOMPoint(point.x, point.y).matrixTransform(svg.getScreenCTM()!);
      return { x: transformed.x, y: transformed.y };
    });
    return Math.hypot(start.x - (handle.x + handle.width / 2), start.y - (handle.y + handle.height / 2));
  }).toBeLessThan(4);
  const editor = story.getByRole('region', { name: 'Story premise layer editor', exact: true });
  await editor.getByLabel('Layer title', { exact: true }).fill('Inline draft');
  await waitForSaved(page);
  // Reload while expanded: persisted data must contain only compact geometry.
  await page.reload(); await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.locator('.premise-expanded-node, dialog[open]')).toHaveCount(0);
  await expect(story).toContainText('Inline draft');
  expect(await geometry()).toEqual(before);
  // Browser measurement rounding can differ by a fraction of a canvas unit after reload.
  const coordinates = (path: string) => path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  await expect.poll(async () => {
    const restored = coordinates((await edge.getAttribute('d'))!);
    const original = coordinates(pathBefore!);
    if (restored.length !== original.length) return Infinity;
    return Math.max(...restored.map((value, index) => Math.abs(value - original[index])));
  }).toBeLessThan(0.1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
});
