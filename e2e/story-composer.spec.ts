import { expect, test, type Page } from '@playwright/test';
import { createDiagramPng, waitForSaved } from './helpers';

test.beforeEach(async ({ page }) => {
  expect(process.env.CINESERYE_E2E_RUNTIME).toBe('node-fixture');
  await page.setViewportSize({ width: 1440, height: 900 });
  // This suite exercises local authoring only and may never dispatch generation.
  await page.route('**/api/cinema/**', async (route) => {
    if (route.request().method() === 'POST') await route.abort('blockedbyclient');
    else await route.continue();
  });
});

async function startIdea(page: Page) {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('dialog', { name: /Start with your scene/ }).getByRole('button', { name: /Start with an idea/ }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  if (!(await editor.count())) await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
  await expect(editor).toBeVisible();
  const focus = page.getByRole('button', { name: 'Focus story editor', exact: true });
  if (await focus.isVisible()) await focus.click();
  return editor;
}

test('idea-only starter preserves total runtime, aspect and multiple genres through close and reload without generation', async ({ page }, info) => {
  const posts: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts.push(request.url()); });
  const editor = await startIdea(page);
  await expect(editor.getByRole('textbox', { name: 'Premise for development' })).toHaveValue('');
  await editor.getByRole('textbox', { name: 'Premise for development' }).fill('Mara discovers a film showing her next move.');
  await editor.getByRole('spinbutton', { name: 'Total runtime in seconds' }).fill('60');
  await editor.getByRole('combobox', { name: 'Story aspect ratio' }).selectOption('9:16');
  await editor.getByRole('button', { name: /^Genres/ }).click();
  const genres = editor.getByRole('group', { name: 'Genres — choose multiple' });
  await genres.getByRole('button', { name: 'Horror', exact: true }).click();
  await genres.getByRole('button', { name: 'Mystery', exact: true }).click();
  await expect(genres.getByRole('button', { name: 'Horror', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(genres.getByRole('button', { name: 'Mystery', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(editor.getByRole('spinbutton', { name: 'Total runtime in seconds' })).toHaveAccessibleDescription('Duration of the whole video, not each scene, in seconds.');
  await page.screenshot({ path: info.outputPath('idea-only-composer.png') });
  await editor.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await waitForSaved(page);
  await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
  await expect(editor.getByRole('spinbutton', { name: 'Total runtime in seconds' })).toHaveValue('60');
  await expect(editor.getByRole('button', { name: 'Genres · Horror + Mystery', exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'Done', exact: true }).click();
  await waitForSaved(page); await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
  await expect(editor.getByRole('spinbutton', { name: 'Total runtime in seconds' })).toHaveValue('60');
  await expect(editor.getByRole('combobox', { name: 'Story aspect ratio' })).toHaveValue('9:16');
  await expect(editor.getByRole('button', { name: 'Genres · Horror + Mystery', exact: true })).toBeVisible();
  expect(posts).toEqual([]);
});

test('compact icon controls replace advanced options and Generate opens only the Assistant', async ({ page }, info) => {
  const posts: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts.push(request.url()); });
  const editor = await startIdea(page);
  await expect(editor.getByText('More options', { exact: true })).toHaveCount(0);
  await expect(editor.getByText('Manage references and notes', { exact: true })).toHaveCount(0);
  await expect(editor.getByRole('button', { name: /Discard text/ })).toHaveCount(0);
  await expect(editor.locator('.composer-controls > button > svg, .composer-controls > label > svg')).toHaveCount(4);
  await expect(editor.getByRole('button', { name: 'Generate', exact: true })).toBeDisabled();
  await editor.getByRole('textbox', { name: 'Premise for development' }).fill('Four friends discover a haunted board game.');
  await expect(editor.getByText('Assistant first. No images or video generated yet. Live analysis requires approval.', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('compact-icon-composer.png') });
  await editor.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Story Assistant', exact: true })).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(posts).toEqual([]);
});

test('local image aliases retain identity after archiving an earlier attachment and never imply permission', async ({ page }, info) => {
  const posts: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts.push(request.url()); });
  const editor = await startIdea(page);
  const png = await createDiagramPng(page);
  for (const name of ['location-one.png', 'camera-two.png']) {
    const chooser = page.waitForEvent('filechooser');
    await editor.getByRole('button', { name: 'Add story reference image' }).click();
    await (await chooser).setFiles({ name, mimeType: 'image/png', buffer: png });
    await expect(editor.getByRole('img', { name, exact: true })).toBeVisible();
  }
  await expect(editor.getByRole('button', { name: 'Mention @image1', exact: true })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Mention @image2', exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'Review reference permissions · 2', exact: true }).click();
  const permissions = editor.getByRole('region', { name: 'Reference permissions' });
  await expect(permissions.getByRole('combobox', { name: 'Rights for @image1', exact: true })).toHaveValue('unknown');
  await expect(permissions.getByRole('combobox', { name: 'Rights for @image2', exact: true })).toHaveValue('unknown');
  await expect(permissions.locator('input[type="checkbox"]:checked')).toHaveCount(0);
  await expect(permissions.getByText('Current policy: pending · v1', { exact: true })).toHaveCount(2);
  await editor.getByText('Advanced library: notes, scope and archive', { exact: true }).click();
  const first = editor.locator('.story-reference').filter({ hasText: 'location-one.png' });
  const second = editor.locator('.story-reference').filter({ hasText: 'camera-two.png' });
  await expect(first).toContainText('pending · unknown');
  await expect(second).toContainText('pending · unknown');
  await second.getByRole('button', { name: 'Edit policy/content', exact: true }).click();
  await expect(editor.getByRole('checkbox', { name: 'I approve this reference content', exact: true })).not.toBeChecked();
  for (const use of ['research', 'story-development', 'shot-planning', 'image-generation', 'video-generation']) {
    await expect(editor.getByRole('group', { name: 'Permitted reference uses' }).getByRole('checkbox', { name: use, exact: true })).not.toBeChecked();
  }
  await first.getByRole('button', { name: 'Archive reference', exact: true }).click();
  await editor.getByRole('button', { name: 'Back to premise', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Mention @image1', exact: true })).toHaveCount(0);
  await expect(editor.getByRole('button', { name: 'Mention @image2', exact: true })).toBeVisible();
  await expect(editor.getByRole('img', { name: 'camera-two.png', exact: true })).toBeVisible();
  await editor.getByRole('textbox', { name: 'Premise for development' }).fill('Use ');
  await editor.getByRole('button', { name: 'Mention @image2', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: 'Premise for development' })).toHaveValue('Use @image2 ');
  await page.screenshot({ path: info.outputPath('stable-local-image-alias.png') });
  await editor.getByRole('button', { name: 'Done', exact: true }).click();
  await waitForSaved(page); await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
  await expect(editor.getByRole('button', { name: 'Mention @image2', exact: true })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Mention @image1', exact: true })).toHaveCount(0);
  await expect(editor.getByRole('textbox', { name: 'Premise for development' })).toHaveValue('Use @image2 ');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(posts).toEqual([]);
});
