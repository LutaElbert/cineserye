import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { installStorageHarness } from './storage-harness';
import { confirmCineseryeDialog, waitForSaved } from './helpers';
const execute = promisify(execFile);

test('synthetic local takes preview, render, decode and download; empty-store backup cannot restore their bytes', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(120000);
  const inputPath = info.outputPath('synthetic-silent-input.mp4');
  await mkdir(dirname(inputPath), { recursive: true });
  // Required native renderer proof, not a provider call or capability-based skip.
  await execute('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=24', '-t', '4', '-an',
    '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', inputPath]);
  let generations = 0, renders = 0;
  page.on('request', request => {
    if (request.method() !== 'POST' || !request.url().includes('/api/cinema/')) return;
    if (new URL(request.url()).pathname === '/api/cinema/assemble') renders++; else generations++;
  });
  await page.goto('/'); await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Explore the sample/ }).click();
  await waitForSaved(page);
  await installStorageHarness(page);
  await page.route('**/synthetic-cut-seed', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Synthetic local cut fixture</title>' }));
  await page.goto('/synthetic-cut-seed'); // Unmount autosave before seeding the isolated test store.
  const shotCount = await page.evaluate(async base64 => {
    const path = '/__test-modules/persistence.js';
    const storage = await import(path) as typeof import('../app/editor/persistence');
    const document = (await storage.loadLocalDocument())!;
    const cinema = document.cinema!;
    const pixels = window.document.createElement('canvas'); pixels.width = 160; pixels.height = 90;
    pixels.getContext('2d')!.fillRect(0, 0, 160, 90);
    const png = await new Promise<Blob>(resolve => pixels.toBlob(blob => resolve(blob!), 'image/png'));
    const image = await storage.saveLocalMediaBlob(png, { mimeType: 'image/png', width: 160, height: 90 });
    const bytes = Uint8Array.from(atob(base64), value => value.charCodeAt(0));
    const video = await storage.saveLocalMediaBlob(new Blob([bytes], { type: 'video/mp4' }), { mimeType: 'video/mp4', width: 160, height: 90 });
    const visual: import('../app/domain/cinema/visual-preproduction').CinemaVisualPreproductionData = {
      version: 1, references: {}, storyboardRuns: {}, storyboardFrames: {}, videoOperations: {}, videoClips: {},
    };
    const now = new Date().toISOString();
    const shots = cinema.sceneOrder.flatMap(id => cinema.scenes[id].shotIds.map(id => cinema.shots[id]));
    for (const shot of shots) {
      shot.durationSeconds = 1;
      const revision = Object.values(cinema.revisions).find(item => item.status === 'active' && item.snapshot.shots[shot.id])!;
      revision.snapshot.shots[shot.id].durationSeconds = 1;
      const imagePrompt = Object.values(cinema.prompts).find(item => item.ownerNodeId === shot.nodeId && item.purpose === 'storyboard')!;
      const motionPrompt = Object.values(cinema.prompts).find(item => item.ownerNodeId === shot.nodeId && item.purpose === 'video')!;
      const runId = `synthetic-image-${shot.id}`, frameId = `synthetic-frame-${shot.id}`, operationId = `synthetic-video-${shot.id}`;
      visual.storyboardRuns[runId] = { id: runId, shotId: shot.id, revisionId: revision.id, promptId: imagePrompt.id,
        promptVersion: imagePrompt.version, referenceIds: [], provider: 'synthetic-local-test', model: 'canvas-test', aspectRatio: '16:9',
        outputCount: 1, intent: 'balanced', estimatedCost: 0, currency: 'USD', status: 'completed', consentedAt: now, startedAt: now, completedAt: now, error: null };
      visual.storyboardFrames[frameId] = { id: frameId, runId, shotId: shot.id, revisionId: revision.id, promptId: imagePrompt.id,
        promptVersion: imagePrompt.version, promptText: imagePrompt.generatedText, referenceIds: [], provider: 'synthetic-local-test', model: 'canvas-test',
        aspectRatio: '16:9', seed: null, variantIndex: 0, intent: 'balanced', blobHash: image.hash, mimeType: 'image/png', width: 160, height: 90,
        byteSize: png.size, safetyStatus: 'passed', status: 'approved', estimatedCost: 0, currency: 'USD', createdAt: now };
      const settings = { aspectRatio: '16:9', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null } as const;
      visual.videoOperations[operationId] = { id: operationId, shotId: shot.id, revisionId: revision.id, promptId: motionPrompt.id,
        promptVersion: motionPrompt.version, promptText: motionPrompt.generatedText, negativeConstraints: [], startFrameId: frameId, startFrameApproval: 'approved',
        endFrameId: null, endFrameApproval: null, referenceIds: [], provider: 'synthetic-local-test', model: 'ffmpeg-test', capabilityProfileVersion: 'synthetic-1',
        settings, estimatedCost: 0, currency: 'USD', providerOperationId: null, status: 'ready', retryOf: null, consentedAt: now, startedAt: now, completedAt: now, error: null };
      const clipId = `synthetic-clip-${shot.id}`;
      visual.videoClips[clipId] = { id: clipId, operationId, shotId: shot.id, revisionId: revision.id, promptId: motionPrompt.id,
        promptVersion: motionPrompt.version, startFrameId: frameId, endFrameId: null, referenceIds: [], provider: 'synthetic-local-test', model: 'ffmpeg-test',
        capabilityProfileVersion: 'synthetic-1', settings, blobHash: video.hash, mimeType: 'video/mp4', width: 160, height: 90, byteSize: bytes.length,
        durationSeconds: 4, status: 'approved', estimatedCost: 0, currency: 'USD', createdAt: now };
    }
    cinema.visualPreproduction = visual;
    await storage.saveLocalDocument(document);
    return shots.length;
  }, Buffer.from(await readFile(inputPath)).toString('base64'));
  expect(shotCount).toBeGreaterThan(0);
  await page.goto('/?flow=simplified&workspace=edit');
  const cut = page.getByRole('region', { name: 'Review sequence', exact: true });
  await expect(cut).toContainText('Decoded clip: 4.00s');
  await cut.getByLabel('Output aspect').selectOption('16:9');
  await cut.getByRole('button', { name: 'Play from selected shot' }).click();
  await expect.poll(() => cut.locator('.sequence-review-preview video').evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0);
  await cut.getByRole('button', { name: 'Pause sequence' }).click();
  await cut.getByRole('button', { name: 'Render silent MP4 locally' }).click();
  const output = cut.getByRole('link', { name: 'Download verified MP4' });
  await expect(output).toBeVisible({ timeout: 60000 });
  await expect(cut.getByLabel('Rendered silent sequence')).toHaveAttribute('preload', 'metadata');
  await expect.poll(() => cut.getByLabel('Rendered silent sequence').evaluate(element => (element as HTMLVideoElement).duration)).toBeCloseTo(shotCount, 1);
  const movieDownload = page.waitForEvent('download'); await output.click(); const movie = await movieDownload;
  const moviePath = (await movie.path())!;
  await execute('ffmpeg', ['-v', 'error', '-i', moviePath, '-f', 'null', '-']);
  const { stdout } = await execute('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', moviePath]);
  const decoded = JSON.parse(stdout);
  expect(decoded.streams).toHaveLength(1);
  expect(decoded.streams[0]).toMatchObject({ codec_type: 'video', width: 1280, height: 720, r_frame_rate: '24/1' });
  expect(Number(decoded.format.duration)).toBeCloseTo(shotCount, 1);
  await info.attach('downloaded-cut-probe', { body: stdout, contentType: 'application/json' });
  await page.screenshot({ path: info.outputPath('verified-cut.png') });
  await waitForSaved(page); await page.getByRole('button', { name: 'Project backup and restore' }).click();
  const backupDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download backup' }).click();
  const backup = await backupDownload, backupPath = (await backup.path())!;
  const envelope = JSON.parse(await readFile(backupPath, 'utf8'));
  expect(envelope.media.length).toBeGreaterThan(0);
  expect(envelope.media.every((item: { mimeType: string }) => item.mimeType.startsWith('image/'))).toBe(true);
  const context = await browser.newContext({ baseURL }); const restored = await context.newPage(); let posts = 0;
  try {
    restored.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts++; });
    await restored.goto('/'); await expect(restored.locator('main[data-ready="true"]')).toBeVisible();
    await restored.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Explore the sample/ }).click();
    await restored.getByRole('button', { name: 'Project backup and restore' }).click();
    await restored.getByLabel('Choose a Cineserye project backup').setInputFiles(backupPath);
    await confirmCineseryeDialog(restored, 'Restore backup');
    await expect(restored.getByText(/Project backup restored/)).toBeVisible();
    await waitForSaved(restored); await restored.goto('/?flow=simplified&workspace=edit');
    const review = restored.getByRole('region', { name: 'Review sequence', exact: true });
    await expect(review.getByText(/Clip bytes are missing in this browser/)).toHaveCount(shotCount);
    await expect(review.getByRole('button', { name: 'Render silent MP4 locally' })).toBeDisabled();
    await expect(review.getByRole('link', { name: 'Download verified MP4' })).toHaveCount(0);
    expect(posts).toBe(0);
  } finally { await context.close(); }
  expect(generations).toBe(0); expect(renders).toBe(1);
});

test('decoded short footage is visible before render and clears only after a valid trim', async ({ page }, info) => {
  const inputPath = info.outputPath('synthetic-short-input.mp4');
  await mkdir(dirname(inputPath), { recursive: true });
  await execute('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=24', '-t', '1', '-an',
    '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', inputPath]);
  await page.goto('/'); await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Explore the sample/ }).click();
  await waitForSaved(page); await installStorageHarness(page);
  await page.route('**/short-cut-seed', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Short local cut fixture</title>' }));
  await page.goto('/short-cut-seed');
  const seeded = await page.evaluate(async base64 => {
    const modulePath = '/__test-modules/persistence.js';
    const storage = await import(modulePath) as typeof import('../app/editor/persistence');
    const document = (await storage.loadLocalDocument())!, cinema = document.cinema!;
    const shot = cinema.shots[cinema.scenes[cinema.sceneOrder[0]].shotIds[0]];
    const revision = Object.values(cinema.revisions).find(item => item.status === 'active' && item.snapshot.shots[shot.id])!;
    shot.durationSeconds = 2;
    revision.snapshot.shots[shot.id].durationSeconds = 2;
    const imagePrompt = Object.values(cinema.prompts).find(item => item.ownerNodeId === shot.nodeId && item.purpose === 'storyboard')!;
    const motionPrompt = Object.values(cinema.prompts).find(item => item.ownerNodeId === shot.nodeId && item.purpose === 'video')!;
    const canvas = window.document.createElement('canvas'); canvas.width = 160; canvas.height = 90;
    const png = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
    const image = await storage.saveLocalMediaBlob(png, { mimeType: 'image/png', width: 160, height: 90 });
    const bytes = Uint8Array.from(atob(base64), value => value.charCodeAt(0));
    const video = await storage.saveLocalMediaBlob(new Blob([bytes], { type: 'video/mp4' }), { mimeType: 'video/mp4', width: 160, height: 90 });
    const now = new Date().toISOString(), frameId = 'short-frame', operationId = 'short-operation', clipId = 'short-clip';
    const visual = cinema.visualPreproduction!;
    visual.storyboardRuns['short-run'] = { id: 'short-run', shotId: shot.id, revisionId: revision.id, promptId: imagePrompt.id,
      promptVersion: imagePrompt.version, referenceIds: [], provider: 'synthetic-local-test', model: 'canvas-test', aspectRatio: '16:9',
      outputCount: 1, intent: 'balanced', estimatedCost: 0, currency: 'USD', status: 'completed', consentedAt: now, startedAt: now, completedAt: now, error: null };
    visual.storyboardFrames[frameId] = { id: frameId, runId: 'short-run', shotId: shot.id, revisionId: revision.id, promptId: imagePrompt.id,
      promptVersion: imagePrompt.version, promptText: imagePrompt.generatedText, referenceIds: [], provider: 'synthetic-local-test', model: 'canvas-test',
      aspectRatio: '16:9', seed: null, variantIndex: 0, intent: 'balanced', blobHash: image.hash, mimeType: 'image/png', width: 160, height: 90,
      byteSize: png.size, safetyStatus: 'passed', status: 'approved', estimatedCost: 0, currency: 'USD', createdAt: now };
    const settings = { aspectRatio: '16:9', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null } as const;
    visual.videoOperations[operationId] = { id: operationId, shotId: shot.id, revisionId: revision.id, promptId: motionPrompt.id,
      promptVersion: motionPrompt.version, promptText: motionPrompt.generatedText, negativeConstraints: [], startFrameId: frameId, startFrameApproval: 'approved',
      endFrameId: null, endFrameApproval: null, referenceIds: [], provider: 'synthetic-local-test', model: 'ffmpeg-test', capabilityProfileVersion: 'synthetic-1',
      settings, estimatedCost: 0, currency: 'USD', providerOperationId: null, status: 'ready', retryOf: null, consentedAt: now, startedAt: now, completedAt: now, error: null };
    visual.videoClips[clipId] = { id: clipId, operationId, shotId: shot.id, revisionId: revision.id, promptId: motionPrompt.id,
      promptVersion: motionPrompt.version, startFrameId: frameId, endFrameId: null, referenceIds: [], provider: 'synthetic-local-test', model: 'ffmpeg-test',
      capabilityProfileVersion: 'synthetic-1', settings, blobHash: video.hash, mimeType: 'video/mp4', width: 160, height: 90, byteSize: bytes.length,
      durationSeconds: 4, status: 'approved', estimatedCost: 0, currency: 'USD', createdAt: now };
    await storage.saveLocalDocument(document); return { title: shot.title, clipId };
  }, Buffer.from(await readFile(inputPath)).toString('base64'));
  await page.goto('/?flow=simplified&workspace=edit');
  const cut = page.getByRole('region', { name: 'Review sequence', exact: true });
  await expect(cut).toContainText('Decoded clip: 1.00s');
  await expect(cut.getByText(/Decoded clip is 1.00s; the selected 0.00s start and 2.00s use exceed/)).toBeVisible();
  await expect(cut.getByLabel('Sequence status and export')).toContainText(`${seeded.title} needs attention`);
  await expect(cut.getByRole('button', { name: 'Render silent MP4 locally' })).toBeDisabled();
  await cut.getByLabel('Use (s)').first().fill('1');
  await expect(cut.getByText(/Decoded clip is 1.00s/)).toHaveCount(0);
  await expect(cut.getByLabel('Sequence status and export')).toContainText('1.00s used');
  await waitForSaved(page); await page.goto('/short-cut-seed');
  await page.evaluate(async clipId => {
    const modulePath = '/__test-modules/persistence.js';
    const storage = await import(modulePath) as typeof import('../app/editor/persistence');
    const document = (await storage.loadLocalDocument())!;
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const invalid = await storage.saveLocalMediaBlob(new Blob([bytes], { type: 'video/mp4' }), { mimeType: 'video/mp4', width: 160, height: 90 });
    const clip = document.cinema!.visualPreproduction!.videoClips[clipId];
    clip.blobHash = invalid.hash; clip.byteSize = bytes.length;
    await storage.saveLocalDocument(document);
  }, seeded.clipId);
  await page.goto('/?flow=simplified&workspace=edit');
  await expect(cut.getByText('This shot has no usable local preview. Review its timeline warning.')).toBeVisible();
  await expect(cut.locator('.sequence-review-preview video')).toHaveCount(0);
  await expect(cut.getByText(/Local clip metadata could not be decoded/)).toBeVisible();
  await expect(cut.getByRole('button', { name: 'Render silent MP4 locally' })).toBeDisabled();
});
