import { expect, test, type Page } from '@playwright/test';
import { confirmCineseryeDialog, openEditor, waitForSaved } from './helpers';
import { installStorageHarness } from './storage-harness';

async function backup(page: Page, title: string) {
  return page.evaluate(async title => {
    const persistencePath = '/__test-modules/persistence.js', filePath = '/__test-modules/document-file.js';
    const p = await import(/* @vite-ignore */ persistencePath) as typeof import('../app/editor/persistence');
    const f = await import(/* @vite-ignore */ filePath) as typeof import('../app/editor/document-file');
    return f.serializeProjectBackup({ ...(await p.loadLocalDocument())!, title });
  }, title);
}
test('failed portable replacement preserves current UI and durable project', async ({ page }) => {
  await installStorageHarness(page); await openEditor(page); await waitForSaved(page);
  const original = await page.getByRole('textbox', { name: /Document title/ }).inputValue();
  const body = await backup(page, 'Rejected replacement');
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, key) {
      if (this.name === 'documents' && value.title === 'Rejected replacement') throw new DOMException('Injected replacement quota failure', 'QuotaExceededError');
      return key === undefined ? put.call(this, value) : put.call(this, value, key);
    };
  });
  await page.getByRole('button', { name: 'Project backup and restore' }).click();
  await page.getByLabel('Choose a Cineserye project backup').setInputFiles({ name: 'rejected.cineserye', mimeType: 'application/json', buffer: Buffer.from(body) });
  await confirmCineseryeDialog(page, 'Restore backup');
  await expect(page.getByText('Injected replacement quota failure', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Document title/ })).toHaveValue(original);
  await expect(page.locator('main')).toHaveAttribute('data-save-state', 'error');
  await page.reload(); await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Document title/ })).toHaveValue(original);
});

test('late portable parsing cannot overwrite edits made before confirmation', async ({ page }) => {
  await installStorageHarness(page); await openEditor(page); await waitForSaved(page);
  const body = await backup(page, 'Late replacement');
  await page.evaluate(() => {
    const read = File.prototype.text;
    File.prototype.text = async function() {
      if (this.name === 'delayed.cineserye') await new Promise<void>(resolve => { Object.assign(window, { releaseBackupRead: resolve }); });
      return read.call(this);
    };
  });
  await page.getByRole('button', { name: 'Project backup and restore' }).click();
  await page.getByLabel('Choose a Cineserye project backup').setInputFiles({ name: 'delayed.cineserye', mimeType: 'application/json', buffer: Buffer.from(body) });
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { releaseBackupRead?: () => void }).releaseBackupRead)).toBe('function');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('textbox', { name: /Document title/ }).fill('Newer project edits');
  await page.evaluate(() => (window as unknown as { releaseBackupRead: () => void }).releaseBackupRead());
  await confirmCineseryeDialog(page, 'Restore backup');
  await expect(page.getByText('The project changed. Review the current project before replacing it.', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Document title/ })).toHaveValue('Newer project edits');
  await waitForSaved(page); await page.reload();
  await expect(page.getByRole('textbox', { name: /Document title/ })).toHaveValue('Newer project edits');
});

test('replacement transaction rolls back document and images after a synchronous media write failure', async ({ page }) => {
  await installStorageHarness(page); await openEditor(page); await waitForSaved(page);
  const result = await page.evaluate(async () => {
    const path = '/__test-modules/persistence.js';
    const p = await import(/* @vite-ignore */ path) as typeof import('../app/editor/persistence');
    const before = (await p.loadLocalDocument())!;
    const mediaBefore = (await p.listLocalMediaBlobs()).map(m => m.hash);
    const blob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'], { type: 'image/svg+xml' });
    const entry = { blob, hash: await p.sha256Blob(blob), byteSize: blob.size, mimeType: blob.type, width: 1, height: 1 };
    const put = IDBObjectStore.prototype.put; let error = '';
    IDBObjectStore.prototype.put = function(value, key) {
      if (this.name === 'media-blobs') throw new DOMException('Injected media write failure', 'QuotaExceededError');
      return key === undefined ? put.call(this, value) : put.call(this, value, key);
    };
    try { await p.replaceLocalDocument({ ...before, title: 'Must roll back' }, { media: [entry], assertCurrent: () => {} }); }
    catch (failure) { error = (failure as Error).message; }
    finally { IDBObjectStore.prototype.put = put; }
    return { error, title: (await p.loadLocalDocument())?.title, before: before.title,
      mediaBefore, mediaAfter: (await p.listLocalMediaBlobs()).map(m => m.hash) };
  });
  expect(result.error).toBe('Injected media write failure'); expect(result.title).toBe(result.before);
  expect(result.mediaAfter).toEqual(result.mediaBefore);
});

test('ordinary save rechecks admission after opening storage and before writing', async ({ page }) => {
  await installStorageHarness(page); await openEditor(page); await waitForSaved(page);
  const result = await page.evaluate(async () => {
    const path = '/__test-modules/persistence.js';
    const p = await import(/* @vite-ignore */ path) as typeof import('../app/editor/persistence');
    const before = (await p.loadLocalDocument())!; let checks = 0, error = '';
    try { await p.saveLocalDocument({ ...before, title: 'Detached editor write' }, () => { checks++; throw Error('Writer detached'); }); }
    catch (failure) { error = (failure as Error).message; }
    return { checks, error, before: before.title, after: (await p.loadLocalDocument())?.title };
  });
  expect(result).toMatchObject({ checks: 1, error: 'Writer detached', after: result.before });
});
