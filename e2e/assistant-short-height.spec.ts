import { expect, test, type Locator, type Page } from '@playwright/test';

async function openAssistant(page: Page, premise: string) {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Start with an idea/ }).click();
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  await editor.getByRole('textbox', { name: 'Premise for development', exact: true }).fill(premise);
  await editor.getByRole('button', { name: 'Generate', exact: true }).click();
  return page.getByRole('region', { name: 'Story Assistant', exact: true });
}
async function usefulBody(page: Page, assistant: Locator, minimum = 100) {
  const geometry = await assistant.evaluate((node) => {
    const header = node.querySelector('header')!.getBoundingClientRect();
    const footer = [...node.querySelectorAll<HTMLElement>('.assistant-stage-footer')].find((element) => element.getClientRects().length)!;
    const surface = node.querySelector('.assistant-expanded-content')!.getBoundingClientRect();
    const action = footer.getBoundingClientRect();
    const body = [...node.querySelectorAll<HTMLElement>('.assistant-stage-scroll')].find((element) => element.getClientRects().length)!.getBoundingClientRect();
    return { useful: Math.min(body.bottom, action.top, surface.bottom) - Math.max(body.top, surface.top), headerBottom: header.bottom,
      surfaceTop: surface.top, footerTop: action.top, footerBottom: action.bottom, bottom: node.getBoundingClientRect().bottom };
  });
  expect(geometry.useful).toBeGreaterThanOrEqual(minimum);
  expect(geometry.surfaceTop).toBeGreaterThanOrEqual(geometry.headerBottom - 1);
  expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.bottom + 1);
  const bounds = (await assistant.boundingBox())!;
  const toolbar = (await page.locator('.canvas-toolbar').boundingBox())!;
  const controls = (await page.locator('.react-flow__controls').boundingBox())!;
  expect(bounds.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height - 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(controls.y + 1);
  await expect(assistant.locator('.assistant-stage-footer .primary-button:visible')).toBeInViewport();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
}
test.beforeEach(async ({ page }) => {
  expect(process.env.CINESERYE_E2E_RUNTIME).toBe('node-fixture');
  await page.setViewportSize({ width: 735, height: 389 });
  await page.route('**/api/cinema/**', async (route) => {
    if (route.request().method() === 'POST' && /"mode"\s*:\s*"live"/.test(route.request().postData() ?? '')) return route.abort('blockedbyclient');
    await route.continue();
  });
});

test('very short Assistant shares content scroll and retains approval, outline and history', async ({ page }, info) => {
  const assistant = await openAssistant(page, 'Four friends discover a cursed board game. A 60-second vertical horror mystery, no dialogue. All four survive.');
  await expect(assistant.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('short-assistant-initial.png') });
  // The new invitation has just a heading and two short sentences, not a form.
  // Its entire explanation must fit; later interactive stages retain the 100px gate.
  await usefulBody(page, assistant, 80);
  await expect(assistant.getByText(/Includes your premise, current scenes/)).toBeInViewport({ ratio: 0.999 });
  await expect(assistant.locator('.assistant-stage-footer:visible')).toContainText('no AI or paid calls');
  const viewport = page.locator('.react-flow__viewport'), transform = await viewport.getAttribute('style');
  const surface = assistant.locator('.assistant-expanded-content');
  const bodyBox = (await surface.boundingBox())!;
  await page.mouse.move(bodyBox.x + 100, bodyBox.y + 30);
  await page.mouse.wheel(0, 180);
  await expect.poll(() => surface.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await viewport.getAttribute('style')).toBe(transform);
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'Here’s what I understood', exact: true })).toBeInViewport();
  await usefulBody(page, assistant);
  await page.screenshot({ path: info.outputPath('short-assistant-understood.png') });
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('button', { name: 'Draft scene outline', exact: true })).toBeEnabled();
  await usefulBody(page, assistant);
  await assistant.getByRole('button', { name: 'Draft scene outline', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'Your scene outline', exact: true })).toBeInViewport();
  await usefulBody(page, assistant);
  await page.screenshot({ path: info.outputPath('short-assistant-outline.png') });
  await assistant.getByRole('button', { name: 'Revise selected scenes', exact: true }).click();
  const revision = assistant.getByRole('textbox', { name: 'Tell the Assistant what to change', exact: true });
  const beforeTyping = await viewport.getAttribute('style');
  await revision.click();
  await revision.fill('Make the final scene more hopeful.');
  await expect(revision).toHaveValue('Make the final scene more hopeful.');
  await expect(revision).toBeInViewport();
  const visibleRevisionHeight = await revision.evaluate((field) => {
    const node = field.closest('.assistant-v2')!;
    const fieldBox = field.getBoundingClientRect();
    const footer = [...node.querySelectorAll<HTMLElement>('.assistant-stage-footer')].find((element) => element.getClientRects().length)!.getBoundingClientRect();
    const header = node.querySelector('header')!.getBoundingClientRect();
    return Math.min(fieldBox.bottom, footer.top) - Math.max(fieldBox.top, header.bottom);
  });
  expect(visibleRevisionHeight).toBeGreaterThanOrEqual(48);
  await expect(assistant.locator('.assistant-scroll-hint')).not.toBeVisible();
  expect(await viewport.getAttribute('style')).toBe(beforeTyping);
  const focused = await assistant.evaluate((node) => {
    const frame = node.getBoundingClientRect();
    const header = node.querySelector('header')!.getBoundingClientRect();
    const footer = [...node.querySelectorAll<HTMLElement>('.assistant-stage-footer')].find((element) => element.getClientRects().length)!.getBoundingClientRect();
    return { scrollTop: node.scrollTop, top: frame.top, bottom: frame.bottom, headerTop: header.top, footerBottom: footer.bottom };
  });
  expect(focused.scrollTop).toBe(0);
  expect(focused.headerTop).toBeGreaterThanOrEqual(focused.top);
  expect(Math.abs(focused.footerBottom - focused.bottom)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('short-assistant-revision-focused.png') });
  const posts: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') posts.push(request.url()); });
  const history = assistant.getByRole('region', { name: 'Saved story history', exact: true });
  await assistant.getByRole('button', { name: 'Saved drafts', exact: true }).click();
  await history.getByRole('button', { name: 'Review draft 1', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'Your scene outline', exact: true })).toBeInViewport();
  await usefulBody(page, assistant);
  expect(posts).toEqual([]);
  await page.screenshot({ path: info.outputPath('short-assistant-history-reopened.png') });
});

test('very short Assistant questions scroll and typing does not move the canvas', async ({ page }, info) => {
  const assistant = await openAssistant(page, 'A board game becomes real.');
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'A quick check before we continue', exact: true })).toBeInViewport();
  await usefulBody(page, assistant);
  await assistant.getByRole('radio', { name: '9:16', exact: true }).check();
  await assistant.getByRole('button', { name: 'Next', exact: true }).click();
  const field = assistant.getByRole('spinbutton', { name: 'Total runtime (seconds)', exact: true });
  await field.click();
  const transform = await page.locator('.react-flow__viewport').getAttribute('style');
  await field.fill('80');
  await expect(field).toHaveValue('80');
  await expect(field).toBeInViewport();
  expect(await page.locator('.react-flow__viewport').getAttribute('style')).toBe(transform);
  await expect(assistant.getByRole('button', { name: 'Continue', exact: true })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('short-assistant-questions.png') });
});

test('very short live approval retains the full estimate and ceiling without a provider request', async ({ page }, info) => {
  const posts: string[] = [];
  await page.route('**/api/cinema/provider-status', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ json: { ...await response.json(), mode: 'live' } });
  });
  await page.route('**/api/cinema/story-assistant?mode=live', (route) => route.fulfill({ json: {
    enabled: true, mode: 'live', model: 'review-only-test-model', quoteId: 'a'.repeat(64), cost: 12.75, ceiling: 25.5,
    ready: true, blockers: [],
  } }));
  await page.route('**/api/cinema/**', async (route) => {
    if (route.request().method() === 'POST') { posts.push(route.request().url()); return route.abort('blockedbyclient'); }
    await route.fallback();
  });
  const assistant = await openAssistant(page, 'A 60-second vertical horror story. No dialogue.');
  const footer = assistant.locator('.assistant-stage-footer:visible');
  const approval = footer.getByRole('button', { name: 'Approve & continue', exact: true });
  await expect(approval).toBeEnabled();
  await expect(footer).toContainText('Est. $12.75');
  await expect(footer).toContainText('allowance $25.5');
  await page.screenshot({ path: info.outputPath('short-live-approval.png') });
  await usefulBody(page, assistant, 80);
  await expect(assistant.getByText(/One AI analysis of your premise, current scenes/)).toBeInViewport({ ratio: 0.999 });
  const text = footer.locator('.assistant-help');
  expect(await text.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
  // Transformed canvas bounds produce 0.9999998 in Chromium for fully visible
  // text; retain an effectively full-visibility check without float equality.
  await expect(text).toBeInViewport({ ratio: 0.9999 });
  await expect(approval).toBeInViewport({ ratio: 0.9999 });
  expect(posts).toEqual([]);
});
