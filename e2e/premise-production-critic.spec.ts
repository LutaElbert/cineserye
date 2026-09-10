import { test, expect, type Page, type Locator } from '@playwright/test';
import { createDiagramPng } from './helpers';

const premise = 'Mara enters an abandoned cinema and discovers a film showing her next move. Make a 60-second vertical horror-mystery trailer. No dialogue. End with a cliffhanger.';

async function openEditor(page: Page) {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible({ timeout: 20_000 });
  const chooser = page.getByRole('dialog', { name: /Start with your scene/ });
  if (await chooser.count()) {
    await chooser.getByRole('button', { name: /Start with an idea/ }).click();
    await expect(chooser).toHaveCount(0);
  }
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  // Keep a real unrelated sibling for the no-layout-on-typing assertion, without
  // introducing an unallocated legacy scene into the idea-first production flow.
  await page.getByRole('region', { name: 'Story premise layer editor', exact: true }).getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('region', { name: 'Canvas workspace', exact: true }).getByRole('button', { name: 'Add filmmaking layer', exact: true }).click();
  const addLayer = page.getByRole('dialog', { name: 'Add a filmmaking layer', exact: true });
  await addLayer.getByRole('button', { name: /^Note(?: |$)/ }).click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await page.getByRole('button', { name: 'Fit View', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
}

async function isolate(page: Page) {
  if (new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').port !== '3040') test.skip(true, 'Independent critic requires the task-owned fixture server on 3040.');
  await page.route('**/api/cinema/**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && /"mode"\s*:\s*"live"/.test(request.postData() ?? '')) throw new Error('Critic never authorizes live calls.');
    await route.continue();
  });
}

async function focus(page: Page, name: string) {
  const action = page.getByRole('button', { name, exact: true });
  if (await action.isVisible()) await action.click({ timeout: 5_000 });
}

async function contained(page: Page, editor: Locator) {
  expect(await editor.evaluate((node) => Boolean(node.closest('.react-flow__node')))).toBe(true);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  const box = (await editor.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'short', width: 1024, height: 500 }, { name: 'narrow', width: 390, height: 844 }]) {
  test(`critic story and assistant at ${viewport.name}`, async ({ page }, info) => {
    await isolate(page); await page.setViewportSize(viewport); await openEditor(page);
    const posts: string[] = [];
    page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts.push(request.url()); });
    await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
    await focus(page, 'Focus story editor');
    const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
    await contained(page, editor);
    await editor.getByLabel('Layer title', { exact: true }).fill('The Reel That Knows Tomorrow');
    const input = editor.getByRole('textbox', { name: 'Premise for development', exact: true });
    await input.fill(premise);
    const geometry = await page.locator('.react-flow__viewport').getAttribute('style');
    const siblings = await page.locator('.react-flow__node:not([data-id="story-premise"])').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('style')));
    await input.pressSequentially(' Quiet tension.', { delay: 12 });
    expect(await page.locator('.react-flow__viewport').getAttribute('style')).toBe(geometry);
    expect(await page.locator('.react-flow__node:not([data-id="story-premise"])').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('style')))).toEqual(siblings);
    await expect(editor.getByRole('button', { name: 'Generate', exact: true })).toBeInViewport();
    expect(posts).toHaveLength(0);
    await page.screenshot({ path: info.outputPath(`${viewport.name}-story.png`) });
    await editor.locator('.composer-controls').scrollIntoViewIfNeeded();
    await expect(editor.locator('.composer-controls')).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`${viewport.name}-story-controls.png`) });
    await editor.getByRole('button', { name: 'Generate', exact: true }).click();
    await focus(page, 'Focus story assistant');
    const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
    await contained(page, assistant);
    const understand = assistant.getByRole('button', { name: 'Continue', exact: true });
    await expect(understand).toBeEnabled();
    expect(posts).toHaveLength(0);
    await page.screenshot({ path: info.outputPath(`${viewport.name}-assistant-initial.png`) });
    await understand.click();
    await expect(assistant.getByRole('heading', { name: 'Here’s what I understood', exact: true })).toBeVisible();
    await expect(assistant.getByRole('heading', { name: 'Here’s what I understood', exact: true })).toBeInViewport();
    await expect(assistant.getByRole('button', { name: 'Continue', exact: true })).toBeInViewport();
    await expect(assistant.locator('.assistant-questions fieldset')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`${viewport.name}-assistant-understood.png`) });
    await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
    const generate = assistant.getByRole('button', { name: 'Draft scene outline', exact: true });
    await expect(generate).toBeEnabled();
    await generate.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`${viewport.name}-assistant-plan-review.png`) });
    await generate.click();
    const proposals = assistant.locator('.assistant-proposal-review');
    await expect(proposals.locator('.assistant-scene-row')).toHaveCount(3);
    await proposals.locator('.assistant-scene-row').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`${viewport.name}-assistant-proposals.png`) });
    await assistant.getByRole('button', { name: 'Add 3 scenes', exact: true }).click();
    await expect(assistant.getByRole('button', { name: 'Plan shots', exact: true })).toBeVisible();
    expect(posts.map((url) => new URL(url).pathname)).toEqual(['/api/cinema/story-assistant', '/api/cinema/story-assistant', '/api/cinema/develop-story']);
    await assistant.getByRole('button', { name: 'Plan shots', exact: true }).click();
    const sceneReview = assistant.getByRole('region', { name: 'Assistant shot planning', exact: true });
    await expect(sceneReview.getByRole('heading', { name: 'Review shot planning', exact: true })).toBeVisible();
    await expect(sceneReview).toContainText('Fixture planning · no AI calls');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    expect(posts).toHaveLength(3); // Opening a review never dispatches scene planning.
    await page.screenshot({ path: info.outputPath(`${viewport.name}-scene-review-defaults.png`) });
    await sceneReview.getByRole('button', { name: 'Create 3 fixture plans', exact: true }).click();
    await expect(sceneReview.locator('.assistant-plan-row[data-status="ready"]')).toHaveCount(3, { timeout: 20_000 });
    await expect(sceneReview.getByRole('button', { name: 'Add selected shot plans', exact: true })).toBeEnabled();
    await sceneReview.getByRole('button', { name: 'Add selected shot plans', exact: true }).click();
    await expect(sceneReview.locator('.assistant-plan-row[data-status="added"]')).toHaveCount(3);
    await sceneReview.getByText('Review sequence & export', { exact: true }).click();
    const sequence = sceneReview.getByRole('region', { name: 'Review sequence', exact: true });
    await sequence.scrollIntoViewIfNeeded();
    await expect(sequence.getByText('No local approved clip for this shot.', { exact: true })).toBeVisible();
    await expect(sequence.getByRole('button', { name: 'Render silent MP4 locally', exact: true })).toBeDisabled();
    await page.screenshot({ path: info.outputPath(`${viewport.name}-sequence-missing.png`) });
    await sceneReview.getByRole('button', { name: 'Open shots & media', exact: true }).nth(1).click();
    await focus(page, 'Focus layer editor');
    const shotEditor = page.getByRole('region', { name: 'Shot layer editor', exact: true });
    await contained(page, shotEditor);
    await expect(shotEditor.getByRole('region', { name: 'Shot media workbench', exact: true })).toBeVisible();
    await expect(shotEditor.getByRole('button', { name: 'Generate storyboard', exact: true })).toBeDisabled();
    expect(posts.every((url) => /\/(story-assistant|develop-story|plan-scenes)$/.test(new URL(url).pathname))).toBe(true);
  });

  test(`critic shot workbench at ${viewport.name}`, async ({ page }, info) => {
    await isolate(page); await page.setViewportSize(viewport); await page.goto('/');
    await expect(page.locator('main[data-ready="true"]')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Explore.*sample/i }).first().click();
    const shot = page.locator('.react-flow__node[data-id="cine-shot-03"]');
    await shot.dblclick();
    await page.screenshot({ path: info.outputPath(`${viewport.name}-shot-before-focus.png`) });
    await focus(page, 'Focus layer editor');
    const editor = page.getByRole('region', { name: 'Shot layer editor', exact: true });
    await contained(page, editor);
    await expect(editor.getByRole('region', { name: 'Shot media workbench', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`${viewport.name}-shot-plan.png`) });
    await expect(editor.getByRole('button', { name: 'Generate storyboard', exact: true })).toBeDisabled();
    await editor.getByRole('checkbox', { name: /I confirm the .* direction/ }).check();
    await editor.getByRole('button', { name: 'Generate storyboard', exact: true }).click();
    await expect(editor.locator('.storyboard-frame')).toHaveCount(3);
    await editor.locator('.storyboard-frame').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`${viewport.name}-shot-images.png`) });
    await editor.locator('.storyboard-frame').first().getByRole('button', { name: 'Approve', exact: true }).click();
    await editor.getByRole('checkbox', { name: /I confirm one 4s 720p silent clip/ }).check();
    await editor.getByRole('button', { name: 'Generate one clip', exact: true }).click();
    await expect(editor.locator('.video-version')).toHaveCount(1, { timeout: 20_000 });
    await expect.poll(() => editor.locator('.video-version video').evaluate((element: HTMLVideoElement) => element.readyState), { timeout: 8_000 }).toBeGreaterThanOrEqual(1);
    await expect(editor.locator('.video-version').getByText(/^Requested:/)).toBeVisible();
    await expect(editor.locator('.video-version').getByText(/^Decoded footage:/)).toBeVisible();
    await expect(editor.getByText(/Fixture test footage: actual duration/)).toBeVisible();
    await expect(editor.getByText('Offline sample only · 1s · 160×90 · not a generated production take', { exact: true })).toBeVisible();
    await editor.getByRole('button', { name: 'Approve clip', exact: true }).click();
    await editor.locator('.video-version').scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`${viewport.name}-shot-video.png`) });
    await editor.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Fit View', exact: true }).click({ timeout: 5_000 });
    await info.attach('compact-shot-geometry', { body: JSON.stringify(await shot.evaluate((node) => {
      const outer = node.getBoundingClientRect(), inner = node.querySelector('.concept-node')!.getBoundingClientRect();
      return { outer: outer.toJSON(), inner: inner.toJSON() };
    })), contentType: 'application/json' });
    await page.screenshot({ path: info.outputPath(`${viewport.name}-compact-with-media.png`) });
    const mediaCard = (await shot.locator('.concept-node').boundingBox())!;
    const nextCard = (await page.locator('.react-flow__node[data-id="cine-shot-04"] .concept-node').boundingBox())!;
    expect(mediaCard.y + mediaCard.height).toBeLessThanOrEqual(nextCard.y + 1);
  });
}

test('critic actual expanded-node dragging zoom and global Assistant entry', async ({ page }) => {
  await isolate(page); await page.setViewportSize({ width: 1440, height: 900 }); await openEditor(page);
  await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  const input = editor.getByRole('textbox', { name: 'Premise for development', exact: true });
  await input.fill(premise);
  const node = page.locator('.react-flow__node[data-id="story-premise"]');
  const before = await node.getAttribute('style');
  const header = (await editor.locator('.layer-drag-handle').boundingBox())!;
  await page.mouse.move(header.x + 30, header.y + 20); await page.mouse.down();
  await page.mouse.move(header.x + 65, header.y + 50, { steps: 8 }); await page.mouse.up();
  expect(await node.getAttribute('style')).not.toBe(before);
  const view = page.locator('.react-flow__viewport');
  const oldZoom = await view.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a);
  await input.hover(); await page.keyboard.down('Control'); await page.mouse.wheel(0, -35); await page.keyboard.up('Control');
  await expect.poll(() => view.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a)).toBeGreaterThan(oldZoom);
  await editor.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Open story assistant', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Story Assistant', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hide story assistant', exact: true }).click();
  await page.getByRole('button', { name: 'Open story assistant', exact: true }).click();
  await expect(page.locator('.react-flow__node-storyAssistant')).toHaveCount(1);
});

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'narrow', width: 390, height: 844 }]) {
  test(`critic local image mentions and permissions at ${viewport.name}`, async ({ page }, info) => {
    await isolate(page); await page.setViewportSize(viewport); await openEditor(page);
    const posts: string[] = [];
    page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts.push(request.url()); });
    await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
    const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
    await editor.getByRole('textbox', { name: 'Premise for development', exact: true }).fill(premise + ' Use ');
    await editor.locator('input[type="file"]').setInputFiles({ name: 'cinema-reference.png', mimeType: 'image/png', buffer: await createDiagramPng(page) });
    await editor.getByRole('button', { name: 'Mention @image1', exact: true }).click();
    await expect(editor.getByRole('textbox', { name: 'Premise for development', exact: true })).toHaveValue(/@image1/);
    await page.screenshot({ path: info.outputPath(`${viewport.name}-story-image-mention.png`) });
    await editor.getByRole('button', { name: 'Review reference permissions · 1', exact: true }).click();
    const policy = editor.getByRole('region', { name: 'Reference permissions', exact: true });
    await policy.getByRole('combobox', { name: 'Rights for @image1', exact: true }).selectOption('creator-owned');
    await policy.getByRole('checkbox', { name: 'Story development', exact: true }).check();
    await policy.getByRole('checkbox', { name: 'Image generation', exact: true }).check();
    await page.screenshot({ path: info.outputPath(`${viewport.name}-reference-permissions.png`) });
    await policy.getByRole('button', { name: 'Save permissions for @image1', exact: true }).click();
    await expect(policy.getByRole('status')).toHaveText('Permissions saved locally. Every live generation still needs separate approval.');
    expect(posts).toHaveLength(0);
    await contained(page, editor);
  });
}
