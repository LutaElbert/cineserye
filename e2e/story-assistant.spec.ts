import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createDiagramPng, waitForSaved, openSelectedScenePlanner } from './helpers';
import { readFile } from 'node:fs/promises';
import { fulfillWorkspaceMode } from './workspace-capability-helpers';

test.beforeEach(async ({ request }) => {
  expect(process.env.CINESERYE_E2E_RUNTIME).toBe('node-fixture');
  const status = await request.get('/api/cinema/provider-status');
  expect((await status.json()).mode).toBe('fixture');
});

async function showQuestion(assistant: Locator, label: string) {
  for (let index = 0; index < 12; index++) {
    if (await assistant.getByLabel(label, { exact: true }).count()) {
      await expect(assistant.getByLabel(label, { exact: true })).toBeVisible();
      return;
    }
    const next = assistant.getByRole('button', { name: /^(Next|Skip)$/ });
    await expect(next).toBeEnabled();
    await next.click();
  }
  throw new Error(`Question was not reachable: ${label}`);
}

async function confirmQuestions(assistant: Locator) {
  for (let index = 0; index < 12; index++) {
    const next = assistant.getByRole('button', { name: /^(Next|Skip)$/ });
    if (!(await next.count())) break;
    await expect(next).toBeEnabled();
    await next.click();
  }
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
}

async function openAssistant(page: Page, premise = 'A 60-second vertical horror short about four friends trapped in a cursed board game. No dialogue.') {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Start with an idea/ }).click();
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  await editor.getByLabel('Premise for development', { exact: true }).fill(premise);
  if (!premise) await editor.getByRole('button', { name: 'Surprise me', exact: true }).click();
  await editor.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  return page.getByRole('region', { name: 'Story Assistant', exact: true });
}
async function analyze(page: Page) {
  const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
  await expect(assistant.getByRole('button', { name: 'Review analysis estimate' })).toHaveCount(0);
  await expect(assistant.getByLabel('I approve this fixture analysis — no paid call.', { exact: true })).toHaveCount(0);
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  return assistant;
}
test('detailed direction skips required questions, saves optional corrections and hands reviewed scenes to production', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const posts: string[] = []; page.on('request', (request) => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname); });
  await page.setViewportSize({ width: 1440, height: 900 });
  const assistant = await openAssistant(page);
  expect(posts).toEqual([]);
  await expect(assistant.locator('details:not(.assistant-secondary-tools)')).toHaveCount(0);
  await expect(assistant.locator('details.assistant-secondary-tools')).toHaveCount(1);
  await expect(assistant.locator('details.assistant-secondary-tools')).not.toHaveAttribute('open');
  await expect(assistant.getByRole('button', { name: 'Edit full brief manually', exact: true })).not.toBeVisible();
  await expect(assistant.getByRole('button', { name: /Collapse|Expand assistant/ })).toHaveCount(0);
  const canonicalGeometry = () => page.locator('.react-flow__node:not([data-id^="story-assistant:"])').evaluateAll((elements) => elements.map((element) => ({ id: element.getAttribute('data-id'), position: (element as HTMLElement).style.transform })));
  const before = await canonicalGeometry();
  await analyze(page);
  await expect(assistant.getByRole('heading', { name: 'Here’s what I understood' })).toBeVisible();
  await expect(assistant.getByLabel('Total runtime (seconds)', { exact: true })).toHaveCount(0);
  await expect(assistant.getByLabel('Aspect ratio', { exact: true })).toHaveCount(0);
  await expect(assistant).toContainText('four friends');
  await expect(assistant.locator('.assistant-questions fieldset')).toHaveCount(0);
  await expect(assistant).toContainText('suggested');
  expect(posts.filter((path) => path === '/api/cinema/story-assistant')).toHaveLength(1);
  await assistant.getByRole('button', { name: 'Correct understood details' }).click();
  await showQuestion(assistant, 'Ending direction');
  await expect(assistant.getByLabel('Ending direction', { exact: true })).toHaveValue('');
  await assistant.getByLabel('Ending direction', { exact: true }).fill('They escape together but the board resets.');
  await waitForSaved(page); await page.reload();
  await assistant.getByRole('button', { name: 'Correct understood details' }).click();
  await showQuestion(assistant, 'Ending direction');
  await expect(assistant.getByLabel('Ending direction', { exact: true })).toHaveValue('They escape together but the board resets.');
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('assistant-questions-desktop.png') });
  expect((await new AxeBuilder({ page }).include('.story-assistant-node').analyze()).violations).toEqual([]);
  await confirmQuestions(assistant);
  await expect(assistant.getByRole('heading', { name: 'Ready to shape your scenes', exact: true })).toBeVisible();
  expect(posts.filter((path) => path === '/api/cinema/story-assistant')).toHaveLength(2);
  expect(posts.filter((path) => path === '/api/cinema/develop-story')).toHaveLength(0);
  expect(await canonicalGeometry()).toEqual(before);
  await expect(assistant.getByLabel('I understand these are sample outputs and approve fixture generation.', { exact: true })).toHaveCount(0);
  await assistant.getByRole('button', { name: 'Draft scene outline', exact: true }).click();
  await expect(assistant.locator('.story-proposal')).toHaveCount(3);
  for (const [index, seconds] of [15, 20, 25].entries()) {
    await assistant.getByRole('button', { name: `Edit proposal ${index + 1}`, exact: true }).click();
    await expect(assistant.getByLabel(`Proposal ${index + 1} title`, { exact: true })).toBeVisible();
    await expect(assistant.getByLabel(`Proposal ${index + 1} duration`, { exact: true })).toHaveValue(String(seconds));
    await assistant.getByRole('button', { name: 'Done editing', exact: true }).click();
  }
  await page.screenshot({ path: testInfo.outputPath('assistant-scene-review.png') });
  await assistant.getByRole('button', { name: 'Add 3 scenes', exact: true }).click();
  await expect(assistant.getByRole('button', { name: 'Plan shots', exact: true })).toBeVisible();
  await expect(assistant.getByRole('button', { name: 'Reopen assistant', exact: true })).toHaveCount(0);
  const scenes = page.locator('.react-flow__node[data-id*="proposal-"]'); await expect(scenes).toHaveCount(3);
  for (const node of before) expect((await canonicalGeometry()).find((item) => item.id === node.id)).toEqual(node);
  const edges = await page.locator('.react-flow__edge').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-id')));
  expect(edges.filter((id) => id?.includes('association'))).toHaveLength(1);
  await assistant.getByRole('button', { name: 'Hide story assistant' }).click();
  await page.getByRole('button', { name: 'Fit View', exact: true }).click();
  await page.locator('.react-flow__node[data-id$="proposal-2"]').click();
  await openSelectedScenePlanner(page);
  const brief = page.getByRole('region', { name: 'Generate shot plan', exact: true });
  await expect(brief.getByLabel('Target duration (seconds)', { exact: true })).toHaveValue('20');
  await expect(brief.getByLabel('Genre and tone', { exact: true })).toHaveValue(/horror/i);
  await brief.getByText('Adjust scene direction and production options', { exact: true }).click();
  await brief.getByLabel('Location and period', { exact: true }).fill('Contemporary Manila, a room with a cursed board game');
  await brief.getByRole('button', { name: 'Generate shot plan', exact: true }).click();
  const review = page.getByRole('region', { name: 'Shot proposal review' });
  await expect(review).toBeVisible();
  await review.getByRole('button', { name: 'Accept plan', exact: true }).click();
  await page.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await page.getByRole('tab', { name: 'Visuals', exact: true }).click();
  const visuals = page.getByRole('tabpanel', { name: 'Visuals' });
  await expect(visuals.getByRole('button', { name: 'Generate storyboard', exact: true })).toBeDisabled();
  expect(posts).not.toContain('/api/cinema/generate-storyboard');
  expect(posts).not.toContain('/api/cinema/generate-video');
  await visuals.getByRole('checkbox', { name: /I confirm the .* direction/ }).check();
  await visuals.getByRole('button', { name: 'Generate storyboard', exact: true }).click();
  await expect(visuals.locator('.storyboard-frame')).toHaveCount(3);
  const frameDownload = page.waitForEvent('download');
  await visuals.getByRole('link', { name: 'Download storyboard variant 1', exact: true }).click();
  expect(await readFile((await (await frameDownload).path())!, 'utf8')).toContain('<svg');
  await visuals.locator('.storyboard-frame').first().getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(visuals.getByRole('button', { name: 'Generate one clip', exact: true })).toBeDisabled();
  await expect(visuals.getByLabel('Video duration', { exact: true })).toHaveValue('4');
  await visuals.getByRole('checkbox', { name: /I confirm one 4s 720p silent clip/ }).check();
  await visuals.getByRole('button', { name: 'Generate one clip', exact: true }).click();
  await expect(visuals.locator('.video-version')).toHaveCount(1, { timeout: 15_000 });
  await visuals.getByRole('button', { name: 'Approve clip', exact: true }).click();
  const clipDownload = page.waitForEvent('download');
  await visuals.getByRole('button', { name: /Download video clip/ }).click();
  const clip = await clipDownload;
  expect(clip.suggestedFilename()).toMatch(/\.mp4$/);
  expect((await readFile((await clip.path())!)).subarray(4, 8).toString()).toBe('ftyp');
  const count = posts.length;
  await waitForSaved(page); await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await page.getByRole('tab', { name: 'Visuals', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Visuals' }).locator('.video-version')).toContainText('Approved clip');
  expect(posts).toHaveLength(count);
});
test('complete direction requires explicit confirmation; correcting a known field overrides extraction', async ({ page }) => {
  const assistant = await openAssistant(page, 'A 60-second vertical horror short. No dialogue. Ending: she escapes.'); await analyze(page);
  await expect(assistant.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  await expect(assistant.getByRole('button', { name: 'Draft scene outline', exact: true })).toHaveCount(0);
  await assistant.getByRole('button', { name: 'Correct understood details' }).click();
  await showQuestion(assistant, 'Total runtime (seconds)');
  await expect(assistant.getByLabel('Total runtime (seconds)', { exact: true })).toHaveValue('');
  await assistant.getByLabel('Total runtime (seconds)', { exact: true }).fill('120');
  await confirmQuestions(assistant);
  await expect(assistant.getByRole('heading', { name: 'Ready to shape your scenes', exact: true })).toBeVisible();
  await expect(assistant.getByText('120s total', { exact: true })).toBeVisible();
  await waitForSaved(page); await page.reload();
  await expect(assistant.getByRole('heading', { name: 'Ready to shape your scenes', exact: true })).toBeVisible();
  await expect(assistant.getByText('120s total', { exact: true })).toBeVisible();
});
test('hide/reopen during an analysis does not abort or duplicate it, and cancel never applies late output', async ({ page }) => {
  const assistant = await openAssistant(page);
  let release!: () => void;
  let gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  await page.route('**/api/cinema/story-assistant', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    calls++; const response = await route.fetch(); await gate; await route.fulfill({ response }).catch(() => {});
  });
  await analyze(page); await expect(assistant.getByRole('button', { name: 'Stop request', exact: true })).toBeVisible();
  await assistant.getByRole('button', { name: 'Hide story assistant' }).click();
  await expect(assistant).not.toBeVisible();
  await page.getByRole('button', { name: 'Focus story assistant' }).click();
  await expect(assistant.getByRole('button', { name: 'Stop request', exact: true })).toBeVisible();
  release(); await expect(assistant.getByRole('button', { name: 'Continue', exact: true })).toBeVisible(); expect(calls).toBe(1);
  await assistant.getByRole('button', { name: 'Correct understood details' }).click();
  await showQuestion(assistant, 'Ending direction');
  await assistant.getByLabel('Ending direction', { exact: true }).fill('Keep this earlier ending for comparison.');
  // Source change invalidates old questions, but retains them for recovery/audit.
  await page.getByRole('button', { name: 'Fit View', exact: true }).click();
  await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
  await page.getByRole('button', { name: 'Focus story editor' }).click();
  await page.getByRole('textbox', { name: 'Premise for development', exact: true }).fill('A different 60-second vertical horror story. No dialogue.');
  await page.getByRole('region', { name: 'Story premise layer editor' }).getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Focus story assistant' }).click();
  await expect(assistant.getByText('Your idea changed. Review it once more; your earlier draft is saved.', { exact: true })).toBeVisible();
  gate = new Promise<void>((resolve) => { release = resolve; });
  await analyze(page); await assistant.getByRole('button', { name: 'Stop request', exact: true }).click(); release();
  await expect(assistant).toContainText('Your request was stopped');
  await assistant.getByRole('button', { name: 'Saved drafts', exact: true }).click();
  const earlierAnswers = assistant.getByRole('region', { name: 'Earlier answers', exact: true });
  await expect(earlierAnswers.getByText('Keep this earlier ending for comparison.', { exact: true })).toBeVisible();
  await expect(assistant.getByLabel('Ending direction', { exact: true })).toHaveCount(0);
  expect(calls).toBe(2);
  await expect(page.locator('.react-flow__node:not([data-id^="story-assistant:"])')).toHaveCount(1);
});
test('empty Surprise uses bounded rounds with unselected choices, and never inserts scenes on confirmation', async ({ page }) => {
  const assistant = await openAssistant(page, '');
  await analyze(page);
  await expect(assistant.getByRole('radiogroup', { name: 'Aspect ratio', exact: true })).toBeVisible();
  await expect(assistant.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(assistant.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await expect(assistant.getByLabel('Total runtime (seconds)', { exact: true })).toHaveCount(0);
  await assistant.getByRole('radio', { name: '16:9', exact: true }).check();
  await assistant.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(assistant.getByLabel('Total runtime (seconds)', { exact: true })).toHaveValue('');
  await assistant.getByRole('button', { name: '60s', exact: true }).click();
  await expect(assistant.getByLabel('Tone', { exact: true })).toHaveCount(0);
  await expect(assistant.getByLabel('Ending direction', { exact: true })).toHaveCount(0);
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'Explore a few story directions', exact: true })).toBeVisible();
  await expect(page.locator('.react-flow__node:not([data-id^="story-assistant:"])')).toHaveCount(1);
});
test('assistant stays a canvas node on narrow screens and Escape hides it without data loss', async ({ page }, testInfo) => {
  const assistant = await openAssistant(page); await analyze(page);
  await assistant.getByRole('button', { name: 'Correct understood details' }).click();
  await showQuestion(assistant, 'Ending direction');
  await expect(assistant.getByLabel('Ending direction', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Focus story assistant' }).click();
  await assistant.getByLabel('Ending direction', { exact: true }).fill('A final twist');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(await assistant.evaluate((element) => Boolean(element.closest('.react-flow__node')))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('assistant-mobile.png') });
  await assistant.getByLabel('Ending direction', { exact: true }).press('Escape'); await expect(assistant).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Focus story assistant', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Focus story assistant' }).click();
  await expect(assistant.getByLabel('Ending direction', { exact: true })).toHaveValue('A final twist');
});

test('analysis transfers only approved purpose-scoped notes and references remain explicit scope', async ({ page }) => {
  const assistant = await openAssistant(page);
  await assistant.getByRole('button', { name: 'Hide story assistant', exact: true }).click();
  await page.getByRole('button', { name: 'Fit View', exact: true }).click();
  await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
  await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  // A local, unapproved image opens the premise reference library, but must not
  // join the approved story-development note in the analysis transfer.
  const png = await createDiagramPng(page);
  const chooser = page.waitForEvent('filechooser');
  await editor.getByRole('button', { name: 'Add story reference image', exact: true }).click();
  await (await chooser).setFiles({ name: 'private-local-reference.png', mimeType: 'image/png', buffer: png });
  await editor.getByRole('button', { name: 'Review reference permissions · 1', exact: true }).click();
  await editor.getByText('Advanced library: notes, scope and archive', { exact: true }).click();
  await editor.getByLabel('Reference title', { exact: true }).fill('Ending guide');
  await editor.getByLabel('Reference note', { exact: true }).fill('Ending: the friends escape together.');
  await editor.getByRole('combobox', { name: 'Rights', exact: true }).selectOption('creator-owned');
  await editor.getByLabel('I approve this reference content', { exact: true }).check();
  await editor.getByLabel('story-development', { exact: true }).check();
  await editor.getByRole('button', { name: 'Add note reference', exact: true }).click();
  await editor.getByLabel('Reference title', { exact: true }).fill('Private shot note');
  await editor.getByLabel('Reference note', { exact: true }).fill('Do not transfer this to understanding.');
  await editor.getByRole('combobox', { name: 'Rights', exact: true }).selectOption('creator-owned');
  await editor.getByLabel('I approve this reference content', { exact: true }).check();
  await editor.getByLabel('story-development', { exact: true }).uncheck();
  await editor.getByLabel('shot-planning', { exact: true }).check();
  await editor.getByRole('button', { name: 'Add note reference', exact: true }).click();
  await editor.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  await expect(assistant.getByRole('combobox', { name: /provider mode/i })).toHaveCount(0);
  await expect(assistant.getByText('Advanced options', { exact: true })).toHaveCount(0);
  await expect(assistant).toContainText('Ending guide');
  const request = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/cinema/story-assistant'));
  await analyze(page);
  expect((await request).postDataJSON().forwardedProps.input.references).toEqual([expect.objectContaining({ title: 'Ending guide', version: 1 })]);
  await expect(assistant.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  await expect(assistant).toContainText('the friends escape together');
});

test('reload during a request recovers the durable checkpoint with a GET, never another analysis', async ({ page }) => {
  const assistant = await openAssistant(page);
  let release!: () => void; const held = new Promise<void>((resolve) => { release = resolve; });
  let persisted = false, posts = 0;
  await page.route('**/api/cinema/story-assistant', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    posts++; const response = await route.fetch(); persisted = true; await held; await route.fulfill({ response }).catch(() => {});
  });
  await analyze(page); await expect.poll(() => persisted).toBe(true);
  await page.reload(); release();
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  await assistant.getByRole('button', { name: 'Check saved analysis', exact: true }).click();
  await expect(assistant.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  expect(posts).toBe(1);
});

test('an incomplete idea asks only missing runtime and format before confirming, without generating scenes', async ({ page }) => {
  const posts: string[] = []; page.on('request', (request) => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname); });
  const assistant = await openAssistant(page, 'Mara discovers a cursed cinema.');
  await analyze(page);
  await expect(assistant.getByRole('radiogroup', { name: 'Aspect ratio', exact: true })).toBeVisible();
  await expect(assistant.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(assistant.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await expect(assistant.locator('.assistant-questions fieldset')).toHaveCount(1);
  expect(posts).toEqual(['/api/cinema/story-assistant']);
  await assistant.getByRole('radio', { name: '9:16', exact: true }).check();
  await assistant.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(assistant.getByLabel('Total runtime (seconds)', { exact: true })).toHaveValue('');
  await expect(assistant.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await assistant.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(assistant.getByRole('radio', { name: '9:16', exact: true })).toBeChecked();
  await assistant.getByRole('button', { name: 'Next', exact: true }).click();
  await assistant.getByRole('button', { name: '60s', exact: true }).click();
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'Ready to shape your scenes', exact: true })).toBeVisible();
  expect(posts).toEqual(['/api/cinema/story-assistant', '/api/cinema/story-assistant']);
  await expect(page.locator('.react-flow__node:not([data-id^="story-assistant:"])')).toHaveCount(1);
});

test('Assistant follows workspace mode and blocks an unavailable live feature without sending a paid request', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') posts.push(request.url()); });
  await page.route('**/api/cinema/workflow-capabilities', (route) => fulfillWorkspaceMode(route, 'live'));
  await page.route('**/api/cinema/story-assistant?mode=live', (route) => route.fulfill({ json: {
    enabled: true, mode: 'live', model: 'review-only-test-model', quoteId: 'a'.repeat(64), cost: 0.01, ceiling: 1,
    ready: false, blockers: ['Live story understanding is not enabled for this workspace.'],
  } }));
  await page.route('**/api/cinema/**', (route) => route.request().method() === 'POST' ? route.abort('blockedbyclient') : route.fallback());
  const assistant = await openAssistant(page);
  await expect(assistant.getByRole('combobox', { name: /provider mode/i })).toHaveCount(0);
  await expect(assistant.getByRole('button', { name: 'Approve & continue', exact: true })).toBeDisabled();
  await expect(assistant.getByRole('alert')).toContainText('Live story understanding is not enabled');
  await expect(assistant).toContainText('Est. $0.01 · allowance $1. Actual charges may differ.');
  await expect(assistant).not.toContainText('Fixture analysis');
  expect(posts).toEqual([]);
});
