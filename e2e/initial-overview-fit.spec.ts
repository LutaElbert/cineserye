import { expect, test } from '@playwright/test';
import { openEditor, waitForSaved } from './helpers';

test('reload frames the measured overview once without hiding layers behind Properties', async ({ page }, info) => {
  test.skip(new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').port !== '3040', 'Use isolated fixture storage.');
  await page.setViewportSize({ width: 1366, height: 768 });
  await openEditor(page);
  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const nodes = page.locator('.react-flow__node');
  await expect(nodes).toHaveCount(3);
  await expect.poll(() => nodes.evaluateAll((elements) => elements.every((element) => {
    const box = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  }))).toBe(true);
  const canonicalPositions = await nodes.evaluateAll((elements) => elements.map((node) => (node as HTMLElement).style.transform));
  await page.locator('.react-flow__node[data-id="shot-01"]').dblclick();
  const editor = page.getByRole('region', { name: 'Shot layer editor', exact: true });
  await expect(editor).toBeVisible();
  await page.getByRole('button', { name: 'Focus layer editor', exact: true }).click();
  const viewport = page.locator('.react-flow__viewport');
  const before = await viewport.getAttribute('style');
  await editor.getByLabel('Layer title', { exact: true }).fill('Typing after overview fit');
  await expect(viewport).toHaveAttribute('style', before!);
  expect(await nodes.evaluateAll((elements) => elements.map((node) => (node as HTMLElement).style.transform))).toEqual(canonicalPositions);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('measured-overview-to-shot.png') });
});
