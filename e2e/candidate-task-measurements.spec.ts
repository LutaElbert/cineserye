import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { installStorageHarness } from './storage-harness';
import { waitForSaved } from './helpers';
import { fulfillWorkspaceMode } from './workspace-capability-helpers';

const execute = promisify(execFile);
const outputRoot = process.env.CINESERYE_MEASUREMENT_OUTPUT ?? (() => { throw new Error('CINESERYE_MEASUREMENT_OUTPUT is required.'); })();

type Category = 'navigation' | 'editing' | 'operation' | 'acceptance' | 'reconciliation' | 'fixture-setup';
type Action = {
  label: string;
  category: Category;
  panelSwitch: boolean;
  clickMs: number;
  nextAction?: string;
  nextActionVisibleMs?: number;
  competingPrimaryActions: string[];
};
type Measurement = {
  protocol: 'P0.9/P3.9';
  candidate: 'five-stage-journal-draft';
  viewport: { width: 1440; height: 900 };
  task: string;
  startedAt: string;
  outcome: 'completed' | 'blocked-as-expected' | 'blocked-candidate-defect';
  navigationOnlyClicks: number;
  panelSwitches: number;
  editingActions: number;
  acceptanceActions: number;
  operationActions: number;
  reconciliationActions: number;
  hiddenSelectionPrerequisite: { observed: boolean; evidence: string };
  actions: Action[];
  providerPosts: string[];
  notes: string[];
};

async function visiblePrimaryActions(page: Page) {
  return page.locator('button.primary-button:not([disabled]), a.primary-button').evaluateAll((elements) => elements
    .filter((element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    })
    .map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean));
}

function createMeasurement(task: string): Measurement {
  return {
    protocol: 'P0.9/P3.9', candidate: 'five-stage-journal-draft', viewport: { width: 1440, height: 900 }, task,
    startedAt: new Date().toISOString(), outcome: 'completed', navigationOnlyClicks: 0, panelSwitches: 0,
    editingActions: 0, acceptanceActions: 0, operationActions: 0, reconciliationActions: 0,
    hiddenSelectionPrerequisite: { observed: false, evidence: '' }, actions: [], providerPosts: [], notes: [],
  };
}

async function act(page: Page, measurement: Measurement, label: string, category: Category, target: Locator, options: {
  panelSwitch?: boolean; next?: Locator; nextLabel?: string;
} = {}) {
  await expect(target).toBeVisible();
  const started = performance.now();
  await target.click();
  const clickMs = performance.now() - started;
  let nextActionVisibleMs: number | undefined;
  if (options.next) {
    const waitStarted = performance.now();
    await expect(options.next).toBeVisible({ timeout: 60_000 });
    nextActionVisibleMs = performance.now() - waitStarted;
  }
  if (category === 'navigation') measurement.navigationOnlyClicks++;
  if (category === 'editing') measurement.editingActions++;
  if (category === 'acceptance') measurement.acceptanceActions++;
  if (category === 'operation') measurement.operationActions++;
  if (category === 'reconciliation') measurement.reconciliationActions++;
  if (options.panelSwitch) measurement.panelSwitches++;
  measurement.actions.push({ label, category, panelSwitch: Boolean(options.panelSwitch), clickMs,
    nextAction: options.nextLabel, nextActionVisibleMs, competingPrimaryActions: await visiblePrimaryActions(page) });
}

async function finish(measurement: Measurement, info: TestInfo) {
  expect(measurement.actions.filter((action) => action.competingPrimaryActions.length > 1)
    .map(({ label, competingPrimaryActions }) => ({ label, competingPrimaryActions }))).toEqual([]);
  await mkdir(outputRoot, { recursive: true });
  const name = info.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  const path = join(outputRoot, `${name}.json`);
  await writeFile(path, `${JSON.stringify(measurement, null, 2)}\n`);
  await info.attach('raw-task-measurement', { path, contentType: 'application/json' });
}

async function startIdea(page: Page, measurement: Measurement, premise = 'Four friends discover a cursed board game. A 60-second vertical horror mystery, no dialogue. All four survive.') {
  await page.goto('/?flow=simplified&stage=idea');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const chooser = page.getByRole('dialog', { name: /Start with your scene/ });
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  await act(page, measurement, 'Start with an idea', 'navigation', chooser.getByRole('button', { name: /Start with an idea/ }),
    { panelSwitch: true, next: editor.getByRole('textbox', { name: 'Premise for development', exact: true }), nextLabel: 'Premise for development' });
  await editor.getByRole('textbox', { name: 'Premise for development', exact: true }).fill(premise);
  measurement.editingActions++;
  measurement.actions.push({ label: 'Enter premise', category: 'editing', panelSwitch: false, clickMs: 0,
    competingPrimaryActions: await visiblePrimaryActions(page) });
  return editor;
}

async function reachOutlineReview(page: Page, measurement: Measurement, setup = false) {
  const editor = await startIdea(page, measurement);
  const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
  const category: Category = setup ? 'fixture-setup' : 'operation';
  await act(page, measurement, 'Generate story analysis', category, editor.getByRole('button', { name: 'Generate', exact: true }),
    { panelSwitch: true, next: assistant.getByRole('button', { name: 'Continue', exact: true }), nextLabel: 'Continue from analysis review' });
  await act(page, measurement, 'Continue from analysis review', setup ? 'fixture-setup' : 'acceptance', assistant.getByRole('button', { name: 'Continue', exact: true }),
    { next: assistant.getByRole('heading', { name: 'Here’s what I understood', exact: true }), nextLabel: 'Review understood direction' });
  await act(page, measurement, 'Confirm understood direction', setup ? 'fixture-setup' : 'acceptance', assistant.getByRole('button', { name: 'Continue', exact: true }),
    { next: assistant.getByRole('button', { name: 'Draft scene outline', exact: true }), nextLabel: 'Draft scene outline' });
  await act(page, measurement, 'Draft scene outline', category, assistant.getByRole('button', { name: 'Draft scene outline', exact: true }),
    { next: assistant.getByRole('button', { name: 'Add 3 scenes', exact: true }), nextLabel: 'Add proposed scenes' });
  return assistant;
}

test.describe.configure({ mode: 'serial' });
test.beforeEach(async ({ page }) => {
  expect(process.env.CINESERYE_E2E_RUNTIME).toBe('node-fixture');
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('01 new idea to accepted shot plan', async ({ page }, info) => {
  const m = createMeasurement('New idea → accepted shot plan');
  page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) m.providerPosts.push(new URL(request.url()).pathname); });
  const assistant = await reachOutlineReview(page, m);
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0);
  m.hiddenSelectionPrerequisite = { observed: false, evidence: 'No selected canvas node before scene acceptance or scoped shot planning; scope is explicit in Assistant.' };
  await act(page, m, 'Accept all three proposed scenes', 'acceptance', assistant.getByRole('button', { name: 'Add 3 scenes', exact: true }),
    { next: assistant.getByRole('button', { name: 'Create 3 fixture plans', exact: true }), nextLabel: 'Review scoped shot request' });
  await act(page, m, 'Create three fixture plans', 'operation', assistant.getByRole('button', { name: 'Create 3 fixture plans', exact: true }),
    { next: assistant.getByRole('checkbox', { name: /Include this plan/ }).first(), nextLabel: 'Review explicit plan selection' });
  await expect(assistant.getByRole('checkbox', { name: /Include this plan/ })).toHaveCount(3);
  await act(page, m, 'Accept selected shot plans', 'acceptance', assistant.getByRole('button', { name: 'Add selected shot plans', exact: true }),
    { next: assistant.getByRole('button', { name: /Open shots & media/ }).first(), nextLabel: 'Open shots and media' });
  await finish(m, info);
});

test('02 reopen and partially accept saved draft', async ({ page }, info) => {
  const m = createMeasurement('Reopen and partially accept a saved draft');
  page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) m.providerPosts.push(new URL(request.url()).pathname); });
  const assistant = await reachOutlineReview(page, m, true);
  const history = assistant.getByRole('region', { name: 'Saved story history', exact: true });
  await act(page, m, 'Open saved drafts', 'navigation', assistant.getByRole('button', { name: 'Saved drafts', exact: true }),
    { panelSwitch: true, next: history.getByRole('button', { name: 'Review draft 1', exact: true }), nextLabel: 'Review saved draft 1' });
  await act(page, m, 'Reopen saved draft 1', 'navigation', history.getByRole('button', { name: 'Review draft 1', exact: true }),
    { panelSwitch: true, next: assistant.getByRole('checkbox', { name: 'Select proposal 1', exact: true }), nextLabel: 'Select proposals explicitly' });
  await assistant.getByRole('checkbox', { name: 'Select proposal 2', exact: true }).uncheck();
  await assistant.getByRole('checkbox', { name: 'Select proposal 3', exact: true }).uncheck();
  m.acceptanceActions += 2;
  m.actions.push({ label: 'Choose one of three visible proposals', category: 'acceptance', panelSwitch: false, clickMs: 0,
    competingPrimaryActions: await visiblePrimaryActions(page) });
  const mismatch = assistant.getByRole('checkbox', { name: 'Accept 15s without stretching other scenes; keep unselected drafts.', exact: true });
  const initiallyInViewport = await mismatch.evaluate(element => {
    const box = element.getBoundingClientRect();
    return box.top >= 0 && box.bottom <= window.innerHeight;
  });
  await mismatch.scrollIntoViewIfNeeded();
  await act(page, m, 'Confirm partial-duration acceptance', 'acceptance', mismatch,
    { next: assistant.getByRole('button', { name: 'Add 1 scene', exact: true }), nextLabel: 'Add one selected scene' });
  m.hiddenSelectionPrerequisite = { observed: !initiallyInViewport,
    evidence: initiallyInViewport ? 'The duration-mismatch checkbox was already in the viewport.' : 'The visible Add 1 scene action was disabled until a duration-mismatch checkbox below the scroll boundary was found and checked.' };
  await act(page, m, 'Accept one selected scene', 'acceptance', assistant.getByRole('button', { name: 'Add 1 scene', exact: true }),
    { next: assistant.getByRole('button', { name: 'Plan shots', exact: true }), nextLabel: 'Plan shots' });
  await finish(m, info);
});

test('03 locate blocked capability', async ({ page }, info) => {
  const m = createMeasurement('Locate a blocked capability');
  let posts = 0;
  await page.route('**/api/cinema/workflow-capabilities', route => fulfillWorkspaceMode(route, 'live'));
  await page.route('**/api/cinema/story-assistant?mode=live', route => route.fulfill({ json: {
    enabled: true, mode: 'live', model: 'review-only-test-model', quoteId: 'a'.repeat(64), cost: 0.01, ceiling: 1,
    ready: false, blockers: ['Live story understanding is not enabled for this workspace.'],
  } }));
  await page.route('**/api/cinema/**', route => {
    if (route.request().method() === 'POST') { posts++; return route.abort('blockedbyclient'); }
    return route.fallback();
  });
  const editor = await startIdea(page, m);
  const alert = page.getByRole('region', { name: 'Story Assistant', exact: true }).getByRole('alert');
  await act(page, m, 'Open generation review', 'operation', editor.getByRole('button', { name: 'Generate', exact: true }),
    { panelSwitch: true, next: alert, nextLabel: 'Blocking reason' });
  await expect(alert).toContainText('Live story understanding is not enabled');
  expect(posts).toBe(0);
  m.outcome = 'blocked-as-expected';
  m.hiddenSelectionPrerequisite = { observed: false, evidence: 'The blocking reason is inline in Story Assistant; no selection or diagnostics dialog is required.' };
  m.notes.push('Expected blocked outcome. No provider POST was sent.');
  await finish(m, info);
});

test('04 reconcile interrupted work after reload', async ({ page }, info) => {
  const m = createMeasurement('Reconcile interrupted work after reload');
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let persisted = false;
  await page.route('**/api/cinema/story-assistant', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    m.providerPosts.push(new URL(route.request().url()).pathname);
    const response = await route.fetch(); persisted = true; await held; await route.fulfill({ response }).catch(() => {});
  });
  const editor = await startIdea(page, m);
  const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
  await act(page, m, 'Open analysis review', 'fixture-setup', editor.getByRole('button', { name: 'Generate', exact: true }),
    { panelSwitch: true, next: assistant.getByRole('button', { name: 'Continue', exact: true }), nextLabel: 'Continue' });
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect.poll(() => persisted).toBe(true);
  await page.reload();
  release();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await act(page, m, 'Focus Story Assistant after reload', 'navigation', page.getByRole('button', { name: 'Focus story assistant', exact: true }),
    { panelSwitch: true, next: assistant.getByRole('button', { name: 'Check saved analysis', exact: true }), nextLabel: 'Check saved analysis' });
  await act(page, m, 'Check saved analysis', 'reconciliation', assistant.getByRole('button', { name: 'Check saved analysis', exact: true }),
    { next: assistant.getByRole('button', { name: 'Continue', exact: true }), nextLabel: 'Continue recovered analysis' });
  expect(m.providerPosts).toEqual(['/api/cinema/story-assistant']);
  m.hiddenSelectionPrerequisite = { observed: false, evidence: 'The durable recovery action is explicit after focusing Story Assistant; no selection is required.' };
  await finish(m, info);
});

test('05 find usable take and export local cut', async ({ page }, info) => {
  test.setTimeout(120_000);
  const m = createMeasurement('Find a usable take and export a local cut');
  const setup = createMeasurement('Fixture setup excluded from measurement');
  const inputPath = info.outputPath('synthetic-silent-input.mp4');
  await mkdir(dirname(inputPath), { recursive: true });
  await execute('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=24', '-t', '4', '-an',
    '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', inputPath]);
  const setupAssistant = await reachOutlineReview(page, setup, true);
  await setupAssistant.getByRole('button', { name: 'Add 3 scenes', exact: true }).click();
  await expect(setupAssistant.getByRole('button', { name: 'Create 3 fixture plans', exact: true })).toBeVisible();
  await setupAssistant.getByRole('button', { name: 'Create 3 fixture plans', exact: true }).click();
  await expect(setupAssistant.getByRole('checkbox', { name: /Include this plan/ })).toHaveCount(3);
  await setupAssistant.getByRole('button', { name: 'Add selected shot plans', exact: true }).click();
  await expect(setupAssistant.getByRole('button', { name: /Open shots & media/ })).toHaveCount(3);
  await waitForSaved(page);
  await installStorageHarness(page);
  await page.route('**/synthetic-cut-seed', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Synthetic local cut fixture</title>' }));
  await page.goto('/synthetic-cut-seed');
  await page.evaluate(async base64 => {
    const modulePath = '/__test-modules/persistence.js';
    const storage = await import(modulePath) as typeof import('../app/editor/persistence');
    const document = (await storage.loadLocalDocument())!;
    const cinema = document.cinema!;
    const pixels = window.document.createElement('canvas'); pixels.width = 160; pixels.height = 90;
    pixels.getContext('2d')!.fillRect(0, 0, 160, 90);
    const png = await new Promise<Blob>(resolve => pixels.toBlob(blob => resolve(blob!), 'image/png'));
    const image = await storage.saveLocalMediaBlob(png, { mimeType: 'image/png', width: 160, height: 90 });
    const bytes = Uint8Array.from(atob(base64), value => value.charCodeAt(0));
    const video = await storage.saveLocalMediaBlob(new Blob([bytes], { type: 'video/mp4' }), { mimeType: 'video/mp4', width: 160, height: 90 });
    const now = new Date().toISOString();
    const visual: import('../app/domain/cinema/visual-preproduction').CinemaVisualPreproductionData = {
      version: 1, references: {}, storyboardRuns: {}, storyboardFrames: {}, videoOperations: {}, videoClips: {},
    };
    const shots = cinema.sceneOrder.flatMap(id => cinema.scenes[id].shotIds.map(id => cinema.shots[id]));
    for (const shot of shots) {
      shot.durationSeconds = 1;
      const revision = Object.values(cinema.revisions).find(item => item.status === 'active' && item.snapshot.shots[shot.id])!;
      revision.snapshot.shots[shot.id].durationSeconds = 1;
      const prompt = Object.values(cinema.prompts).find(item => item.ownerNodeId === shot.nodeId && item.purpose === 'video')!;
      const imagePrompt = Object.values(cinema.prompts).find(item => item.ownerNodeId === shot.nodeId && item.purpose === 'storyboard')!;
      const runId = `measure-image-${shot.id}`, frameId = `measure-frame-${shot.id}`;
      visual.storyboardRuns[runId] = { id: runId, shotId: shot.id, revisionId: revision.id, promptId: imagePrompt.id,
        promptVersion: imagePrompt.version, referenceIds: [], provider: 'synthetic-local-test', model: 'canvas-test', aspectRatio: '16:9',
        outputCount: 1, intent: 'balanced', estimatedCost: 0, currency: 'USD', status: 'completed', consentedAt: now,
        startedAt: now, completedAt: now, error: null };
      visual.storyboardFrames[frameId] = { id: frameId, runId, shotId: shot.id, revisionId: revision.id, promptId: imagePrompt.id,
        promptVersion: imagePrompt.version, promptText: imagePrompt.generatedText, referenceIds: [], provider: 'synthetic-local-test', model: 'canvas-test',
        aspectRatio: '16:9', seed: null, variantIndex: 0, intent: 'balanced', blobHash: image.hash, mimeType: 'image/png', width: 160,
        height: 90, byteSize: png.size, safetyStatus: 'passed', status: 'approved', estimatedCost: 0, currency: 'USD', createdAt: now };
      const operationId = `measure-video-${shot.id}`;
      const settings = { aspectRatio: '16:9', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null } as const;
      visual.videoOperations[operationId] = { id: operationId, shotId: shot.id, revisionId: revision.id, promptId: prompt.id,
        promptVersion: prompt.version, promptText: prompt.generatedText, negativeConstraints: [], startFrameId: frameId, startFrameApproval: 'approved',
        endFrameId: null, endFrameApproval: null, referenceIds: [], provider: 'synthetic-local-test', model: 'ffmpeg-test', capabilityProfileVersion: 'synthetic-1',
        settings, estimatedCost: 0, currency: 'USD', providerOperationId: null, status: 'ready', retryOf: null,
        consentedAt: now, startedAt: now, completedAt: now, error: null };
      const clipId = `measure-clip-${shot.id}`;
      visual.videoClips[clipId] = { id: clipId, operationId, shotId: shot.id, revisionId: revision.id, promptId: prompt.id,
        promptVersion: prompt.version, startFrameId: frameId, endFrameId: null, referenceIds: [], provider: 'synthetic-local-test', model: 'ffmpeg-test',
        capabilityProfileVersion: 'synthetic-1', settings, blobHash: video.hash, mimeType: 'video/mp4', width: 160, height: 90,
        byteSize: bytes.length, durationSeconds: 4, status: 'approved', estimatedCost: 0, currency: 'USD', createdAt: now };
    }
    cinema.visualPreproduction = visual;
    await storage.saveLocalDocument(document);
  }, Buffer.from(await readFile(inputPath)).toString('base64'));
  await page.goto('/?flow=simplified&stage=idea');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Filmmaking workspaces', exact: true });
  const cut = page.getByRole('region', { name: 'Review sequence', exact: true });
  await act(page, m, 'Open Edit', 'navigation', navigation.getByRole('button', { name: 'Edit', exact: true }),
    { panelSwitch: true, next: cut.getByLabel('Output aspect'), nextLabel: 'Review usable takes' });
  await expect(cut).toContainText('Decoded clip: 4.00s');
  m.hiddenSelectionPrerequisite = { observed: false, evidence: 'Approved takes are listed in story order immediately in Edit; the active take is visible without canvas selection.' };
  await cut.getByLabel('Output aspect').selectOption('16:9');
  m.editingActions++;
  m.actions.push({ label: 'Choose visible output aspect', category: 'editing', panelSwitch: false, clickMs: 0,
    competingPrimaryActions: await visiblePrimaryActions(page) });
  await act(page, m, 'Render silent MP4 locally', 'operation', cut.getByRole('button', { name: 'Render silent MP4 locally', exact: true }));
  const output = cut.getByRole('link', { name: 'Download verified MP4', exact: true });
  const renderError = page.getByRole('alert').last();
  await expect.poll(async () => await output.isVisible() || await renderError.isVisible(), { timeout: 60_000 }).toBe(true);
  if (await output.isVisible()) {
    const download = page.waitForEvent('download');
    await act(page, m, 'Download verified MP4', 'acceptance', output);
    await download;
  } else {
    m.outcome = 'blocked-candidate-defect';
    m.notes.push(`Local cut could not finish on the candidate: ${(await renderError.textContent())?.trim() ?? 'unknown renderer error'}`);
  }
  await finish(m, info);
});
