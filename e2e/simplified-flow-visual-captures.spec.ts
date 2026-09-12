import { expect, test, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { WorkflowCapabilitiesSchema } from '../app/features/story-development/workflow-capabilities';
import type { CinemaVisualPreproductionData } from '../app/domain/cinema/visual-preproduction';
import { waitForSaved } from './helpers';
import { installStorageHarness } from './storage-harness';

const execute = promisify(execFile);
const outputRoot = process.env.CINESERYE_VISUAL_OUTPUT ?? (() => { throw Error('CINESERYE_VISUAL_OUTPUT is required.'); })();

async function begin(page: Page, sample: boolean) {
  await page.goto('/?flow=simplified&stage=idea');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const chooser = page.getByRole('dialog', { name: /Start with your scene/ });
  await chooser.getByRole('button', { name: sample ? /Explore.*sample/i : /Start with an idea/ }).click();
  await expect(page.getByRole('navigation', { name: 'Filmmaking workspaces' })).toBeVisible();
}

async function stage(page: Page, name: string) {
  const workspaceName = ({ Idea: 'Story', Plan: 'Story', References: 'Shots', Video: 'Shots', 'Final Cut': 'Edit' } as Record<string, string>)[name];
  const workspace = page.getByRole('navigation', { name: 'Filmmaking workspaces' }).getByRole('button', { name: workspaceName, exact: true });
  if (await workspace.getAttribute('aria-current') !== 'page') await workspace.click();
  const button = page.getByRole('navigation', { name: `${workspaceName} stages` }).getByRole('button', { name, exact: true });
  if (await button.getAttribute('aria-current') !== 'step') await button.click();
  await expect(button).toHaveAttribute('aria-current', 'step');
}

async function capture(page: Page, name: string) {
  await mkdir(outputRoot, { recursive: true });
  await page.screenshot({ path: join(outputRoot, `${name}.png`), fullPage: true });
}

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); });

test('captures all five stages', async ({ page }) => {
  await begin(page, true); await waitForSaved(page);
  for (const [name, file] of [['Idea', '01-idea'], ['Plan', '02-plan'], ['References', '03-references'], ['Video', '04-video'], ['Final Cut', '05-final-cut']] as const) {
    await stage(page, name); await capture(page, file);
  }
  await page.getByRole('button', { name: 'Workspace status', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Workspace status', exact: true })).toBeVisible();
  await capture(page, '09-workspace-status');
});

test('captures expanded Story Assistant review', async ({ page }) => {
  await begin(page, false);
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  await editor.getByRole('textbox', { name: 'Layer title', exact: true }).fill('The Cursed Game');
  await editor.getByRole('textbox', { name: 'Premise for development', exact: true }).fill(
    'Four friends discover a cursed board game. A 60-second vertical horror mystery, no dialogue. All four survive.',
  );
  await editor.getByRole('button', { name: 'Generate', exact: true }).click();
  const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await assistant.getByRole('button', { name: 'Draft scene outline', exact: true }).click();
  await expect(assistant.locator('.assistant-scene-row')).toHaveCount(3);
  const premise = page.locator('.react-flow__node').filter({ has: page.locator('[data-domain-type="cinema.story"]') });
  const premiseBox = await premise.boundingBox(), assistantBox = await assistant.boundingBox();
  expect(premiseBox).not.toBeNull(); expect(assistantBox).not.toBeNull();
  expect(premiseBox!.x).toBeGreaterThanOrEqual(0);
  expect(premiseBox!.x + premiseBox!.width).toBeLessThanOrEqual(assistantBox!.x);
  expect(assistantBox!.x + assistantBox!.width).toBeLessThanOrEqual(1440);
  await capture(page, '10-story-assistant-review');
});

for (const viewport of [{ width: 786, height: 559 }, { width: 877, height: 559 }, { width: 390, height: 844 }]) {
  test(`captures readable simplified Story review at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport); await begin(page, false);
    const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
    await editor.getByRole('textbox', { name: 'Premise for development', exact: true }).fill(
      'A projectionist discovers tomorrow’s memories on an abandoned cinema screen. A 30-second 16:9 mystery with no dialogue.',
    );
    await editor.getByRole('button', { name: 'Generate', exact: true }).click();
    const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
    await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
    await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
    await assistant.getByRole('button', { name: 'Draft scene outline', exact: true }).click();
    await expect(assistant.locator('.assistant-scene-row')).toHaveCount(3);
    await expect(page.getByRole('region', { name: 'Current filmmaking step' })).toContainText('Scene proposals are ready');
    const geometry = await assistant.evaluate((element) => {
      const zoom = new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')!).transform).a;
      const box = element.getBoundingClientRect();
      return { zoom, width: box.width, height: box.height, effectiveFont: parseFloat(getComputedStyle(element).fontSize) * zoom };
    });
    expect(geometry.zoom).toBeGreaterThanOrEqual(viewport.width === 390 ? .75 : .9);
    expect(geometry.effectiveFont).toBeGreaterThanOrEqual(viewport.width === 390 ? 10 : 12);
    const proposals = assistant.locator('.assistant-scene-row');
    for (let index = 0; index < await proposals.count(); index++) {
      const synopsis = proposals.nth(index).locator('.assistant-scene-row-copy p');
      await expect(synopsis).not.toHaveText('');
      await synopsis.scrollIntoViewIfNeeded();
      await expect(synopsis).toBeInViewport();
    }
    await expect(assistant.getByRole('button', { name: 'Add 3 scenes', exact: true })).toBeInViewport();
    await capture(page, `13-story-review-${viewport.width}x${viewport.height}`);
  });
}

for (const viewport of [{ width: 786, height: 559 }, { width: 877, height: 559 }, { width: 390, height: 844 }]) {
  test(`captures usable simplified Shot candidate review at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport); await begin(page, true); await waitForSaved(page); await stage(page, 'References');
    await page.getByRole('region', { name: 'Current filmmaking step' }).getByRole('button', { name: /Review references for Entering the Auditorium/ }).click();
    const editor = page.getByRole('region', { name: 'Shot layer editor', exact: true });
    await editor.getByRole('checkbox', { name: /I confirm the .* direction/ }).check();
    await editor.getByRole('button', { name: 'Generate storyboard', exact: true }).click();
    await expect(editor.locator('.storyboard-frame')).toHaveCount(3);
    const geometry = await editor.evaluate((element) => {
      const body = element.querySelector<HTMLElement>('.layer-editor-content')!;
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height, bodyHeight: body.clientHeight, bodyScrollHeight: body.scrollHeight };
    });
    expect(geometry.width).toBeGreaterThanOrEqual(viewport.width === 390 ? 340 : 650);
    expect(geometry.bodyHeight).toBeGreaterThanOrEqual(180);
    const approve = editor.getByRole('button', { name: 'Approve', exact: true }).first();
    await approve.scrollIntoViewIfNeeded();
    await expect(approve).toBeInViewport();
    await approve.click();
    await expect(editor.getByRole('button', { name: 'Approved anchor', exact: true })).toBeVisible();
    await capture(page, `14-shot-review-${viewport.width}x${viewport.height}`);
  });
}

test('captures full-width mobile Edit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await begin(page, true); await stage(page, 'Final Cut');
  await expect(page.getByRole('region', { name: 'Review sequence', exact: true })).toBeVisible();
  const topbarBox = await page.locator('.topbar').boundingBox(), canvasBox = await page.locator('#canvas-workspace').boundingBox();
  expect(topbarBox).not.toBeNull(); expect(canvasBox).not.toBeNull();
  expect(topbarBox!.width).toBeGreaterThanOrEqual(388);
  expect(canvasBox!.width).toBeGreaterThanOrEqual(388);
  await capture(page, '11-mobile-final-cut');
});

test('captures the honest empty state', async ({ page }) => {
  await begin(page, false); await waitForSaved(page);
  await expect(page.getByRole('region', { name: 'Current filmmaking step' })).toContainText('Start with your idea');
  await capture(page, '06-empty-idea');
});

test('captures a blocked reference capability', async ({ page }) => {
  await page.route('**/api/cinema/workflow-capabilities', async route => {
    const response = await route.fetch({ headers: { ...route.request().headers(), 'accept-encoding': 'identity' } });
    const value = WorkflowCapabilitiesSchema.parse(await response.json());
    value.stages.images = { ...value.stages.images, status: 'blocked', ready: false,
      blockers: ['Workspace policy blocks image generation for this review.'] };
    await route.fulfill({ json: WorkflowCapabilitiesSchema.parse(value) });
  });
  await begin(page, true); await waitForSaved(page); await stage(page, 'References');
  await expect(page.getByRole('region', { name: 'Current filmmaking step' })).toContainText('Generation is blocked');
  await capture(page, '07-blocked-references');
});

test('captures partial approved takes without provider work', async ({ page }, info) => {
  test.setTimeout(120_000);
  const inputPath = info.outputPath('partial-take.mp4');
  await mkdir(dirname(inputPath), { recursive: true });
  await execute('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=24', '-t', '1', '-an',
    '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', inputPath]);
  await begin(page, true); await waitForSaved(page);
  await installStorageHarness(page);
  await page.route('**/visual-seed', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Visual fixture</title>' }));
  await page.goto('/visual-seed');
  await page.evaluate(async base64 => {
    const modulePath = '/__test-modules/persistence.js';
    const storage = await import(modulePath) as typeof import('../app/editor/persistence');
    const document = (await storage.loadLocalDocument())!, cinema = document.cinema!;
    const canvas = window.document.createElement('canvas'); canvas.width = 160; canvas.height = 90;
    canvas.getContext('2d')!.fillStyle = '#625bf6'; canvas.getContext('2d')!.fillRect(0, 0, 160, 90);
    const png = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
    const image = await storage.saveLocalMediaBlob(png, { mimeType: 'image/png', width: 160, height: 90 });
    const bytes = Uint8Array.from(atob(base64), value => value.charCodeAt(0));
    const video = await storage.saveLocalMediaBlob(new Blob([bytes], { type: 'video/mp4' }), { mimeType: 'video/mp4', width: 160, height: 90 });
    const now = new Date().toISOString();
    const visual: CinemaVisualPreproductionData = { version: 1, references: {}, storyboardRuns: {}, storyboardFrames: {}, videoOperations: {}, videoClips: {} };
    const shots = cinema.sceneOrder.flatMap(sceneId => cinema.scenes[sceneId].shotIds.map(shotId => cinema.shots[shotId]));
    shots.forEach((shot, index) => {
      const revision = Object.values(cinema.revisions).find(item => item.status === 'active' && item.snapshot.shots[shot.id])!;
      const imagePrompt = Object.values(cinema.prompts).find(item => item.ownerNodeId === shot.nodeId && item.purpose === 'storyboard')!;
      const frameId = `visual-frame-${shot.id}`, runId = `visual-image-${shot.id}`;
      visual.storyboardRuns[runId] = { id: runId, shotId: shot.id, revisionId: revision.id, promptId: imagePrompt.id,
        promptVersion: imagePrompt.version, referenceIds: [], provider: 'synthetic-local-test', model: 'canvas-test', aspectRatio: '16:9', outputCount: 1,
        intent: 'balanced', estimatedCost: 0, currency: 'USD', status: 'completed', consentedAt: now, startedAt: now, completedAt: now, error: null };
      visual.storyboardFrames[frameId] = { id: frameId, runId, shotId: shot.id, revisionId: revision.id, promptId: imagePrompt.id,
        promptVersion: imagePrompt.version, promptText: imagePrompt.generatedText, referenceIds: [], provider: 'synthetic-local-test', model: 'canvas-test',
        aspectRatio: '16:9', seed: null, variantIndex: 0, intent: 'balanced', blobHash: image.hash, mimeType: 'image/png', width: 160,
        height: 90, byteSize: png.size, safetyStatus: 'passed', status: 'approved', estimatedCost: 0, currency: 'USD', createdAt: now };
      if (index !== 0) return;
      const prompt = Object.values(cinema.prompts).find(item => item.ownerNodeId === shot.nodeId && item.purpose === 'video')!;
      const operationId = `visual-video-${shot.id}`;
      const settings = { aspectRatio: '16:9', durationSeconds: 4, resolution: '720p', audio: false, outputCount: 1, seed: null } as const;
      visual.videoOperations[operationId] = { id: operationId, shotId: shot.id, revisionId: revision.id, promptId: prompt.id,
        promptVersion: prompt.version, promptText: prompt.generatedText, negativeConstraints: [], startFrameId: frameId, startFrameApproval: 'approved',
        endFrameId: null, endFrameApproval: null, referenceIds: [], provider: 'synthetic-local-test', model: 'ffmpeg-test', capabilityProfileVersion: 'synthetic-1',
        settings, estimatedCost: 0, currency: 'USD', providerOperationId: null, status: 'ready', retryOf: null, consentedAt: now, startedAt: now, completedAt: now, error: null };
      visual.videoClips[`visual-clip-${shot.id}`] = { id: `visual-clip-${shot.id}`, operationId, shotId: shot.id, revisionId: revision.id,
        promptId: prompt.id, promptVersion: prompt.version, startFrameId: frameId, endFrameId: null, referenceIds: [], provider: 'synthetic-local-test',
        model: 'ffmpeg-test', capabilityProfileVersion: 'synthetic-1', settings, blobHash: video.hash, mimeType: 'video/mp4', width: 160, height: 90,
        byteSize: bytes.length, durationSeconds: 4, status: 'approved', estimatedCost: 0, currency: 'USD', createdAt: now };
    });
    cinema.visualPreproduction = visual; await storage.saveLocalDocument(document);
  }, Buffer.from(await readFile(inputPath)).toString('base64'));
  await page.goto('/?flow=simplified&stage=video');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Current filmmaking step' })).toContainText('1 of 6 takes approved');
  await capture(page, '08-partial-video');
});
