import { expect, test } from '@playwright/test';
import { openEditor, openSelectedScenePlanner } from './helpers';

test.beforeEach(async ({ page }) => {
  expect(process.env.CINESERYE_E2E_RUNTIME).toBe('node-fixture');
  await page.route('**/api/cinema/**', async (route) => {
    if (route.request().method() === 'POST') await route.abort('blockedbyclient');
    else await route.continue();
  });
});

for (const width of [1440, 390]) {
  test(`planning is canvas-only while project actions remain available at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const posts: string[] = [];
    page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/cinema/')) posts.push(request.url()); });
    await openEditor(page);
    if (width === 390) await page.getByRole('button', { name: 'Fit View', exact: true }).click();
    await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
    await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
    const storyEditor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
    await storyEditor.getByRole('textbox', { name: 'Premise for development' }).fill('Four friends discover a haunted board game.');
    await storyEditor.getByRole('button', { name: 'Done', exact: true }).click();
    const topbar = page.locator('.topbar');
    await expect(topbar.getByRole('button', { name: /Generate shot plan|Develop this story|Create revision|Review shot plan/ })).toHaveCount(0);
    const scene = page.locator('.react-flow__node[data-id="scene-01"]');
    await page.getByRole('button', { name: 'Fit View', exact: true }).click();
    await scene.click();
    await expect(topbar.locator('.plan-scene-button')).toHaveCount(0);
    await openSelectedScenePlanner(page);
    const editor = page.getByRole('region', { name: 'Scene layer editor', exact: true });
    await expect(editor.getByRole('region', { name: 'Generate shot plan', exact: true })).toBeVisible();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await editor.getByRole('button', { name: 'Done', exact: true }).click();
    await topbar.getByRole('button', { name: 'Open story assistant', exact: true }).click();
    const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
    await expect(assistant).toBeVisible();
    await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
    await page.screenshot({ path: info.outputPath(`canvas-assistant-${width}.png`) });
    if (width === 390) {
      await topbar.getByRole('button', { name: 'Open project actions' }).click();
      const menu = page.getByRole('menu', { name: 'Project actions' });
      await expect(menu.getByRole('menuitem', { name: /shot plan|revision|planning/i })).toHaveCount(0);
      await expect(menu.getByRole('menuitem', { name: 'Backup or restore' })).toBeFocused();
      await expect(menu.getByRole('menuitem', { name: 'Export SVG' })).toBeVisible();
      await expect(menu.getByRole('menuitem', { name: 'New project' })).toBeVisible();
      await expect(menu.getByRole('menuitem', { name: 'Try simplified flow', exact: true })).toBeInViewport();
      await page.keyboard.press('Escape');
    }
    expect(posts).toEqual([]);
  });
}
