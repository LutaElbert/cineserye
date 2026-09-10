import { expect, test, type Page } from '@playwright/test';
import { installStorageHarness } from './storage-harness';

// Real browser/IndexedDB and production modules, with no mounted editor autosave
// or provider UI. Bundled source is served only by the Playwright harness.
async function storageContext(page: Page) {
  await installStorageHarness(page);
  await page.route('**/story-data-test', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Storage integration</title>' }));
  await page.goto('/story-data-test');
}

test('story data and historical images survive save, checkpoint and portable restore; missing media is atomic', async ({ page }) => {
  await storageContext(page);
  const result = await page.evaluate(async () => {
    const storagePath = '/__test-modules/persistence.js'; const domainPath = '/__test-modules/project-data.js';
    const documentPath = '/__test-modules/initial-document.js'; const backupPath = '/__test-modules/document-file.js';
    const storage = await import(storagePath) as typeof import('../app/editor/persistence');
    const domain = await import(domainPath) as typeof import('../app/domain/cinema/project-data');
    const { initialDocument } = await import(documentPath) as typeof import('../app/editor/initial-document');
    const backup = await import(backupPath) as typeof import('../app/editor/document-file');
    const doc = structuredClone(initialDocument); doc.cinema = domain.createEmptyCinemaProjectData('story-test');
    await storage.saveLocalDocument(doc);
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), 'image/png'));
    const media = await storage.saveLocalMediaBlob(blob, { mimeType: 'image/png', width: 1, height: 1 });
    const saved = await storage.commitLocalStoryWorkflow('story-test', 0, (draft) => {
      draft.references = [{ id: 'image', versions: [{ version: 1, title: 'Reference', category: 'style', provenance: 'Local image',
        content: { kind: 'image', blobHash: media.hash, mimeType: 'image/png', width: 1, height: 1, byteSize: blob.size },
        rights: 'unknown', approval: 'pending', allowedUses: ['research'], archived: false }] }];
      draft.bindings = [{ owner: { kind: 'story', id: 'story-test' }, rules: [{ action: 'add', referenceId: 'image' }] }];
      draft.draft = { mode: 'expand', premise: 'A small cinema.', answers: [], anchorSceneId: null, durationSeconds: null,
        aspectRatio: null, tone: '', ending: '', constraints: [] };
    });
    let missingError = '';
    try {
      await storage.commitLocalStoryWorkflow('story-test', 1, (draft) => {
        const previous = draft.references[0].versions[0];
        if (previous.content.kind !== 'image') throw Error('Expected image');
        draft.references[0].versions.push({ ...previous, version: 2, content: { ...previous.content, blobHash: 'b'.repeat(64) } });
      });
    } catch (error) { missingError = (error as Error).message; }
    const loaded = await storage.loadLocalDocument();
    const source = await backup.serializeProjectBackupWithMedia(saved, [media]);
    const restored = await backup.parseProjectBackupWithMedia(source);
    await storage.createLocalCheckpoint(saved);
    const checkpoint = (await storage.listLocalCheckpoints())[0];
    return { missingError, saved: saved.cinema!.storyWorkflow, loaded: loaded!.cinema!.storyWorkflow,
      restored: restored.document.cinema!.storyWorkflow, checkpoint: checkpoint.document.cinema!.storyWorkflow,
      mediaCount: restored.media.length, mediaHash: restored.media[0].hash, hash: media.hash };
  });
  expect(result.missingError).toContain('missing');
  expect(result.loaded).toEqual(result.saved); expect(result.restored).toEqual(result.saved);
  expect(result.checkpoint).toEqual(result.saved); expect(result.mediaCount).toBe(1); expect(result.mediaHash).toBe(result.hash);
});

test('two-tab story compare-and-swap accepts one writer and rejects the stale writer', async ({ page, context }) => {
  await storageContext(page);
  await page.evaluate(async () => {
    const storagePath = '/__test-modules/persistence.js'; const domainPath = '/__test-modules/project-data.js'; const docPath = '/__test-modules/initial-document.js';
    const storage = await import(storagePath) as typeof import('../app/editor/persistence');
    const domain = await import(domainPath) as typeof import('../app/domain/cinema/project-data');
    const { initialDocument } = await import(docPath) as typeof import('../app/editor/initial-document');
    await storage.saveLocalDocument({ ...initialDocument, cinema: domain.createEmptyCinemaProjectData('two-tab-story') });
  });
  const other = await context.newPage(); await storageContext(other);
  const submit = (target: Page, title: string) => target.evaluate(async (title) => {
    const path = '/__test-modules/persistence.js';
    const storage = await import(path) as typeof import('../app/editor/persistence');
    try {
      await storage.commitLocalStoryWorkflow('two-tab-story', 0, (draft) => {
        draft.references.push({ id: title, versions: [{ version: 1, title, category: 'other', provenance: 'Authored note',
          content: { kind: 'note', text: title }, rights: 'creator-owned', approval: 'pending', allowedUses: [], archived: false }] });
      });
      return 'saved';
    } catch (error) { return (error as Error).message; }
  }, title);
  const outcomes = await Promise.all([submit(page, 'first'), submit(other, 'second')]);
  expect(outcomes.filter((value) => value === 'saved')).toHaveLength(1);
  expect(outcomes.find((value) => value !== 'saved')).toContain('changed');
  const saved = await page.evaluate(async () => {
    const path = '/__test-modules/persistence.js';
    return (await (await import(path) as typeof import('../app/editor/persistence')).loadLocalDocument())!.cinema!.storyWorkflow!;
  });
  expect(saved.revision).toBe(1); expect(saved.references).toHaveLength(1);
});
