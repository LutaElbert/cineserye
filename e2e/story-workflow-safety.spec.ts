import { expect, test } from '@playwright/test';
import { confirmCineseryeDialog, openEditor, waitForSaved } from './helpers';

test('SAFE-02 image estimate review shows model and price, and refreshing clears approval without generating', async ({ page }) => {
  let model = 'reviewed-image-model'; let posts = 0;
  await page.route('**/api/cinema/provider-status', (route) => route.fulfill({ json: {
    mode: 'live', requiresContentTransferConsent: true, research: { configured: true, provider: 'parallel' },
    planning: { configured: true, provider: 'vertex-gemini', model: 'reviewed-model' },
    telemetryPolicy: 'no-content-v1', livePreflight: { ready: true, blockers: [], maxLiveRunCost: 1 },
  } }));
  await page.route('**/api/cinema/generate-storyboard', async (route) => {
    if (route.request().method() === 'POST') { posts++; await route.abort(); return; }
    await route.fulfill({ json: { mode: 'live', model, unitCost: 0.1, maxCost: 1, maxOutputs: 4, quoteId: 'a'.repeat(64), ready: true, blockers: [] } });
  });
  await page.goto('/');
  await page.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Explore the sample/ }).click();
  await page.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await page.getByRole('tab', { name: 'Visuals' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Visuals' });
  await expect(panel.getByText(model, { exact: true })).toBeVisible();
  await expect(panel.getByText('$0.3000', { exact: true })).toBeVisible();
  await panel.getByRole('checkbox', { name: /I confirm/ }).check();
  await expect(panel.getByRole('button', { name: 'Generate storyboard' })).toBeEnabled();
  model = 'new-reviewed-model';
  await panel.getByRole('button', { name: 'Refresh estimate' }).click();
  await expect(panel.getByText(model, { exact: true })).toBeVisible();
  await expect(panel.getByRole('checkbox', { name: /I confirm/ })).not.toBeChecked();
  await expect(panel.getByRole('button', { name: 'Generate storyboard' })).toBeDisabled();
  expect(posts).toBe(0);
});

test('SAFE-06 changed source cannot be overwritten by accepting a pending plan', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Explore the sample/ }).click();
  await page.getByRole('navigation', { name: 'Project outline' }).getByRole('button', { name: 'Scene 01 · The Abandoned Cinema', exact: true }).click();
  await page.getByRole('button', { name: 'Create revision', exact: true }).click();
  await page.getByRole('region', { name: 'Generate shot plan' }).getByRole('button', { name: 'Generate shot plan' }).click();
  const review = page.getByRole('region', { name: 'Shot proposal review' });
  await expect(review).toBeVisible();
  await page.getByLabel('Document title').fill('Changed during review');
  await review.getByRole('button', { name: 'Accept plan' }).click();
  await expect(page.getByText(/The source canvas changed/)).toBeVisible();
  await expect(review).toBeVisible();
  await expect(page.getByLabel('Document title')).toHaveValue('Changed during review');
});

test('SAFE-07 storage transaction protects recovery, checkpoint, pending, and newly reachable media', async ({ page }) => {
  await openEditor(page);
  await waitForSaved(page);
  const result = await page.evaluate(async () => {
    const modulePath = '/app/editor/persistence.ts';
    const persistence = await import(/* @vite-ignore */ modulePath) as typeof import('../app/editor/persistence');
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cineserye-local');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const root = (hash: string) => ({ cinema: { visualPreproduction: {
      references: { a: { blobHash: hash } }, storyboardFrames: {}, videoClips: {},
    } } }) as unknown as import('../app/editor/media-reachability').MediaRoot;
    const hashes = ['gc-recovery', 'gc-checkpoint', 'gc-pending', 'gc-new-memory', 'gc-orphan'];
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(['documents', 'checkpoints', 'pending-proposals', 'media-blobs'], 'readwrite');
      transaction.objectStore('documents').put({ id: 'gc-recovery-root', ...root(hashes[0]) });
      transaction.objectStore('checkpoints').put({ id: 'gc-checkpoint-root', document: root(hashes[1]) });
      transaction.objectStore('pending-proposals').put({ id: 'gc-pending-root', ...root(hashes[2]) });
      for (const hash of hashes) transaction.objectStore('media-blobs').put({ hash, bytes: new Uint8Array([1]).buffer, mimeType: 'image/png', width: 1, height: 1, byteSize: 1, createdAt: Date.now() });
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
    });
    // Candidates were identified before a new reference became reachable.
    const removed = await persistence.collectUnusedLocalMedia(hashes, () => [root('gc-new-memory')]);
    const remaining = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = database.transaction('media-blobs').objectStore('media-blobs').getAllKeys();
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    database.close(); return { removed, remaining };
  });
  expect(result.removed).toBe(1);
  expect(result.remaining.sort()).toEqual(['gc-checkpoint', 'gc-new-memory', 'gc-pending', 'gc-recovery']);
});

test('SAFE-07 another editor tab blocks destructive media cleanup', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Explore the sample/ }).click();
  await waitForSaved(page);
  const other = await context.newPage(); await other.goto('/');
  await expect(other.locator('main[data-ready="true"]')).toBeVisible();
  await expect.poll(() => page.evaluate(async () => (await navigator.locks.query()).held?.filter((lock) => lock.name?.endsWith(':media-retention')).length)).toBe(2);
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('cineserye-local');
    request.onsuccess = () => {
      const database = request.result; const transaction = database.transaction('media-blobs', 'readwrite');
      transaction.objectStore('media-blobs').put({ hash: 'gc-test-orphan', bytes: new Uint8Array([1]).buffer, mimeType: 'image/png', width: 1, height: 1, byteSize: 1, createdAt: Date.now() });
      transaction.oncomplete = () => { database.close(); resolve(); }; transaction.onerror = () => reject(transaction.error);
    };
  }));
  await page.getByRole('button', { name: '03 · The Impossible Film', exact: true }).click();
  await page.getByRole('tab', { name: 'Visuals' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Visuals' });
  await panel.getByRole('button', { name: /approved refs?/ }).click();
  await panel.getByRole('button', { name: 'Clean unused local media' }).click();
  await confirmCineseryeDialog(page, 'Delete 1 item');
  await expect(page.getByText(/Close other Cineserye editor tabs/)).toBeVisible();
  await other.close();
  await panel.getByRole('button', { name: 'Clean unused local media' }).click();
  await confirmCineseryeDialog(page, 'Delete 1 item');
  await expect(page.getByText('1 unused local media item deleted.')).toBeVisible();
});
