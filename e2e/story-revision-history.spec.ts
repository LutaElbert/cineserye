import { expect, test, type Page } from '@playwright/test';
import type { EditorDocument } from '../app/editor/types';
import { waitForSaved } from './helpers';

const idea = 'Four friends discover a cursed board game. A 60-second vertical horror mystery, no dialogue. All four survive.';
const instruction = 'Make the second scene more tense; keep all four friends alive.';

async function savedDocument(page: Page): Promise<EditorDocument> {
  await waitForSaved(page);
  return page.evaluate(() => new Promise<EditorDocument>((resolve, reject) => {
    const request = indexedDB.open('cineserye-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const read = database.transaction('documents').objectStore('documents').get('current');
      read.onsuccess = () => { database.close(); resolve(read.result); };
      read.onerror = () => { database.close(); reject(read.error); };
    };
  }));
}
async function composer(page: Page, starter = false) {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: starter ? /Start a scene/ : /Start with an idea/ }).click();
  if (starter) {
    await page.getByRole('button', { name: 'Story Premise', exact: true }).first().click();
    await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
    await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
  }
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  await editor.getByLabel('Premise for development', { exact: true }).fill(idea);
  return editor;
}
async function confirmDirection(page: Page) {
  const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'Here’s what I understood', exact: true })).toBeVisible();
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('region', { name: 'Story generation review', exact: true })).toBeVisible();
  return assistant;
}
test.beforeEach(async ({ page }) => {
  test.skip(new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').port !== '3040', 'Isolated fixture only.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/api/cinema/**', async (route) => {
    if (route.request().method() === 'POST' && /"mode"\s*:\s*"live"/.test(route.request().postData() ?? '')) return route.abort('blockedbyclient');
    await route.continue();
  });
});

test('revision lineage survives reload and old drafts reopen without changing accepted work or dispatching', async ({ page }, info) => {
  const posts: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts.push(new URL(request.url()).pathname); });
  await (await composer(page)).getByRole('button', { name: 'Generate', exact: true }).click();
  const assistant = await confirmDirection(page);
  await assistant.getByRole('button', { name: 'Draft scene outline', exact: true }).click();
  const rows = assistant.locator('.assistant-scene-row');
  await expect(rows).toHaveCount(3);
  const original = await rows.locator('.assistant-scene-row-copy').allTextContents();
  await assistant.getByRole('checkbox', { name: 'Select proposal 1', exact: true }).uncheck();
  await assistant.getByRole('checkbox', { name: 'Select proposal 3', exact: true }).uncheck();
  await assistant.getByRole('button', { name: 'Revise selected scenes', exact: true }).click();
  await assistant.getByRole('textbox', { name: 'Tell the Assistant what to change', exact: true }).fill(instruction);
  await assistant.getByRole('button', { name: 'Review scene revision', exact: true }).click();
  await assistant.getByRole('button', { name: 'Revise selected', exact: true }).click();
  await expect(rows).toHaveCount(3);
  await expect.poll(async () => (await savedDocument(page)).cinema?.storyWorkflow?.sessions.at(-1)?.revision?.status).toBe('completed');
  const generated = await savedDocument(page), sessions = generated.cinema!.storyWorkflow!.sessions;
  expect(sessions).toHaveLength(2);
  expect(sessions[1].revision).toMatchObject({ instruction, sourceSessionId: sessions[0].id, sourceOperationId: sessions[0].operationId,
    sourceVersion: 1, resultVersion: 2, selectedProposalIds: [sessions[0].proposals[1].id], status: 'completed', provenance: { mode: 'fixture' } });
  const postCount = posts.length;
  const history = assistant.getByRole('region', { name: 'Saved story history', exact: true });
  await assistant.getByRole('button', { name: 'Saved drafts', exact: true }).click();
  await expect(history.getByRole('article', { name: 'Saved draft 2', exact: true })).toContainText(instruction);
  await expect(history).toContainText('completed · v1 → v2');
  await history.getByRole('button', { name: 'Review draft 1', exact: true }).click();
  expect(await rows.locator('.assistant-scene-row-copy').allTextContents()).toEqual(original);
  await assistant.getByRole('button', { name: 'Revise selected scenes', exact: true }).click();
  await expect(assistant.getByRole('textbox', { name: 'Tell the Assistant what to change', exact: true })).toHaveValue('');
  await assistant.getByRole('button', { name: 'Back', exact: true }).click();
  const selected = await savedDocument(page);
  expect(selected.cinema!.storyWorkflow!.reviewSessionId).toBe(sessions[0].id);
  expect(selected.cinema!.storyWorkflow!.sessions.map((entry) => entry.id)).toEqual(sessions.map((entry) => entry.id));
  expect(selected.nodes).toEqual(generated.nodes); expect(selected.edges).toEqual(generated.edges);
  expect(posts).toHaveLength(postCount);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  await expect(rows).toHaveCount(3);
  expect(await rows.locator('.assistant-scene-row-copy').allTextContents()).toEqual(original);
  const reloaded = await savedDocument(page);
  expect(reloaded.cinema!.storyWorkflow!.sessions[1].revision).toEqual(sessions[1].revision);
  expect(reloaded.cinema!.storyWorkflow!.reviewSessionId).toBe(sessions[0].id);
  expect(posts).toHaveLength(postCount);
  // Accept the older outline deliberately, then prove the descendant is inspectable
  // but cannot silently add stale copies over the now accepted canonical scenes.
  await assistant.getByRole('checkbox', { name: 'Select proposal 1', exact: true }).check();
  await assistant.getByRole('checkbox', { name: 'Select proposal 3', exact: true }).check();
  await assistant.getByRole('button', { name: 'Add 3 scenes', exact: true }).click();
  await expect(assistant.getByRole('button', { name: 'Plan shots', exact: true })).toBeVisible();
  const accepted = await savedDocument(page);
  await assistant.getByRole('button', { name: 'Saved drafts', exact: true }).click();
  await history.getByRole('button', { name: 'Review draft 2', exact: true }).click();
  await expect(assistant.getByRole('alert').filter({ hasText: 'Your source changed' })).toBeVisible();
  await expect(assistant.getByRole('button', { name: 'Add 1 scene', exact: true })).toBeDisabled();
  const old = await savedDocument(page);
  expect(old.nodes).toEqual(accepted.nodes); expect(old.edges).toEqual(accepted.edges); expect(old.cinema!.scenes).toEqual(accepted.cinema!.scenes);
  expect(old.cinema!.storyWorkflow!.sessions.map((entry) => entry.id)).toEqual(sessions.map((entry) => entry.id));
  expect(posts).toHaveLength(postCount);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('saved-stale-draft-review.png') });
});

test('Continue labels runtime as additional material through understanding and outline approval', async ({ page }, info) => {
  const editor = await composer(page, true);
  await editor.getByRole('button', { name: 'Continue my story', exact: true }).click();
  await editor.getByRole('combobox', { name: 'Continue after', exact: true }).selectOption({ label: 'Scene 01' });
  await editor.getByRole('button', { name: 'Generate', exact: true }).click();
  const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'Here’s what I understood', exact: true })).toBeVisible();
  await expect(assistant.getByLabel('Story context', { exact: true })).toContainText('+60s new material');
  await expect(assistant.locator('.assistant-understood-summary')).toContainText('New material (seconds): 60');
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('region', { name: 'Story generation review', exact: true })).toContainText('60s new material');
  await expect(assistant.getByLabel('Story context', { exact: true })).toContainText('+60s new material');
  const saved = await savedDocument(page);
  expect(saved.cinema!.storyWorkflow!.briefs.at(-1)).toMatchObject({ durationSeconds: 60, durationScope: 'new-material', mode: 'continue' });
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('continue-new-material-context.png') });
});

test('unknown existing allocation can be corrected inline without generating', async ({ page }) => {
  const editor = await composer(page, true);
  await editor.getByRole('button', { name: 'Generate', exact: true }).click();
  const assistant = await confirmDirection(page);
  const posts: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts.push(request.url()); });
  await expect(assistant.getByRole('button', { name: 'Draft scene outline', exact: true })).toHaveCount(0);
  const viewportBeforeCorrection = await page.locator('.react-flow__viewport').getAttribute('style');
  await assistant.getByRole('button', { name: 'Set scene duration', exact: true }).click();
  const correction = assistant.getByRole('region', { name: 'Resolve scene durations', exact: true });
  await expect(correction.getByRole('spinbutton')).toBeFocused();
  expect(await page.locator('.react-flow__viewport').getAttribute('style')).toBe(viewportBeforeCorrection);
  await correction.getByRole('spinbutton').fill('20');
  await correction.getByRole('button', { name: 'Save duration for Scene 01', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'Review your updated idea', exact: true })).toBeVisible();
  expect(posts).toEqual([]);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});
