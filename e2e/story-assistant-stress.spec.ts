import { expect, test } from '@playwright/test';
import { initialDocument } from '../app/editor/initial-document';
import { confirmCineseryeDialog, openEditor, waitForSaved } from './helpers';

test('assistant progresses on a 500-node 800-edge canvas without changing production geometry', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Large canvas budget is exercised once in Chromium.');
  test.setTimeout(90_000);
  const document = structuredClone(initialDocument);
  document.nodes = Array.from({ length: 500 }, (_, index) => ({ ...structuredClone(initialDocument.nodes[0]),
    id: index ? `large-${index}` : 'story-premise', position: { x: (index % 20) * 300, y: Math.floor(index / 20) * 160 },
    data: { ...structuredClone(initialDocument.nodes[0].data), domainType: index ? 'cinema.note' : 'cinema.story' },
  }));
  document.edges = Array.from({ length: 800 }, (_, index) => ({ ...structuredClone(initialDocument.edges[0]), id: `large-edge-${index}`,
    source: document.nodes[index % 499].id, target: document.nodes[(index % 499 + (index < 499 ? 1 : 2)) % 500].id,
  }));
  await openEditor(page);
  await page.getByRole('button', { name: 'Project backup and restore' }).click();
  await page.getByLabel('Choose a Cineserye project backup').setInputFiles({ name: 'assistant-stress.cineserye', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'cineserye-project', version: 3, exportedAt: new Date(0).toISOString(), document })) });
  await confirmCineseryeDialog(page, 'Restore backup');
  await expect(page.getByText('Project backup restored.')).toBeVisible({ timeout: 20_000 });
  // The imported viewport may place a 500-node graph far from the premise.
  // Use its outline entry, then the same contextual editor action as a user.
  await page.getByRole('button', { name: 'Story Premise', exact: true }).first().click();
  await page.locator('.react-flow__node[data-id="story-premise"]').dblclick();
  await page.getByRole('button', { name: 'Focus story editor', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Story premise layer editor', exact: true });
  await editor.getByLabel('Premise for development', { exact: true }).fill('A 60-second vertical horror short. No dialogue.');
  await editor.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.getByRole('button', { name: 'Focus story assistant', exact: true }).click();
  const assistant = page.getByRole('region', { name: 'Story Assistant', exact: true });
  const geometry = () => page.locator('.react-flow__node:not([data-id^="story-assistant:"])').evaluateAll((nodes) => nodes.map((node) => ({ id: node.getAttribute('data-id'), transform: (node as HTMLElement).style.transform })));
  const before = await geometry();
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByLabel('Ending direction', { exact: true })).toHaveCount(0);
  await assistant.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(assistant.getByRole('heading', { name: 'Ready to shape your scenes', exact: true })).toBeVisible();
  expect(await geometry()).toEqual(before);
  await expect(page.locator('.react-flow__node')).toHaveCount(501);
  await expect(page.locator('.react-flow__edge')).toHaveCount(801);
  await waitForSaved(page); await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await expect(assistant.getByRole('heading', { name: 'Ready to shape your scenes', exact: true })).toBeVisible();
  expect(await geometry()).toEqual(before);
});
