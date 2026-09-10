import { expect, test, type Page, type Locator } from '@playwright/test';

const idea = 'Four friends discover a cursed board game. A 60-second vertical horror mystery, no dialogue. All four survive.';

async function openIdea(page: Page, premise = idea) {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible({ timeout: 30_000 });
  const chooser = page.getByRole('dialog', { name: /Start with your scene/ });
  await chooser.getByRole('button', { name: /Start with an idea/ }).click();
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  await editor.getByRole('textbox', { name: 'Layer title', exact: true }).fill('The Cursed Game');
  await editor.getByRole('textbox', { name: 'Premise for development', exact: true }).fill(premise);
  await editor.getByRole('button', { name: 'Generate', exact: true }).click();
  return page.getByRole('region', { name: 'Story Assistant', exact: true });
}
async function onePrimary(page: Page, assistant: Locator) {
  await expect(assistant.locator('.assistant-stage-footer .primary-button:visible')).toHaveCount(1);
  await expect(assistant.locator('.assistant-stage-footer .primary-button:visible')).toBeInViewport();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(await assistant.evaluate((node) => Boolean(node.closest('.react-flow__node')))).toBe(true);
  await expect(assistant.locator('details:visible, select:visible')).toHaveCount(0);
  await expect(assistant.getByRole('button', { name: 'Collapse story assistant', exact: true })).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  test.skip(new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').port !== '3040', 'Use an isolated fixture origin.');
  await page.route('**/api/cinema/**', async (route) => {
    if (route.request().method() === 'POST' && /"mode"\s*:\s*"live"/.test(route.request().postData() ?? '')) return route.abort('blockedbyclient');
    await route.continue();
  });
});

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'short', width: 1366, height: 768 }, { name: 'narrow', width: 390, height: 844 }]) {
  test(`one persistent compact Assistant at ${viewport.name}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const posts: string[] = [];
    page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts.push(new URL(request.url()).pathname); });
    const assistant = await openIdea(page);
    await expect(assistant.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
    expect(posts).toEqual([]);
    await onePrimary(page, assistant);
    await expect(assistant.getByRole('combobox', { name: /provider mode/i })).toHaveCount(0);
    const box = (await assistant.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: info.outputPath(`${viewport.name}-ready.png`) });
    await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(assistant.getByRole('heading', { name: 'Here’s what I understood', exact: true })).toBeVisible();
    await onePrimary(page, assistant);
    await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(assistant.getByRole('button', { name: 'Draft scene outline', exact: true })).toBeEnabled();
    await onePrimary(page, assistant);
    await assistant.getByRole('button', { name: 'Draft scene outline', exact: true }).click();
    await expect(assistant.locator('.assistant-scene-row')).toHaveCount(3);
    await onePrimary(page, assistant);
    await expect(assistant.getByRole('button', { name: 'Draft scene outline', exact: true })).toHaveCount(0);
    await expect(assistant.locator('.assistant-scene-row').last()).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`${viewport.name}-scene-review.png`) });
    await assistant.getByRole('checkbox', { name: 'Select proposal 2', exact: true }).uncheck();
    await expect(assistant.getByRole('button', { name: 'Add 2 scenes', exact: true })).toBeDisabled();
    await expect(assistant.locator('.assistant-proposal-review .assistant-selection-summary')).toContainText('2 scenes selected');
    await assistant.getByRole('checkbox', { name: 'Select proposal 2', exact: true }).check();
    await assistant.getByRole('button', { name: 'Add 3 scenes', exact: true }).click();
    await expect(assistant.getByRole('button', { name: 'Plan shots', exact: true })).toBeVisible();
    await expect(assistant.getByRole('heading', { name: 'Let’s shape your story', exact: true })).toHaveCount(0);
    await expect(assistant.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0);
    await onePrimary(page, assistant);
    await page.screenshot({ path: info.outputPath(`${viewport.name}-scenes-added.png`) });
    expect(posts).toEqual(['/api/cinema/story-assistant', '/api/cinema/story-assistant', '/api/cinema/develop-story']);
  });
}

test('sparse idea asks compact missing questions with a pinned Continue', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const assistant = await openIdea(page, 'A board game becomes real.');
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'A quick check before we continue', exact: true })).toBeVisible();
  const questions = assistant.locator('.assistant-questions fieldset');
  expect(await questions.count()).toBeLessThanOrEqual(3);
  await expect(assistant.getByRole('radio', { name: '9:16', exact: true })).toBeInViewport();
  await expect(assistant.getByRole('spinbutton', { name: 'Total runtime (seconds)', exact: true })).toHaveCount(0);
  await expect(assistant.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await assistant.getByRole('radio', { name: '9:16', exact: true }).check();
  await assistant.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(assistant.getByRole('spinbutton', { name: 'Total runtime (seconds)', exact: true })).toBeInViewport();
  await assistant.getByRole('button', { name: '30s', exact: true }).click();
  await assistant.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(assistant.getByRole('radio', { name: '9:16', exact: true })).toBeChecked();
  await expect(assistant.locator('details, select')).toHaveCount(0);
  await onePrimary(page, assistant);
  await page.screenshot({ path: info.outputPath('narrow-questions.png') });
});

test('conversational revision changes only selected drafts after scoped approval', async ({ page }, info) => {
  const assistant = await openIdea(page);
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'Here’s what I understood', exact: true })).toBeVisible();
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await assistant.getByRole('button', { name: 'Draft scene outline', exact: true }).click();
  const rows = assistant.locator('.assistant-scene-row');
  await expect(rows).toHaveCount(3);
  const original = await rows.locator('.assistant-scene-row-copy').allTextContents();
  const nodeCount = await page.locator('.react-flow__node').count();
  const requests: Record<string, unknown>[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/cinema/develop-story') requests.push(request.postDataJSON());
  });
  await assistant.getByRole('checkbox', { name: 'Select proposal 1', exact: true }).uncheck();
  await assistant.getByRole('checkbox', { name: 'Select proposal 3', exact: true }).uncheck();
  await assistant.getByRole('button', { name: 'Revise selected scenes', exact: true }).click();
  await assistant.getByRole('textbox', { name: 'Tell the Assistant what to change', exact: true }).fill('Make the second scene more tense; keep all four friends alive.');
  await assistant.getByRole('button', { name: 'Review scene revision', exact: true }).click();
  await expect(assistant.getByRole('region', { name: 'Scene revision approval', exact: true })).toContainText('Revise 1 selected scene');
  expect(requests).toHaveLength(0);
  await onePrimary(page, assistant);
  let rejectOnce = true;
  await page.route('**/api/cinema/develop-story', async (route) => {
    if (route.request().method() === 'POST' && rejectOnce) {
      rejectOnce = false;
      return route.fulfill({ status: 400, json: { ok: false, error: 'Review this revised scope before dispatch.' } });
    }
    await route.continue();
  });
  await assistant.getByRole('button', { name: 'Revise selected', exact: true }).click();
  await expect(assistant.getByRole('alert')).toHaveText('Review this revised scope before dispatch.');
  await expect(rows).toHaveCount(3);
  expect(requests).toHaveLength(1);
  expect(await rows.locator('.assistant-scene-row-copy').allTextContents()).toEqual(original);
  // A known pre-dispatch rejection keeps the original durable outline identity;
  // the retry is another explicit approval, never an automatic provider request.
  await assistant.getByRole('button', { name: 'Revise selected scenes', exact: true }).click();
  await assistant.getByRole('button', { name: 'Review scene revision', exact: true }).click();
  await assistant.getByRole('button', { name: 'Revise selected', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'Your scene outline', exact: true })).toBeVisible();
  await expect(rows).toHaveCount(3);
  expect(requests).toHaveLength(2);
  const input = requests[1].input as { revise: { id: string; durationSeconds: number }[]; revision: { sourceSessionId: string; selectedProposalIds: string[]; untouchedProposals: unknown[]; instruction: string }; allocation: { newSeconds: number } };
  expect(input.revision.sourceSessionId).toBe((requests[0].input as typeof input).revision.sourceSessionId);
  expect(input.revise).toHaveLength(1);
  expect(input.revision.selectedProposalIds).toEqual([input.revise[0].id]);
  expect(input.revision.untouchedProposals).toHaveLength(2);
  expect(input.allocation.newSeconds).toBe(input.revise[0].durationSeconds);
  const revised = await rows.locator('.assistant-scene-row-copy').allTextContents();
  expect(revised[0]).toBe(original[0]);
  expect(revised[2]).toBe(original[2]);
  await expect(assistant.getByRole('checkbox', { name: 'Select proposal 2', exact: true })).toBeChecked();
  await expect(assistant.getByRole('checkbox', { name: 'Select proposal 1', exact: true })).not.toBeChecked();
  expect(await page.locator('.react-flow__node').count()).toBe(nodeCount);
  await expect(assistant.locator('.assistant-result-provenance')).toHaveText('Fixture · no AI calls');
  await page.screenshot({ path: info.outputPath('selected-scene-revision.png') });
});

test('local direction correction returns to outline without reanalysis and preserves saved drafts', async ({ page }, info) => {
  const posts: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts.push(new URL(request.url()).pathname); });
  const assistant = await openIdea(page);
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'Here’s what I understood', exact: true })).toBeVisible();
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await assistant.getByRole('button', { name: 'Draft scene outline', exact: true }).click();
  await expect(assistant.locator('.assistant-scene-row')).toHaveCount(3);
  const beforeCorrection = [...posts];
  await assistant.getByRole('button', { name: 'Revise direction', exact: true }).click();
  await assistant.getByRole('button', { name: /Production constraints/ }).click();
  await assistant.getByRole('checkbox', { name: 'One room', exact: true }).check();
  await assistant.getByRole('button', { name: 'Done', exact: true }).click();
  await assistant.getByRole('button', { name: 'Confirm direction', exact: true }).click();
  await expect(assistant.getByRole('button', { name: 'Draft scene outline', exact: true })).toBeEnabled();
  await expect(assistant.getByRole('button', { name: 'Approve & continue', exact: true })).toHaveCount(0);
  expect(posts).toEqual(beforeCorrection);
  await onePrimary(page, assistant);
  await assistant.getByRole('spinbutton', { name: 'Proposal count', exact: true }).fill('1');
  await page.screenshot({ path: info.outputPath('corrected-outline-ready.png') });
  await assistant.getByRole('button', { name: 'Draft scene outline', exact: true }).click();
  await expect(assistant.locator('.assistant-scene-row')).toHaveCount(1);
  await expect(assistant.locator('.assistant-kept')).toContainText('One room');
  const afterOutline = [...posts];
  await page.reload();
  await expect(assistant.getByRole('heading', { name: 'Your scene outline', exact: true })).toBeVisible();
  await expect(assistant.locator('.assistant-scene-row')).toHaveCount(1);
  expect(posts).toEqual(afterOutline);
  await assistant.getByRole('button', { name: 'Saved drafts', exact: true }).click();
  await expect(assistant.getByRole('region', { name: 'Saved story history', exact: true })).toContainText('Saved drafts · 2');
  await expect(assistant.locator('details')).toHaveCount(0);
});

test('locking the premise blocks confirmed-direction edits and outline dispatch', async ({ page }) => {
  const assistant = await openIdea(page);
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'Here’s what I understood', exact: true })).toBeVisible();
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('button', { name: 'Draft scene outline', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.getByRole('button', { name: 'Lock The Cursed Game', exact: true }).click();
  await expect(assistant.getByRole('button', { name: 'Revise direction', exact: true })).toBeDisabled();
  await expect(assistant.getByRole('button', { name: 'Draft scene outline', exact: true })).toBeDisabled();
  await expect(assistant.getByRole('spinbutton', { name: 'Proposal count', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Unlock The Cursed Game', exact: true }).click();
  await expect(assistant.getByRole('button', { name: 'Draft scene outline', exact: true })).toBeEnabled();
});
