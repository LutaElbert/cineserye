import { expect, test } from '@playwright/test';
import { addCinemaDraft, createDiagramPng, openEditor, waitForSaved, openSelectedScenePlanner } from './helpers';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { fulfillWorkspaceMode, refreshWorkspaceDiscovery } from './workspace-capability-helpers';

async function openEmptyStory(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Start with an idea/ }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
}

const liveQuote = { enabled: true, mode: 'live', model: 'MOCK-LIVE-NO-PROVIDER', quoteId: 'c'.repeat(64), cost: 0.01, ceiling: 1, ready: true, blockers: [] };
async function mockLiveCapabilities(page: import('@playwright/test').Page) {
  await page.route('**/api/cinema/workflow-capabilities', (route) => fulfillWorkspaceMode(route, 'live'));
  for (const endpoint of ['develop-story', 'story-assistant']) await page.route(`**/api/cinema/${endpoint}?mode=live`, (route) => route.fulfill({ json: liveQuote }));
}

test.beforeEach(async ({ page }) => {
  expect(process.env.CINESERYE_E2E_RUNTIME).toBe('node-fixture');
  await page.route('**/api/cinema/**', (route) => {
    if (route.request().method() === 'POST' && /"mode"\s*:\s*"live"/.test(route.request().postData() ?? '')) return route.abort('blockedbyclient');
    return route.continue();
  });
});

async function story(page: import('@playwright/test').Page) {
  const premise = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  if (!(await premise.isVisible())) {
    await page.getByRole('button', { name: 'Fit View', exact: true }).click();
    await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
  }
  await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
  const idea = premise.getByRole('textbox', { name: 'Premise for development', exact: true });
  if (!(await idea.inputValue()).trim()) await idea.fill('A caretaker finds a film showing tomorrow in an abandoned cinema.');
  await premise.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
  const manual = assistant.getByRole('button', { name: 'Edit full brief manually', exact: true });
  const panel = assistant.getByRole('region', { name: 'Manual story direction', exact: true });
  if (!(await panel.isVisible())) {
    await assistant.locator('summary').filter({ hasText: /^Advanced story tools$/ }).click();
    await manual.click();
  }
  await expect(panel).toBeVisible(); return panel;
}
async function direction(panel: import('@playwright/test').Locator, waitForQuote = true) {
  await panel.getByRole('textbox', { name: 'Premise for development', exact: true }).fill('A caretaker finds a film showing tomorrow in an abandoned cinema.');
  await panel.getByRole('combobox', { name: 'Format', exact: true }).selectOption('16:9');
  await panel.getByLabel(/^(Target duration|New material duration) \(seconds\)$/).fill('60');
  await panel.getByLabel('Tone', { exact: true }).fill('Quiet suspense');
  await panel.getByRole('textbox', { name: 'Ending direction', exact: true }).fill('She switches off the projector and chooses her own future.');
  await panel.getByRole('button', { name: 'Review creative brief', exact: true }).click();
  await panel.getByRole('button', { name: 'Approve direction — no AI call', exact: true }).click();
  if (waitForQuote) await expect(panel.getByRole('region', { name: 'Story generation review', exact: true })).toContainText('One attempt, no automatic retry.');
}
test('unknown workspace keeps manual direction editable but blocks generation until discovery recovers', async ({ page }) => {
  let available = false; let quotes = 0; let posts = 0;
  await page.route('**/api/cinema/workflow-capabilities', (route) => available
    ? route.continue() : route.fulfill({ json: { version: 1, mode: 'fixture' } }));
  page.on('request', (request) => {
    if (request.url().includes('/api/cinema/develop-story?')) quotes++;
    if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts++;
  });
  await openEmptyStory(page); const panel = await story(page);
  await direction(panel, false);
  await expect(page.getByRole('button', { name: 'Provider availability unknown. Open provider status and local traces.', exact: true })).toHaveText('Availability unknown');
  await expect(panel.getByRole('button', { name: 'Generate scene proposals', exact: true })).toBeDisabled();
  expect(quotes).toBe(0); expect(posts).toBe(0);
  available = true;
  await refreshWorkspaceDiscovery(page);
  await expect(panel.getByRole('button', { name: 'Generate scene proposals', exact: true })).toBeEnabled();
  expect(quotes).toBeGreaterThan(0); expect(posts).toBe(0);
});
test('submission journey: premise to reviewed scenes, shots, frames, downloaded clip and reload', async ({ page }) => {
  test.setTimeout(120_000);
  const posts: import('@playwright/test').Request[] = [];
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts.push(request); });
  const calls = (path: string) => posts.filter((request) => new URL(request.url()).pathname === `/api/cinema/${path}`);
  await openEmptyStory(page); const panel = await story(page);
  await panel.locator('summary').click();
  await panel.getByLabel('Reference title', { exact: true }).fill('Lamp continuity');
  await panel.getByRole('textbox', { name: 'Reference note', exact: true }).fill('One warm practical lamp, no neon.');
  await panel.getByRole('combobox', { name: 'Rights', exact: true }).selectOption('creator-owned');
  await panel.getByLabel('I approve this reference content', { exact: true }).check();
  await panel.getByLabel('shot-planning', { exact: true }).check();
  await panel.getByRole('button', { name: 'Add note reference', exact: true }).click();
  await panel.getByLabel('Reference title', { exact: true }).fill('Owned lighting reference');
  await panel.getByRole('combobox', { name: 'Rights', exact: true }).selectOption('creator-owned');
  await panel.getByLabel('I approve this reference content', { exact: true }).check();
  await panel.getByLabel('image-generation', { exact: true }).check();
  await panel.getByLabel('Attach reference image', { exact: true }).setInputFiles({ name: 'lighting.png', mimeType: 'image/png', buffer: await createDiagramPng(page) });
  await expect(panel.getByRole('img', { name: 'Owned lighting reference', exact: true })).toBeVisible();
  await direction(panel); expect(posts).toHaveLength(0);
  await expect(panel.getByLabel('I understand these are sample outputs and approve fixture generation.', { exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Generate scene proposals', exact: true }).click();
  await expect(panel.getByLabel('Select proposal 1', { exact: true })).toBeVisible();
  for (const proposal of await panel.locator('.story-proposal').all()) await proposal.locator('summary').click();
  // A shot-planning-only reference must not leak into story development.
  expect(calls('develop-story')[0].postDataJSON().input.references).toEqual([]);
  for (const [index, duration] of [15, 20, 25].entries()) await expect(panel.getByLabel(`Proposal ${index + 1} duration`, { exact: true })).toHaveValue(String(duration));
  await panel.getByRole('textbox', { name: 'Proposal 3 synopsis', exact: true }).fill('She switches off the projector and walks into an unwritten future.');
  await panel.getByRole('button', { name: 'Accept selected scenes', exact: true }).click();
  await expect(panel.getByText('Scenes accepted as one undoable change. No AI call.')).toBeVisible();
  expect(posts).toHaveLength(1);
  await page.getByRole('button', { name: 'Hide story assistant', exact: true }).click();
  for (const duration of [15, 20, 25]) await expect(page.getByText(`${duration}s allocated`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fit View', exact: true }).click();
  await page.locator('.react-flow__node[data-id$="proposal-2"]').click();
  await openSelectedScenePlanner(page);
  const brief = page.getByRole('region', { name: 'Generate shot plan', exact: true });
  await expect(brief.getByLabel('Target duration (seconds)', { exact: true })).toHaveValue('20');
  await expect(brief.getByLabel('Genre and tone', { exact: true })).toHaveValue('Quiet suspense');
  await brief.locator('summary').filter({ hasText: 'Adjust scene direction and production options' }).click();
  const notes = brief.getByLabel('Include these approved story/scene reference notes in shot planning', { exact: true });
  await expect(notes).not.toBeChecked(); await notes.check();
  await brief.getByLabel('Location and period', { exact: true }).fill('Contemporary Manila cinema');
  await brief.getByRole('button', { name: 'Generate shot plan', exact: true }).click();
  const review = page.getByRole('region', { name: 'Shot proposal review' });
  await expect(review).toBeVisible();
  expect(calls('plan-scene')).toHaveLength(1);
  expect(calls('plan-scene')[0].postData()).toContain('One warm practical lamp, no neon.');
  await page.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await page.getByRole('tab', { name: 'Sources', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Sources' }).locator('.source-card').first()).toBeVisible();
  await review.getByRole('button', { name: 'Accept plan', exact: true }).click();
  await page.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await page.getByRole('tab', { name: 'Visuals', exact: true }).click();
  const visuals = page.getByRole('tabpanel', { name: 'Visuals' });
  await expect(visuals.getByRole('button', { name: 'Generate storyboard', exact: true })).toBeDisabled();
  expect(calls('generate-storyboard')).toHaveLength(0); expect(calls('generate-video')).toHaveLength(0);
  await visuals.getByRole('checkbox', { name: /I confirm the .* direction/ }).check();
  await visuals.getByRole('button', { name: 'Generate storyboard', exact: true }).click();
  await expect(visuals.locator('.storyboard-frame')).toHaveCount(3);
  expect(calls('generate-storyboard')[0].postDataJSON().references).toEqual([
    expect.objectContaining({ title: 'Owned lighting reference (story v1)', id: expect.stringMatching(/^story-ref:.*:v1$/), mimeType: 'image/png' }),
  ]);
  const frameDownload = page.waitForEvent('download');
  await visuals.getByRole('link', { name: 'Download storyboard variant 1', exact: true }).click();
  const frame = await frameDownload;
  expect(frame.suggestedFilename()).toMatch(/\.svg$/);
  expect((await readFile((await frame.path())!, 'utf8'))).toContain('<svg');
  await visuals.locator('.storyboard-frame').first().getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(visuals.getByRole('button', { name: 'Generate one clip', exact: true })).toBeDisabled();
  expect(calls('generate-video')).toHaveLength(0);
  await visuals.getByRole('checkbox', { name: /I confirm one 4s 720p silent clip/ }).check();
  await visuals.getByRole('button', { name: 'Generate one clip', exact: true }).click();
  await expect(visuals.locator('.video-version')).toHaveCount(1, { timeout: 15_000 });
  await visuals.getByRole('button', { name: 'Approve clip', exact: true }).click();
  const clipDownload = page.waitForEvent('download');
  await visuals.getByRole('button', { name: /Download video clip/ }).click();
  const clip = await clipDownload;
  expect(clip.suggestedFilename()).toMatch(/\.mp4$/);
  expect((await readFile((await clip.path())!)).subarray(4, 8).toString()).toBe('ftyp');
  expect(calls('develop-story')).toHaveLength(1); expect(calls('generate-storyboard')).toHaveLength(1); expect(calls('generate-video')).toHaveLength(1);
  const count = posts.length; await waitForSaved(page); await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await page.getByRole('tab', { name: 'Visuals', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Visuals' }).locator('.video-version')).toContainText('Approved clip');
  expect(posts).toHaveLength(count);
});

test('later manual scene appears in continuation and reference scopes after reopen and reload', async ({ page }) => {
  await openEditor(page); let panel = await story(page);
  await page.getByRole('button', { name: 'Hide story assistant', exact: true }).click();
  await addCinemaDraft(page, 'Scene', true);
  panel = await story(page);
  await panel.getByRole('combobox', { name: 'Goal', exact: true }).selectOption('continue');
  const anchor = panel.getByRole('combobox', { name: 'Continue after', exact: true });
  await anchor.selectOption({ label: 'Scene 02' }); const id = await anchor.inputValue();
  await panel.locator('summary').click();
  await panel.getByRole('combobox', { name: 'Reference scope', exact: true }).selectOption(`scene:${id}`);
  await page.getByRole('button', { name: 'Hide story assistant', exact: true }).click();
  await waitForSaved(page); await page.reload(); await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  panel = await story(page);
  await expect(panel.getByRole('combobox', { name: 'Continue after', exact: true })).toHaveValue(id);
  await expect(panel.getByRole('combobox', { name: 'Continue after', exact: true }).locator(`option[value="${id}"]`)).toHaveCount(1);
});

test('delayed fixture estimate cannot enable live consent after a mode switch', async ({ page }) => {
  let release!: () => void; const held = new Promise<void>((resolve) => { release = resolve; });
  let nextMode: 'fixture' | 'live' = 'fixture';
  let started = false; let finished = false; let posts = 0;
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts++; });
  await page.route('**/api/cinema/workflow-capabilities', (route) => fulfillWorkspaceMode(route, nextMode));
  await page.route('**/api/cinema/develop-story?mode=fixture', async (route) => {
    if (route.request().method() !== 'GET') return route.abort('blockedbyclient');
    started = true; await held;
    await route.fulfill({ json: { enabled: true, mode: 'fixture', model: 'DELAYED-FIXTURE', quoteId: 'd'.repeat(64), cost: 0, ceiling: 1, ready: true, blockers: [] } }); finished = true;
  });
  await page.route('**/api/cinema/develop-story?mode=live', (route) => route.fulfill({ json: { ...liveQuote, ready: false, blockers: ['Live disabled for this test.'] } }));
  await openEmptyStory(page); const panel = await story(page); await direction(panel, false);
  await expect.poll(() => started).toBe(true);
  nextMode = 'live'; await refreshWorkspaceDiscovery(page);
  await expect(panel.getByText('Workspace provider: Live — explicit approval required', { exact: true })).toBeVisible();
  release(); await expect.poll(() => finished).toBe(true);
  await expect(panel.getByText(/DELAYED-FIXTURE/)).toHaveCount(0);
  await expect(panel.getByText(new RegExp(liveQuote.model))).toBeVisible();
  await expect(panel.getByLabel('I approve sending this brief, scene context and listed references for this one paid request.', { exact: true })).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'Generate scene proposals', exact: true })).toBeDisabled();
  expect(posts).toBe(0);
});

test('a failed same-mode estimate refresh removes the old approval until explicit recovery', async ({ page }) => {
  let failEstimate = false; let posts = 0;
  await mockLiveCapabilities(page);
  await page.route('**/api/cinema/develop-story?mode=live', (route) => route.fulfill({ json: failEstimate ? { ready: true } : liveQuote }));
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts++; });
  await openEmptyStory(page); const panel = await story(page); await direction(panel);
  const consent = panel.getByLabel('I approve sending this brief, scene context and listed references for this one paid request.', { exact: true });
  await consent.check();
  await expect(panel.getByRole('button', { name: 'Generate scene proposals', exact: true })).toBeEnabled();
  failEstimate = true;
  await panel.getByLabel('Tone', { exact: true }).fill('Warm suspense');
  await panel.getByRole('button', { name: 'Review creative brief', exact: true }).click();
  await panel.getByRole('button', { name: 'Approve direction — no AI call', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Retry story estimate', exact: true })).toBeVisible();
  await expect(panel.getByText(new RegExp(liveQuote.model))).toHaveCount(0);
  await expect(consent).not.toBeChecked(); await expect(consent).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'Generate scene proposals', exact: true })).toBeDisabled();
  failEstimate = false;
  await panel.getByRole('button', { name: 'Retry story estimate', exact: true }).click();
  await expect(panel.getByText(new RegExp(liveQuote.model))).toBeVisible();
  await expect(consent).toBeEnabled(); await expect(consent).not.toBeChecked();
  await expect(panel.getByRole('button', { name: 'Generate scene proposals', exact: true })).toBeDisabled();
  expect(posts).toBe(0);
});

for (const boundary of ['preparation', 'saved request'] as const) test(`mode changes during async Story ${boundary} stop before any dispatch`, async ({ page }) => {
  let nextMode: 'fixture' | 'live' = 'fixture';
  let posts = 0;
  await page.route('**/api/cinema/workflow-capabilities', (route) => fulfillWorkspaceMode(route, nextMode));
  await page.route(/\/api\/cinema\/develop-story(?:\?mode=fixture)?$/, (route) => {
    if (route.request().method() !== 'GET') { posts++; return route.abort('blockedbyclient'); }
    return route.fulfill({ json: { ...liveQuote, mode: 'fixture', model: 'HELD-PREPARATION-FIXTURE', cost: 0 } });
  });
  await page.route('**/api/cinema/develop-story?mode=live', (route) => route.fulfill({ json: { ...liveQuote, ready: false, blockers: ['Live disabled for this test.'] } }));
  await openEmptyStory(page); const panel = await story(page); await direction(panel);
  await expect(panel.getByRole('button', { name: 'Generate scene proposals', exact: true })).toBeEnabled();
  await page.evaluate((boundary) => {
    const original = crypto.subtle.digest.bind(crypto.subtle);
    const probe = window as unknown as { digestHeld: boolean; runningRecordWritten: boolean; releaseStoryDigest: () => void };
    probe.digestHeld = false;
    probe.runningRecordWritten = false;
    let armed = boundary === 'preparation';
    if (!armed) {
      const originalPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(value, ...args) {
        const request = originalPut.call(this, value, ...args);
        if (this.name === 'documents' && value.id === 'current'
          && value.cinema?.storyWorkflow?.sessions?.some((session: { stage: string }) => session.stage === 'running')) {
          armed = true; probe.runningRecordWritten = true;
          IDBObjectStore.prototype.put = originalPut;
        }
        return request;
      };
    }
    const gate = new Promise<void>((resolve) => { probe.releaseStoryDigest = () => { crypto.subtle.digest = original; resolve(); }; });
    crypto.subtle.digest = async (...args: Parameters<SubtleCrypto['digest']>) => {
      if (armed) { probe.digestHeld = true; await gate; }
      return original(...args);
    };
  }, boundary);
  await panel.getByRole('button', { name: 'Generate scene proposals', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { digestHeld: boolean }).digestHeld)).toBe(true);
  if (boundary === 'saved request') await expect.poll(() => page.evaluate(() => (window as unknown as { runningRecordWritten: boolean }).runningRecordWritten)).toBe(true);
  nextMode = 'live'; await refreshWorkspaceDiscovery(page);
  await expect(panel.getByText('Workspace provider: Live — explicit approval required', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as unknown as { releaseStoryDigest: () => void }).releaseStoryDigest());
  await expect(panel.getByText('The workspace mode, estimate or approval changed. Review again before generating.', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Generate scene proposals', exact: true })).toBeDisabled();
  expect(posts).toBe(0);
});
test('reference permission withdrawal during the final preparation digest prevents Story dispatch', async ({ page }) => {
  let posts = 0;
  await page.route('**/api/cinema/develop-story', (route) => {
    if (route.request().method() === 'POST') { posts++; return route.abort('blockedbyclient'); }
    return route.continue();
  });
  await openEmptyStory(page); const panel = await story(page);
  await panel.locator('summary').click();
  await panel.getByLabel('Reference title', { exact: true }).fill('Revocable image');
  await panel.getByRole('combobox', { name: 'Rights', exact: true }).selectOption('creator-owned');
  await panel.getByLabel('I approve this reference content', { exact: true }).check();
  await panel.getByLabel('story-development', { exact: true }).check();
  await panel.getByLabel('shot-planning', { exact: true }).check();
  await panel.getByLabel('Attach reference image', { exact: true }).setInputFiles({ name: 'owned.png', mimeType: 'image/png', buffer: await createDiagramPng(page) });
  await expect(panel.getByRole('img', { name: 'Revocable image', exact: true })).toBeVisible();
  await direction(panel);
  await page.getByRole('button', { name: 'Fit View', exact: true }).click();
  await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
  await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  await editor.getByRole('button', { name: 'Review reference permissions · 1', exact: true }).click();
  const permissions = editor.getByRole('region', { name: 'Reference permissions', exact: true });
  await expect(permissions.getByLabel('Story development', { exact: true })).toBeChecked();
  await waitForSaved(page);
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  await page.evaluate(() => {
    const original = crypto.subtle.digest.bind(crypto.subtle);
    const probe = window as unknown as { finalDigestHeld: boolean; releaseFinalDigest: () => void };
    probe.finalDigestHeld = false; let calls = 0;
    crypto.subtle.digest = async (...args: Parameters<SubtleCrypto['digest']>) => {
      // Generation hashes source, approval content, then the pre-record source.
      if (++calls === 3) {
        crypto.subtle.digest = original; probe.finalDigestHeld = true;
        await new Promise<void>((resolve) => { probe.releaseFinalDigest = resolve; });
      }
      return original(...args);
    };
  });
  await panel.getByRole('button', { name: 'Generate scene proposals', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { finalDigestHeld: boolean }).finalDigestHeld)).toBe(true);
  await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
  await permissions.getByLabel('Story development', { exact: true }).uncheck();
  await permissions.getByRole('button', { name: /Save permissions for/ }).click();
  await expect(permissions).toContainText('Current policy: approved · v2');
  await page.evaluate(() => (window as unknown as { releaseFinalDigest: () => void }).releaseFinalDigest());
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  await expect(panel.getByText('Source changed while preparing references. Review again.', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Check existing Story request', exact: true })).toHaveCount(0);
  expect(posts).toBe(0);
});

test('local direction and reference editing persist without AI; accepted fixture scenes are atomic and inherit timing', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts.push(request.url()); });
  await openEmptyStory(page); let panel = await story(page);
  await panel.locator('summary').click();
  await panel.getByLabel('Reference title', { exact: true }).fill('Lighting guide');
  await panel.getByRole('textbox', { name: 'Reference note', exact: true }).fill('Use one practical lamp, no neon.');
  await panel.getByRole('combobox', { name: 'Rights', exact: true }).selectOption('creator-owned');
  await panel.getByLabel('I approve this reference content', { exact: true }).check();
  await panel.getByLabel('story-development', { exact: true }).check();
  await panel.getByLabel('shot-planning', { exact: true }).check();
  await panel.getByRole('button', { name: 'Add note reference', exact: true }).click();
  await direction(panel);
  expect(posts).toHaveLength(0);
  await page.getByRole('button', { name: 'Hide story assistant', exact: true }).click();
  await page.reload(); await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  panel = await story(page); await expect(panel.getByLabel('Tone', { exact: true })).toHaveValue('Quiet suspense');
  await expect(panel.getByRole('button', { name: 'Generate scene proposals', exact: true })).toBeEnabled();
  await expect(panel.getByLabel('I understand these are sample outputs and approve fixture generation.', { exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Generate scene proposals', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Accept selected scenes', exact: true })).toBeEnabled();
  expect(posts).toHaveLength(1);
  await panel.getByRole('button', { name: 'Accept selected scenes', exact: true }).click();
  await expect(panel.getByText('Scenes accepted as one undoable change. No AI call.')).toBeVisible();
  await page.getByRole('button', { name: 'Hide story assistant', exact: true }).click();
  await expect(page.locator('.react-flow__node:not([data-id^="story-assistant:"])')).toHaveCount(4);
  for (const duration of [15, 20, 25]) await expect(page.getByText(`${duration}s allocated`, { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.locator('.react-flow__node:not([data-id^="story-assistant:"])')).toHaveCount(1);
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect(page.locator('.react-flow__node:not([data-id^="story-assistant:"])')).toHaveCount(4);
  await page.getByRole('button', { name: 'Fit View', exact: true }).click();
  await page.locator('.react-flow__node[data-id$="proposal-2"]').click();
  await openSelectedScenePlanner(page);
  const shotBrief = page.getByRole('region', { name: 'Generate shot plan', exact: true });
  await expect(shotBrief.getByLabel('Target duration (seconds)', { exact: true })).toHaveValue('20');
  await expect(shotBrief.getByLabel('Genre and tone', { exact: true })).toHaveValue('Quiet suspense');
  await shotBrief.locator('summary').filter({ hasText: 'Adjust scene direction and production options' }).click();
  await expect(shotBrief.getByText('Lighting guide: Use one practical lamp, no neon.', { exact: true })).toBeVisible();
  await expect(shotBrief.getByLabel('Include these approved story/scene reference notes in shot planning', { exact: true })).not.toBeChecked();
  expect(posts).toHaveLength(1);
});
test('story panel is accessible and invalidates consent when direction changes', async ({ page }) => {
  await mockLiveCapabilities(page);
  await openEmptyStory(page); const panel = await story(page); await direction(panel);
  const consent = panel.getByLabel('I approve sending this brief, scene context and listed references for this one paid request.', { exact: true });
  await consent.check();
  await expect(panel.getByRole('button', { name: 'Generate scene proposals', exact: true })).toBeEnabled();
  await panel.getByLabel('Tone', { exact: true }).fill('Comedy');
  await expect(consent).not.toBeChecked();
  await expect(panel.getByRole('button', { name: 'Generate scene proposals', exact: true })).toBeDisabled();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  await page.keyboard.press('Escape'); await expect(panel).not.toBeVisible();
});
test('second editor is read-only and cannot overwrite the active tab', async ({ page, context }) => {
  await openEditor(page); const other = await context.newPage(); await other.goto('/');
  await expect(other.getByRole('alert')).toContainText('read-only');
  await expect(other.locator('main')).toHaveAttribute('inert', '');
  await page.close(); await other.getByRole('button', { name: 'Reload to edit' }).click();
  await expect(other.locator('main')).not.toHaveAttribute('inert', '');
});

test('Surprise me replaces only the premise after confirmation and never inserts scenes automatically', async ({ page }) => {
  await openEmptyStory(page); const panel = await story(page);
  await panel.getByRole('combobox', { name: 'Goal', exact: true }).selectOption('surprise');
  await direction(panel);
  await expect(panel.getByLabel('I understand these are sample outputs and approve fixture generation.', { exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Generate concepts', exact: true }).click();
  await expect(panel.getByLabel('Select proposal 1', { exact: true })).toBeVisible();
  await panel.locator('.story-proposal').first().locator('summary').click();
  await panel.getByRole('button', { name: 'Use concept 1', exact: true }).click();
  await panel.getByRole('button', { name: 'Confirm concept replacement', exact: true }).click();
  await expect(panel.getByRole('region', { name: 'Story proposals', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Hide story assistant', exact: true }).click();
  await expect(page.locator('.react-flow__node:not([data-id^="story-assistant:"])')).toHaveCount(1);
  await expect(page.locator('.react-flow__node:not([data-id^="story-assistant:"])').filter({ hasText: 'The Last Roll' })).toHaveCount(1);
});

test('editing a regeneration scope clears consent and partial acceptance needs confirmation', async ({ page }) => {
  await mockLiveCapabilities(page);
  let mockedPosts = 0;
  await page.route('**/api/cinema/develop-story', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    mockedPosts++;
    await route.fulfill({ json: { ok: true, result: { version: 1, proposals: [1, 2, 3].map((index) => ({
      id: `mock-proposal-${index}`, title: `Mock scene ${index}`, synopsis: 'Locally mocked output. No provider dispatched.', purpose: 'Verify approval invalidation', durationSeconds: 20, selected: true,
    })) } } });
  });
  await openEmptyStory(page); const panel = await story(page); await direction(panel);
  const consent = panel.getByLabel('I approve sending this brief, scene context and listed references for this one paid request.', { exact: true });
  await consent.check(); await panel.getByRole('button', { name: 'Generate scene proposals', exact: true }).click();
  await expect(panel.getByLabel('Select proposal 1', { exact: true })).toBeVisible();
  await consent.check(); await panel.getByLabel('Select proposal 1', { exact: true }).uncheck();
  await expect(consent).not.toBeChecked();
  await expect(panel.getByRole('button', { name: 'Regenerate selected — new reviewed request', exact: true })).toBeDisabled();
  await panel.getByRole('button', { name: 'Accept selected scenes', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Confirm the different allocated duration');
  await panel.getByLabel('Accept a partial or different total without stretching other scenes', { exact: true }).check();
  await panel.getByRole('button', { name: 'Accept selected scenes', exact: true }).click();
  await expect(panel.getByText('Scenes accepted as one undoable change. No AI call.')).toBeVisible();
  await page.getByRole('button', { name: 'Hide story assistant', exact: true }).click();
  await expect(page.locator('.react-flow__node:not([data-id^="story-assistant:"])')).toHaveCount(3);
  expect(mockedPosts).toBe(1);
});

test('narrow screen keeps the in-node story review and close action reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page);
  // Open through the premise action if the compact global toolbar hides its text label.
  const panel = await story(page);
  const box = await panel.boundingBox(); expect(box).not.toBeNull(); expect(box!.width).toBeLessThanOrEqual(390);
  await panel.getByRole('textbox', { name: 'Premise for development', exact: true }).fill('A tiny cinema with a huge secret.');
  await page.getByRole('button', { name: 'Hide story assistant', exact: true }).click();
  await expect(panel).not.toBeVisible();
});

test('premise image remains local and scene exclusion can reset to inheritance', async ({ page }) => {
  let posts = 0; page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts++; });
  await openEditor(page); const panel = await story(page); await panel.locator('summary').click();
  await panel.getByLabel('Reference title', { exact: true }).fill('Owned mood image');
  await panel.getByRole('combobox', { name: 'Rights', exact: true }).selectOption('creator-owned');
  await panel.getByLabel('I approve this reference content', { exact: true }).check();
  await panel.getByLabel('image-generation', { exact: true }).check();
  await panel.getByLabel('Attach reference image', { exact: true }).setInputFiles({ name: 'mood.png', mimeType: 'image/png', buffer: await createDiagramPng(page) });
  await expect(panel.getByRole('img', { name: 'Owned mood image' })).toBeVisible();
  await panel.getByRole('combobox', { name: 'Reference scope', exact: true }).selectOption('scene:scene-01');
  await expect(panel.getByText(/Inherited from story/)).toBeVisible();
  await panel.getByRole('button', { name: 'Detach / exclude', exact: true }).click();
  await expect(panel.getByRole('img', { name: 'Owned mood image' })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Reset this scope to inherited references', exact: true }).click();
  await expect(panel.getByRole('img', { name: 'Owned mood image' })).toBeVisible();
  expect(posts).toBe(0);
});

test('cancelled story request never inserts late output; recovery performs only a GET', async ({ page }) => {
  let posts = 0; let release!: () => void;
  let operationId = ''; const checkedIds: string[] = [];
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/cinema/develop-story', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    posts++; operationId = route.request().postDataJSON().operationId; await held;
    await route.fulfill({ status: 200, json: { ok: true, result: { version: 1, proposals: [{ id: 'late', title: 'Late result', synopsis: 'Do not insert', purpose: 'Test', durationSeconds: 60, selected: true }] } } }).catch(() => undefined);
  });
  await page.route('**/api/cinema/develop-story?operationId=*', (route) => {
    checkedIds.push(new URL(route.request().url()).searchParams.get('operationId')!);
    return route.fulfill({ status: 200, json: { status: 'unknown' } });
  });
  await openEmptyStory(page); const panel = await story(page); await direction(panel);
  await expect(panel.getByLabel('I understand these are sample outputs and approve fixture generation.', { exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Generate scene proposals', exact: true }).click();
  await expect.poll(() => posts).toBe(1);
  await panel.getByRole('button', { name: 'Cancel story request', exact: true }).click(); release();
  await expect(panel.getByRole('heading', { name: 'Review your scenes · cancelled', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Generate scene proposals', exact: true })).toBeDisabled();
  await panel.getByRole('button', { name: 'Check saved result — never generate again', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('No request was dispatched');
  expect(posts).toBe(1); await expect(panel.getByLabel('Proposal 1 title', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Hide story assistant', exact: true }).click();
  await expect(page.locator('.react-flow__node:not([data-id^="story-assistant:"])')).toHaveCount(1);
  // Undo may reverse later creative edits, but cannot erase an unresolved
  // provider request. Repeated attempts keep the boundary and identity intact.
  for (let attempt = 0; attempt < 6; attempt++) await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByText('Check the existing Story request before undoing past its start. Undo cannot cancel provider work.').first()).toBeVisible();
  await waitForSaved(page);
  await page.reload();
  const reopened = await story(page);
  await expect(reopened.getByRole('button', { name: 'Generate scene proposals', exact: true })).toBeDisabled();
  await expect(reopened.getByRole('button', { name: 'Check existing Story request', exact: true })).toBeVisible();
  await reopened.getByRole('button', { name: 'Check existing Story request', exact: true }).click();
  await expect.poll(() => checkedIds.length).toBe(2);
  expect(operationId).not.toBe('');
  expect(checkedIds).toEqual([operationId, operationId]);
  expect(posts).toBe(1);
});

test('resolved Story result stays resolved across undo and redo without another request', async ({ page }) => {
  let posts = 0;
  let identity: { projectId: string; operationId: string } | undefined;
  page.on('request', (request) => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/cinema/develop-story') {
    posts++; const body = request.postDataJSON(); identity = { projectId: body.input.projectId, operationId: body.operationId };
  } });
  await openEmptyStory(page); const panel = await story(page); await direction(panel);
  await panel.getByRole('button', { name: 'Generate scene proposals', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Review your scenes · proposal-review', exact: true })).toBeVisible();
  // Manual fixture responses must also be recoverable through the real GET
  // endpoint, not just copied into the undoable browser document.
  const saved = await page.evaluate(async (value) => {
    const response = await fetch(`/api/cinema/develop-story?projectId=${encodeURIComponent(value.projectId)}&operationId=${value.operationId}`);
    return { status: response.status, body: await response.json() };
  }, identity!);
  expect(saved.status).toBe(200);
  expect(saved.body).toMatchObject({ status: 'completed', result: { provenance: { runId: identity!.operationId } } });
  await page.getByRole('button', { name: 'Hide story assistant', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  const reopened = await story(page);
  await expect(reopened.getByRole('heading', { name: 'Review your scenes · proposal-review', exact: true })).toBeVisible();
  await expect(reopened.getByRole('button', { name: 'Check existing Story request', exact: true })).toHaveCount(0);
  await expect(reopened.getByRole('button', { name: 'Accept selected scenes', exact: true })).toBeEnabled();
  await expect(page.locator('.react-flow__node:not([data-id^="story-assistant:"])')).toHaveCount(1);
  expect(posts).toBe(1);
});

test('manual Story tools respect the premise lock for review, references and acceptance', async ({ page }) => {
  let posts = 0;
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts++; });
  await openEmptyStory(page); const panel = await story(page); await direction(panel);
  await panel.getByRole('button', { name: 'Generate scene proposals', exact: true }).click();
  await expect(panel.getByLabel('Select proposal 1', { exact: true })).toBeVisible();
  const before = await panel.locator('.story-proposal strong').allTextContents();
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.getByRole('button', { name: 'Lock Story Premise', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Accept selected scenes', exact: true })).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'Reject proposals', exact: true })).toBeDisabled();
  await expect(panel.getByLabel('Select proposal 1', { exact: true })).toBeDisabled();
  await expect(panel.getByRole('textbox', { name: 'Premise for development', exact: true })).toBeDisabled();
  await panel.locator('summary').filter({ hasText: /^References / }).click();
  await expect(panel.getByLabel('Attach reference image', { exact: true })).toBeDisabled();
  expect(posts).toBe(1); expect(await panel.locator('.story-proposal strong').allTextContents()).toEqual(before);
  await page.getByRole('button', { name: 'Unlock Story Premise', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Accept selected scenes', exact: true })).toBeEnabled();
});

test('Continue inserts only reviewed new material and preserves existing manual scenes', async ({ page }) => {
  await openEditor(page); await addCinemaDraft(page, 'Scene', true);
  const before = await page.locator('.react-flow__node').evaluateAll((nodes) => nodes.map((node) => ({ id: node.getAttribute('data-id'), transform: (node as HTMLElement).style.transform })));
  const panel = await story(page); await direction(panel);
  await panel.getByRole('combobox', { name: 'Goal', exact: true }).selectOption('continue');
  await panel.getByRole('combobox', { name: 'Continue after', exact: true }).selectOption('scene-01');
  await panel.getByLabel('New material duration (seconds)', { exact: true }).fill('30');
  await panel.getByRole('button', { name: 'Review creative brief', exact: true }).click();
  await panel.getByRole('button', { name: 'Approve direction — no AI call', exact: true }).click();
  await expect(panel.getByText(/fixture-story-v1/)).toBeVisible();
  await panel.getByLabel('Proposal count', { exact: true }).fill('1');
  await expect(panel.getByLabel('I understand these are sample outputs and approve fixture generation.', { exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Generate scene proposals', exact: true }).click();
  await panel.locator('.story-proposal').first().locator('summary').click();
  await expect(panel.getByLabel('Proposal 1 duration', { exact: true })).toHaveValue('30');
  await panel.getByRole('button', { name: 'Accept selected scenes', exact: true }).click();
  await expect(panel.getByText('Scenes accepted as one undoable change. No AI call.')).toBeVisible();
  await page.getByRole('button', { name: 'Hide story assistant', exact: true }).click();
  await expect(page.locator('.react-flow__node:not([data-id^="story-assistant:"])')).toHaveCount(before.length + 1);
  for (const node of before) await expect(page.locator(`.react-flow__node[data-id="${node.id}"]`)).toHaveCSS('transform', /matrix/);
  const after = await page.locator('.react-flow__node').evaluateAll((nodes) => nodes.map((node) => ({ id: node.getAttribute('data-id'), transform: (node as HTMLElement).style.transform })));
  expect(after.filter((node) => before.some((original) => original.id === node.id))).toEqual(before);
});
