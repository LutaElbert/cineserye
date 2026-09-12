import { expect, test, type Page } from '@playwright/test';
import { refreshWorkspaceDiscovery } from './workspace-capability-helpers';

async function assistant(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Start with an idea/ }).click();
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  await editor.getByRole('textbox', { name: 'Premise for development', exact: true }).fill('Four friends discover a cursed board game. A 60-second vertical horror mystery, no dialogue. All four survive.');
  await editor.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  return page.getByRole('region', { name: 'Story Assistant', exact: true });
}
async function pausePreparation(page: Page, flow: 'analysis' | 'shots', boundary: 'preparation' | 'saved request' | 'final digest') {
  await page.evaluate(({ flow, boundary }) => {
    const probe = window as unknown as { digestHeld: boolean; releaseDigest: () => void };
    probe.digestHeld = false;
    const original = crypto.subtle.digest.bind(crypto.subtle);
    const gate = new Promise<void>((resolve) => { probe.releaseDigest = resolve; });
    let afterSave = false;
    if (boundary !== 'preparation') {
      const put = IDBObjectStore.prototype.put;
      const complete = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete')!;
      IDBObjectStore.prototype.put = function(value, ...args) {
        const request = put.call(this, value, ...args);
        const workflow = value.cinema?.storyWorkflow;
        if (this.name === 'documents' && value.id === 'current' && (flow === 'analysis' ? workflow?.assistant?.state === 'understanding' : workflow?.shotPlanning?.status === 'running')) {
          IDBObjectStore.prototype.put = put;
          const transaction = this.transaction;
          Object.defineProperty(transaction, 'oncomplete', { configurable: true, set(callback) {
            complete.set!.call(transaction, function(event: Event) {
              if (boundary === 'final digest') { afterSave = true; callback.call(transaction, event); }
              else { probe.digestHeld = true; void gate.then(() => callback.call(transaction, event)); }
            });
          } });
        }
        return request;
      };
      if (boundary === 'saved request') return;
    }
    let armed = true;
    crypto.subtle.digest = async (...args) => {
      if (armed && (boundary === 'preparation' || afterSave)) { armed = false; probe.digestHeld = true; await gate; }
      return original(...args);
    };
  }, { flow, boundary });
}

for (const flow of ['analysis', 'shots'] as const) for (const boundary of ['preparation', 'saved request'] as const) test(`${flow} ${boundary} rejects a workspace refresh before POST`, async ({ page }) => {
  let failDiscovery = false; let posts = 0;
  await page.route('**/api/cinema/workflow-capabilities', (route) => failDiscovery ? route.fulfill({ status: 503, json: {} }) : route.continue());
  const panel = await assistant(page);
  if (flow === 'shots') {
    await panel.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(panel.getByRole('heading', { name: 'Here’s what I understood', exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Continue', exact: true }).click();
    await panel.getByRole('button', { name: 'Draft scene outline', exact: true }).click();
    await panel.getByRole('button', { name: 'Add 3 scenes', exact: true }).click();
    await panel.getByRole('button', { name: 'Plan shots', exact: true }).click();
  }
  const button = panel.getByRole('button', { name: flow === 'analysis' ? 'Continue' : 'Create 3 fixture plans', exact: true });
  await expect(button).toBeEnabled();
  await expect(page.locator('main')).toHaveAttribute('data-save-state', 'saved');
  await page.route(`**/api/cinema/${flow === 'analysis' ? 'story-assistant' : 'plan-scenes'}`, (route) => {
    if (route.request().method() === 'POST') { posts++; return route.abort('blockedbyclient'); }
    return route.continue();
  });
  await pausePreparation(page, flow, boundary); await button.click();
  await page.waitForFunction(() => (window as unknown as { digestHeld: boolean }).digestHeld);
  failDiscovery = true; await refreshWorkspaceDiscovery(page);
  await expect(page.getByRole('button', { name: /Provider availability unknown/ })).toBeVisible();
  await page.evaluate(() => (window as unknown as { releaseDigest: () => void }).releaseDigest());
  await expect(panel.getByRole('alert').filter({ hasText: 'Workspace status changed' })).toBeVisible();
  expect(posts).toBe(0);
});

test('scoped shots changing review during the final digest blocks POST', async ({ page }) => {
  const panel = await assistant(page);
  await panel.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Here’s what I understood', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Continue', exact: true }).click();
  await panel.getByRole('button', { name: 'Draft scene outline', exact: true }).click();
  await panel.getByRole('button', { name: 'Add 3 scenes', exact: true }).click();
  await panel.getByRole('button', { name: 'Plan shots', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute('data-save-state', 'saved');
  let posts = 0;
  await page.route('**/api/cinema/plan-scenes', (route) => {
    if (route.request().method() === 'POST') { posts++; return route.abort('blockedbyclient'); }
    return route.continue();
  });
  await pausePreparation(page, 'shots', 'final digest');
  await panel.getByRole('button', { name: 'Create 3 fixture plans', exact: true }).click();
  await page.waitForFunction(() => (window as unknown as { digestHeld: boolean }).digestHeld);
  await panel.getByRole('button', { name: 'Change scope', exact: true }).click();
  await page.evaluate(() => (window as unknown as { releaseDigest: () => void }).releaseDigest());
  await expect(panel.getByRole('alert').filter({ hasText: 'planning review changed' })).toBeVisible();
  expect(posts).toBe(0);
});

test('analysis never reuses its old quote while same-mode recovery is pending', async ({ page }) => {
  let holdQuote = false; let release!: () => void; let quoteRequested = false;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/cinema/story-assistant?mode=fixture', async (route) => {
    if (holdQuote) { quoteRequested = true; await gate; }
    await route.continue();
  });
  const panel = await assistant(page);
  await expect(panel.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
  holdQuote = true;
  try {
    await refreshWorkspaceDiscovery(page);
    await expect.poll(() => quoteRequested).toBe(true);
    await expect(page.getByRole('button', { name: /fixture provider mode/ })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0);
  } finally { release(); }
  await expect(panel.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
});
