import { expect, test } from '@playwright/test';
import { addCinemaDraft, confirmCineseryeDialog, openEditor, waitForSaved } from './helpers';

for (const recovery of ['edited new', 'untouched new', 'backup'] as const) {
test(`failed project load preserves unreadable bytes until confirmed ${recovery} recovery`, async ({ page }) => {
  const posts: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
  await openEditor(page); await waitForSaved(page);
  let backupPath: string | null = null;
  if (recovery === 'backup') {
    await page.getByRole('button', { name: 'Project backup and restore' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download backup' }).click();
    backupPath = await (await download).path();
    expect(backupPath).toBeTruthy();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
  }
  // Leave the editor before inserting a future-version record so its
  // visibility flush cannot overwrite the test's deliberately unreadable data.
  await page.goto('/favicon.svg');
  const unreadable = { id: 'current', schemaVersion: 999, title: 'Keep these original bytes', original: 'future format' };
  await page.evaluate(value => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('cineserye-local');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('documents', 'readwrite');
      tx.objectStore('documents').put(value);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }), unreadable);
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toHaveAttribute('data-save-state', 'error');
  await expect(page.getByText('The saved local project could not be opened. Use a backup or start a new project.')).toBeVisible();
  if (recovery === 'edited new') {
    await addCinemaDraft(page, 'Note', true);
    await page.keyboard.press('ControlOrMeta+s');
  }
  // Deliberately observe beyond two 450ms debounce windows: proving absence
  // of a destructive autosave requires allowing it time to have happened.
  await page.waitForTimeout(1100);
  await expect(page.locator('main')).toHaveAttribute('data-save-state', 'error');
  const readStored = () => page.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const open = indexedDB.open('cineserye-local');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('documents', 'readonly');
      const get = tx.objectStore('documents').get('current');
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
      tx.oncomplete = () => db.close();
    };
  }));
  expect(await readStored()).toEqual(unreadable);
  if (recovery === 'backup') {
    await page.getByRole('button', { name: 'Project backup and restore' }).click();
    const input = page.getByLabel('Choose a Cineserye project backup');
    await input.setInputFiles({ name: 'invalid.cineserye', mimeType: 'application/json', buffer: Buffer.from('{"format":"invalid"}') });
    await expect(page.getByText('This is not a supported Cineserye project backup.')).toBeVisible();
    expect(await readStored()).toEqual(unreadable);
    await input.setInputFiles(backupPath!);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.waitForTimeout(600);
    expect(await readStored()).toEqual(unreadable);
    await expect(page.locator('main')).toHaveAttribute('data-save-state', 'error');
    await input.setInputFiles(backupPath!);
    await confirmCineseryeDialog(page, 'Restore backup');
  } else {
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await confirmCineseryeDialog(page, 'Start new document');
  }
  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toHaveAttribute('data-save-state', 'saved');
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  expect(posts).toEqual([]);
});
}
