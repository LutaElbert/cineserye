import { test, expect } from '@playwright/test';
import { openEditor } from './helpers';

test('editable layers retain cursor-anchored zoom and stable canvas while typing', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openEditor(page);
  await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
  await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  const viewport = page.locator('.react-flow__viewport');
  const transform = () => viewport.evaluate((el) => getComputedStyle(el).transform);
  const before = await transform();
  await page.evaluate(() => {
    const samples: string[] = [];
    (window as unknown as { layerSamples: string[] }).layerSamples = samples;
    const sample = () => {
      for (const node of document.querySelectorAll<HTMLElement>('.react-flow__node')) {
        if (getComputedStyle(node).visibility === 'hidden') samples.push(node.dataset.id ?? 'unknown');
      }
      if (samples.length < 1000) (window as unknown as { sampleFrame: number }).sampleFrame = requestAnimationFrame(sample);
    };
    (window as unknown as { sampleFrame: number }).sampleFrame = requestAnimationFrame(sample);
  });
  await editor.getByLabel('Layer title', { exact: true }).pressSequentially(' typing should not move the graph', { delay: 35 });
  expect(await page.evaluate(() => {
    cancelAnimationFrame((window as unknown as { sampleFrame: number }).sampleFrame);
    return (window as unknown as { layerSamples: string[] }).layerSamples;
  })).toEqual([]);
  expect(await transform()).toBe(before);
  await expect(editor.getByLabel('Layer title', { exact: true })).toBeFocused();
  const zoom = () => viewport.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  const input = editor.getByLabel('Premise for development', { exact: true });
  // Prompt-first expand mode requires an idea before opening the Assistant.
  await input.fill('A caretaker discovers a film showing her next move.');
  const start = await zoom();
  await input.hover();
  const bounds = (await input.boundingBox())!;
  const pointer = { x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y + bounds.height / 2) };
  await page.mouse.move(pointer.x, pointer.y);
  const worldPoint = () => page.locator('.react-flow').evaluate((el, point) => {
    const rect = el.getBoundingClientRect();
    const matrix = new DOMMatrix(getComputedStyle(el.querySelector('.react-flow__viewport')!).transform);
    return { x: (point.x - rect.left - matrix.e) / matrix.a, y: (point.y - rect.top - matrix.f) / matrix.a };
  }, pointer);
  const anchored = await worldPoint();
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -25);
  await page.keyboard.up('Control');
  await expect.poll(zoom).toBeGreaterThan(start);
  const afterZoom = await worldPoint();
  expect(afterZoom.x).toBeCloseTo(anchored.x, 2);
  expect(afterZoom.y).toBeCloseTo(anchored.y, 2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, 25);
  await page.keyboard.up('Control');
  await expect.poll(zoom).toBeCloseTo(start, 3);
  const ordinary = await transform();
  await input.dispatchEvent('wheel', { deltaY: 90, bubbles: true, cancelable: true });
  expect(await transform()).toBe(ordinary);
  await page.screenshot({ path: info.outputPath('story-edit-desktop.png') });
  await editor.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
  const assistantZoom = await zoom();
  await assistant.dispatchEvent('wheel', { deltaY: -25, metaKey: true, bubbles: true, cancelable: true, clientX: 700, clientY: 350 });
  await expect.poll(zoom).toBeGreaterThan(assistantZoom);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  await page.screenshot({ path: info.outputPath('assistant-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  await page.screenshot({ path: info.outputPath('assistant-mobile.png') });
});
