import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { EditorDocument } from '../app/editor/types';

const sizes = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'short', width: 877, height: 559 }, { name: 'mobile', width: 390, height: 844 }];
async function start(page: Page, sample = true) {
  await page.goto('/?flow=simplified');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const chooser = page.getByRole('dialog', { name: /Start with your scene/ });
  await chooser.getByRole('button', { name: sample ? /Explore.*sample/i : /Start with an idea/ }).click();
  await expect(page.getByRole('navigation', { name: 'Filmmaking workspaces' })).toBeVisible();
}
async function select(page: Page, name: string) {
  const stageWorkspaces: Record<string, string> = { Idea: 'Story', Plan: 'Story', References: 'Shots', Video: 'Shots', 'Final Cut': 'Edit' };
  const workspaceName = stageWorkspaces[name];
  const workspaces = page.getByRole('navigation', { name: 'Filmmaking workspaces' });
  if (!workspaceName) { await workspaces.getByRole('button', { name, exact: true }).click(); return; }
  const workspace = workspaces.getByRole('button', { name: workspaceName, exact: true });
  if (await workspace.getAttribute('aria-current') !== 'page') await workspace.click();
  const stage = page.getByRole('navigation', { name: `${workspaceName} stages` }).getByRole('button', { name, exact: true });
  if (await stage.getAttribute('aria-current') !== 'step') await stage.click();
}
function selectedStage(page: Page, name: string) {
  const workspaceName = ({ Idea: 'Story', Plan: 'Story', References: 'Shots', Video: 'Shots', 'Final Cut': 'Edit' } as Record<string, string>)[name];
  return page.getByRole('navigation', { name: `${workspaceName} stages` }).getByRole('button', { name, exact: true });
}
async function savedDocument(page: Page) {
  await expect(page.locator('main')).toHaveAttribute('data-save-state', 'saved');
  return page.evaluate(() => new Promise<EditorDocument>((resolve, reject) => {
    const request = indexedDB.open('cineserye-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction('documents', 'readonly').objectStore('documents').get('current');
      read.onsuccess = () => { resolve(read.result); db.close(); };
      read.onerror = () => { reject(read.error); db.close(); };
    };
  }));
}
function content(document: EditorDocument) {
  return { title: document.title, nodes: document.nodes.map(({ id, type, data }) => ({ id, type, data })), edges: document.edges, cinema: document.cinema };
}

for (const size of sizes) test(`simplified workspaces preserve the project without dispatch at ${size.name}`, async ({ page }, info) => {
  await page.setViewportSize(size);
  const posts: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts.push(request.url()); });
  await start(page);
  const title = await page.getByRole('textbox', { name: 'Document title' }).inputValue();
  const original = content(await savedDocument(page));
  const nodeIds = await page.locator('.react-flow__node').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-id')).sort());
  await page.screenshot({ path: info.outputPath(`${size.name}-story.png`) });
  await select(page, 'References');
  await expect(page.getByRole('region', { name: 'References overview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review references', exact: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath(`${size.name}-shots.png`) });
  await page.getByRole('button', { name: 'Review references', exact: true }).first().click();
  await expect(page.getByRole('region', { name: 'Shot layer editor', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to shots overview', exact: true }).click();
  await select(page, 'Final Cut');
  await expect(page.getByRole('region', { name: 'Review sequence', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Render silent MP4 locally', exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath(`${size.name}-edit.png`) });
  await expect(page.getByRole('textbox', { name: 'Document title' })).toHaveValue(title);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Workspace status', exact: true }).click();
  const status = page.getByRole('dialog', { name: 'Workspace status', exact: true });
  await expect(status.getByText('Local operator · fixture mode', { exact: true })).toBeVisible();
  await expect(status.getByText('Fixture only', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath(`${size.name}-status.png`) });
  const scan = await new AxeBuilder({ page }).include('.workspace-status-dialog').analyze();
  expect(scan.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  await page.keyboard.press('Escape'); await expect(status).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Workspace status', exact: true })).toBeFocused();
  await page.goBack();
  await expect(selectedStage(page, 'References')).toHaveAttribute('aria-current', 'step');
  await select(page, 'Idea');
  expect(await page.locator('.react-flow__node').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-id')).sort())).toEqual(nodeIds);
  await expect(page.locator('main')).toHaveAttribute('data-save-state', 'saved');
  await select(page, 'References'); await page.reload();
  await expect(page.getByRole('region', { name: 'References overview' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Document title' })).toHaveValue(title);
  expect(content(await savedDocument(page))).toEqual(original);
  expect(posts).toEqual([]);
});

test('hidden canvas rejects destructive keys, paste and drop, and preview switching never reloads', async ({ page }) => {
  await start(page);
  const original = content(await savedDocument(page));
  await page.locator('.react-flow__node').first().click();
  const ids = await page.locator('.react-flow__node').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-id')).sort());
  await page.getByRole('button', { name: 'Workspace status', exact: true }).click();
  await page.getByRole('button', { name: 'Close workspace status', exact: true }).focus();
  await page.keyboard.press('Delete'); await page.keyboard.press('Backspace');
  expect(await page.locator('.react-flow__node').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-id')).sort())).toEqual(ids);
  await page.getByRole('button', { name: 'Close workspace status', exact: true }).click();
  for (const workspace of ['References', 'Final Cut']) {
    await select(page, workspace);
    await page.locator('#canvas-workspace').focus();
    for (const key of ['Delete', 'Backspace', 'ControlOrMeta+a', 'Delete', 'Enter', 'Shift+Enter', 'Tab']) {
      await page.keyboard.press(key);
      await expect(selectedStage(page, workspace)).toHaveAttribute('aria-current', 'step');
    }
    expect(await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['image bytes'], 'paste.png', { type: 'image/png' }));
      const event = new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      document.querySelector('#canvas-workspace')!.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
      return event.defaultPrevented;
    })).toBe(false);
    expect(await page.locator('.react-flow__node').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-id')).sort())).toEqual(ids);
  }
  expect(content(await savedDocument(page))).toEqual(original);
  await page.evaluate(() => { document.body.dataset.previewContinuity = 'retained'; });
  await page.getByRole('textbox', { name: 'Document title' }).fill('Unsaved mode switch');
  await page.locator('.simplified-advanced summary').click();
  await page.getByRole('button', { name: 'Original workspace', exact: true }).click();
  await page.keyboard.press('Delete'); await page.keyboard.press('Backspace');
  await page.getByRole('button', { name: 'Switch to original workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Try simplified flow', exact: true }).click();
  await page.keyboard.press('Delete'); await page.keyboard.press('Backspace');
  expect(await page.locator('.react-flow__node').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-id')).sort())).toEqual(ids);
  await page.getByRole('button', { name: 'Switch to simplified preview', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Document title' })).toHaveValue('Unsaved mode switch');
  expect(await page.locator('body').getAttribute('data-preview-continuity')).toBe('retained');
  await expect(page.locator('.sequence-review')).toHaveCount(1);
});

test('twenty five-stage transitions do not grow listeners, polls, requests, or warnings', async ({ page }) => {
  await page.addInitScript(() => {
    const targetIds = new WeakMap<EventTarget, number>(), listenerIds = new WeakMap<object, number>();
    const activeListeners = new Set<string>(), activeIntervals = new Set<number>();
    let nextTarget = 1, nextListener = 1;
    const targetId = (target: EventTarget) => targetIds.get(target) ?? (targetIds.set(target, nextTarget), nextTarget++);
    const listenerId = (listener: EventListenerOrEventListenerObject) => listenerIds.get(listener as object)
      ?? (listenerIds.set(listener as object, nextListener), nextListener++);
    const capture = (options?: boolean | AddEventListenerOptions | EventListenerOptions) => typeof options === 'boolean' ? options : Boolean(options?.capture);
    const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (listener) activeListeners.add(`${targetId(this)}:${type}:${listenerId(listener)}:${capture(options)}`);
      return add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      if (listener) activeListeners.delete(`${targetId(this)}:${type}:${listenerId(listener)}:${capture(options)}`);
      return remove.call(this, type, listener, options);
    };
    const createInterval = window.setInterval, clearInterval = window.clearInterval;
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const id = createInterval(handler, timeout, ...args); activeIntervals.add(id); return id;
    }) as typeof window.setInterval;
    window.clearInterval = ((id?: number) => { if (id !== undefined) activeIntervals.delete(id); clearInterval(id); }) as typeof window.clearInterval;
    Object.assign(window, { __cineseryeResourceCounts: () => ({ listeners: activeListeners.size, intervals: activeIntervals.size }) });
  });
  const requests: string[] = [], warnings: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/cinema/')) requests.push(`${request.method()} ${new URL(request.url()).pathname}`); });
  page.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') warnings.push(message.text()); });
  await start(page);
  const cycle = async () => {
    for (const stage of ['Plan', 'References', 'Video', 'Final Cut', 'Idea']) {
      await select(page, stage);
      await expect(selectedStage(page, stage)).toHaveAttribute('aria-current', 'step');
    }
  };
  await cycle(); // Warm each lazily mounted surface before taking the baseline.
  await expect.poll(() => requests.filter((request) => request === 'GET /api/cinema/assemble').length).toBe(1);
  await expect(page.locator('.sequence-review')).not.toContainText('Checking local renderer…');
  const counts = () => page.evaluate(() => (window as unknown as { __cineseryeResourceCounts: () => { listeners: number; intervals: number } }).__cineseryeResourceCounts());
  const before = await counts(); requests.length = 0; warnings.length = 0;
  for (let index = 0; index < 4; index++) await cycle();
  const after = await counts();
  expect(after.listeners).toBe(before.listeners);
  expect(after.intervals).toBeLessThanOrEqual(before.intervals);
  expect(requests).toEqual([]);
  expect(warnings).toEqual([]);
});

test('all five stages remain keyboard reachable with reduced motion and 200% text', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const navigation = page.getByRole('navigation', { name: 'Filmmaking workspaces' });
  await expect(navigation.getByRole('button')).toHaveCount(3);
  for (const workspace of ['Story', 'Shots', 'Edit']) await expect(navigation.getByRole('button', { name: workspace, exact: true })).toBeVisible();
  for (const stage of ['Idea', 'Plan', 'References', 'Video', 'Final Cut']) {
    await select(page, stage);
    const button = selectedStage(page, stage);
    await button.focus(); await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-current', 'step');
    await expect(button).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const scan = await new AxeBuilder({ page }).include('.filmmaking-navigation').include('.workspace-guide')
      .include('.simplified-surface:not([hidden])').analyze();
    expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? '')),
      scan.violations.map(item => `${item.id}: ${item.help}`).join('\n')).toEqual([]);
  }
});

test('adding a missing premise preserves existing scenes, shots and assets and is one undo step', async ({ page }) => {
  await start(page);
  // Model an older saved project with a generic canonical root, not a premise.
  const sample = await savedDocument(page);
  const legacy = { ...sample, nodes: sample.nodes.map((node) => node.id === sample.cinema?.projectNodeId && node.data.kind === 'concept'
    ? { ...node, data: { ...node.data, domainType: 'cinema.note', eyebrow: 'Note' } } : node) };
  await page.evaluate((serialized) => new Promise<void>((resolve, reject) => {
    const document = JSON.parse(serialized);
    const request = indexedDB.open('cineserye-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, transaction = db.transaction('documents', 'readwrite');
      transaction.objectStore('documents').put({ ...document, id: 'current' });
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }), JSON.stringify(legacy));
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const original = await savedDocument(page);
  await page.getByRole('button', { name: 'Write your idea', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Story premise layer editor', exact: true })).toBeVisible();
  const next = await savedDocument(page);
  expect(next.nodes).toHaveLength(original.nodes.length + 1);
  expect(content({ ...next, nodes: next.nodes.filter((node) => original.nodes.some((previous) => previous.id === node.id)) }).nodes).toEqual(content(original).nodes);
  expect(next.edges).toEqual(original.edges);
  expect(next.cinema?.scenes).toEqual(original.cinema?.scenes);
  expect(next.cinema?.shots).toEqual(original.cinema?.shots);
  expect(next.cinema?.assets).toEqual(original.cinema?.assets);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(content(await savedDocument(page))).toEqual(content(original));
});

test('advanced Back navigation and outline inspection always reveal their destination', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
  await start(page);
  await select(page, 'Final Cut');
  await page.locator('.simplified-advanced summary').click();
  await page.getByRole('button', { name: 'Shot table', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Review sequence', exact: true })).toBeVisible();
  await select(page, 'Idea');
  await expect(page.locator('.react-flow')).toBeVisible();
  await select(page, 'References');
  await page.getByRole('button', { name: 'Review references', exact: true }).first().click();
  await page.getByRole('button', { name: 'Back to shots overview' }).click();
  await select(page, 'Idea');
  await expect(page.getByRole('region', { name: 'Current filmmaking step' }).getByRole('button')).toBeVisible();
  await select(page, 'Final Cut');
  await page.locator('.outline-scene-branch .outline-summary-main').first().click();
  await expect(page.getByRole('region', { name: 'Scene layer editor', exact: true })).toBeVisible();
  await expect(page.locator('.react-flow')).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test('malformed capability discovery stays unknown and does not block manual work', async ({ page }) => {
  await page.route('**/api/cinema/workflow-capabilities', (route) => route.fulfill({ json: { version: 999, ready: true } }));
  await start(page, false);
  await page.getByRole('button', { name: 'Workspace status', exact: true }).click();
  const status = page.getByRole('dialog', { name: 'Workspace status', exact: true });
  await expect(status.getByRole('alert')).toContainText('Availability is unknown');
  await expect(status.getByText('Fixture only', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await select(page, 'References'); await expect(page.getByRole('heading', { name: 'Your references begin with a scene' })).toBeVisible();
  await select(page, 'Final Cut'); await expect(page.getByRole('region', { name: 'Review sequence' })).toContainText('Accept a shot plan');
  await select(page, 'Idea');
  await expect(page.getByRole('region', { name: 'Story premise layer editor', exact: true })).toBeVisible();
});

test('workspace status and diagnostics share one validated discovery and identical reasons', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
  let discoveries = 0; let legacyRequests = 0; let posts = 0; let malformed = false;
  await page.route('**/api/cinema/workflow-capabilities', (route) => {
    discoveries++;
    return malformed ? route.fulfill({ json: { version: 1, ready: true } }) : route.continue();
  });
  page.on('request', (request) => {
    if (request.url().endsWith('/api/cinema/provider-status')) legacyRequests++;
    if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts++;
  });
  await start(page);
  await page.getByRole('button', { name: 'Workspace status', exact: true }).click();
  const status = page.getByRole('dialog', { name: 'Workspace status', exact: true });
  await expect(status.locator('li')).toHaveCount(8);
  const rows = await status.locator('li').evaluateAll((items) => items.map((item) => ({
    label: item.querySelector('strong')!.textContent!, status: item.querySelector('.capability-label')!.textContent!, reason: item.querySelector('p')!.textContent!,
  })));
  await expect(status.getByText('Local reference uploads', { exact: true })).toBeVisible();
  await status.getByRole('button', { name: 'Detailed diagnostics', exact: true }).click();
  const diagnostics = page.getByRole('dialog', { name: 'Provider status and local traces', exact: true });
  for (const row of rows) {
    const diagnostic = diagnostics.locator('dl > div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${row.label}$`) }) });
    await expect(diagnostic).toContainText(row.status); await expect(diagnostic).toContainText(row.reason);
  }
  expect(discoveries).toBe(1); expect(legacyRequests).toBe(0);
  malformed = true;
  await diagnostics.getByRole('button', { name: 'Refresh workspace status', exact: true }).click();
  await expect(diagnostics.getByRole('alert')).toContainText('Availability is unknown');
  await expect(diagnostics.getByText('Fixture only', { exact: false })).toHaveCount(0);
  await diagnostics.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Workspace status', exact: true }).click();
  await expect(status.getByRole('alert')).toContainText('Availability is unknown');
  await expect(status.locator('li')).toHaveCount(0);
  expect(discoveries).toBe(2); expect(posts).toBe(0);
  expect(runtimeErrors).toEqual([]);
});

test('simplified Story accepts a fixture outline atomically and preserves it across navigation, undo and reload', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page, false);
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  await editor.getByRole('textbox', { name: 'Premise for development', exact: true }).fill('Mara enters an abandoned cinema and discovers a film showing her next move. Make a 60-second vertical horror-mystery trailer. No dialogue. End with a cliffhanger.');
  await editor.getByRole('button', { name: 'Generate', exact: true }).click();
  const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'Here’s what I understood', exact: true })).toBeVisible();
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await assistant.getByRole('button', { name: 'Draft scene outline', exact: true }).click();
  await expect(assistant.locator('.assistant-scene-row')).toHaveCount(3);
  await page.screenshot({ path: info.outputPath('story-proposal-review.png') });
  await assistant.getByRole('button', { name: 'Add 3 scenes', exact: true }).click();
  await select(page, 'References'); await expect(page.locator('.simplified-scene')).toHaveCount(3);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.simplified-scene')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.simplified-scene')).toHaveCount(3);
  await expect(page.locator('main')).toHaveAttribute('data-save-state', 'saved');
  await page.reload(); await expect(page.locator('.simplified-scene')).toHaveCount(3);
  await page.screenshot({ path: info.outputPath('story-accepted-shots.png') });
});
