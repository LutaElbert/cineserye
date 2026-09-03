import { expect, test } from '@playwright/test';
import { addCinemaDraft, canvasNode, openEditor, waitForSaved } from './helpers';

const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';

async function visibleCinemaHierarchyOverlaps(page: import('@playwright/test').Page) {
  return page.locator('.react-flow__node').evaluateAll((elements) => {
    const nodes = elements
      .filter((element) => element.querySelector('[data-domain-type="cinema.story"], [data-domain-type="cinema.scene"], [data-domain-type="cinema.shot"]'))
      .map((element) => ({ label: element.textContent?.trim() ?? '', rectangle: element.getBoundingClientRect() }));
    const overlaps: string[] = [];
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        const a = nodes[left].rectangle;
        const b = nodes[right].rectangle;
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
          overlaps.push(`${nodes[left].label} <> ${nodes[right].label}`);
        }
      }
    }
    return overlaps;
  });
}

test('creates typed cinema drafts with contextual relationships and reversible commands', async ({ page }) => {
  await openEditor(page);

  await page.getByRole('button', { name: 'Scene 01', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add shot', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add next scene', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add shot', exact: true }).click();
  await page.getByLabel('Concept title').fill('Close-up reveal');
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();

  const createdShot = canvasNode(page, 'Close-up reveal');
  await expect(createdShot.locator('[data-domain-type="cinema.shot"]')).toBeVisible();
  await expect(page.getByLabel('Connector from Scene 01 to Close-up reveal')).toBeVisible();
  await expect(createdShot.getByText('Draft', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close-up reveal', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close-up reveal', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Scene 01', exact: true }).click();
  await addCinemaDraft(page, 'Character');
  await page.getByLabel('Concept title').fill('Mara');
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await expect(canvasNode(page, 'Mara').locator('[data-domain-type="cinema.character"]')).toBeVisible();
  await expect(page.getByLabel('Connector from Scene 01 to Mara')).toBeVisible();

  await page.locator('.inspector-panel').getByLabel('Cinema role').selectOption('prop');
  await expect(canvasNode(page, 'Mara').locator('[data-domain-type="cinema.prop"]')).toBeVisible();
  await expect(canvasNode(page, 'Mara').getByText('Mara', { exact: true })).toBeVisible();
  await expect(page.getByText('Converted to prop.')).toBeVisible();
});

test('guards an empty canvas and supports undo plus persisted recovery', async ({ page }) => {
  await openEditor(page);
  const selectAllAndDelete = async () => {
    await page.locator('#canvas-workspace').focus();
    await page.keyboard.press(selectAllShortcut);
    await expect(page.locator('.inspector-panel').getByText('3 layers selected', { exact: true }).first()).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete unlocked layers', exact: true }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(0);
  };

  await selectAllAndDelete();
  const emptyState = page.getByRole('region', { name: 'Your project is still yours.' });
  await expect(emptyState).toBeVisible();
  await expect(emptyState.getByRole('button', { name: 'Undo delete' })).toBeVisible();
  await emptyState.getByRole('button', { name: 'Undo delete' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);

  await selectAllAndDelete();
  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
  const reloadedEmptyState = page.getByRole('region', { name: 'Your project is still yours.' });
  await expect(reloadedEmptyState.getByRole('button', { name: 'Recover last canvas' })).toBeVisible();
  await reloadedEmptyState.getByRole('button', { name: 'Recover last canvas' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Story Premise', exact: true })).toBeVisible();
});

test('creation palette exposes prerequisites and keyboard-accessible choices', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Add filmmaking layer' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add a filmmaking layer' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Story premise / })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: /^Shot / })).toBeEnabled();
  await expect(dialog.getByRole('region', { name: 'Production' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Reference image / })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('keeps new scenes and shots connected to semantic parents without overlapping subtrees', async ({ page }) => {
  await openEditor(page);

  await page.getByRole('button', { name: 'Scene 01', exact: true }).click();
  await page.getByRole('button', { name: 'Add shot', exact: true }).click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();

  await page.getByRole('button', { name: 'Shot 01', exact: true }).click();
  await page.getByRole('button', { name: 'Add next shot', exact: true }).click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();

  await page.getByRole('button', { name: 'Scene 01', exact: true }).click();
  await page.getByRole('button', { name: 'Add next scene', exact: true }).click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await page.getByRole('button', { name: 'Scene 02', exact: true }).click();
  await page.getByRole('button', { name: 'Add shot', exact: true }).click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await page.getByRole('button', { name: 'Fit View' }).click();

  await expect(page.getByLabel('Connector from Story Premise to Scene 01')).toBeVisible();
  await expect(page.getByLabel('Connector from Story Premise to Scene 02')).toBeVisible();
  await expect(page.getByLabel('Connector from Scene 01 to Shot 01')).toBeVisible();
  await expect(page.getByLabel('Connector from Scene 01 to Shot 02')).toBeVisible();
  await expect(page.getByLabel('Connector from Scene 01 to Shot 03')).toBeVisible();
  await expect(page.getByLabel('Connector from Scene 02 to Shot 04')).toBeVisible();
  await expect(page.getByLabel(/Connector from Shot 01 to Shot/)).toHaveCount(0);
  await expect(page.getByLabel(/Connector from Scene 01 to Scene 02/)).toHaveCount(0);
  await expect.poll(() => visibleCinemaHierarchyOverlaps(page)).toEqual([]);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Shot 04', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Shot 04', exact: true })).toBeVisible();

  await waitForSaved(page);
  const persistedHierarchy = await page.evaluate(() => new Promise<Array<{
    source: string;
    target: string;
    sourceHandle: string | null;
    targetHandle: string | null;
    type: string | null;
    relationship: string | null;
  }>>((resolve, reject) => {
    const request = indexedDB.open('cineserye-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const stored = database.transaction('documents', 'readonly').objectStore('documents').get('current');
      stored.onerror = () => reject(stored.error);
      stored.onsuccess = () => {
        const document = stored.result as {
          nodes: Array<{ id: string; data: { name: string } }>;
          edges: Array<{
            source: string; target: string; sourceHandle?: string; targetHandle?: string; type?: string;
            data?: { relationship?: string };
          }>;
        };
        const names = new Map(document.nodes.map((node) => [node.id, node.data.name]));
        resolve(document.edges
          .filter((edge) => edge.data?.relationship === 'hierarchy')
          .map((edge) => ({
            source: names.get(edge.source) ?? edge.source,
            target: names.get(edge.target) ?? edge.target,
            sourceHandle: edge.sourceHandle ?? null,
            targetHandle: edge.targetHandle ?? null,
            type: edge.type ?? null,
            relationship: edge.data?.relationship ?? null,
          })));
        database.close();
      };
    };
  }));
  expect(persistedHierarchy).toHaveLength(6);
  expect(persistedHierarchy).toEqual(expect.arrayContaining([
    expect.objectContaining({ source: 'Story Premise', target: 'Scene 02' }),
    expect.objectContaining({ source: 'Scene 01', target: 'Shot 03' }),
    expect.objectContaining({ source: 'Scene 02', target: 'Shot 04' }),
  ]));
  for (const edge of persistedHierarchy) {
    expect(edge).toMatchObject({
      sourceHandle: 'bottom', targetHandle: 'top', type: 'smoothstep', relationship: 'hierarchy',
    });
  }

  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Fit View' }).click();
  await expect(page.getByLabel('Connector from Scene 02 to Shot 04')).toBeVisible();
  await expect.poll(() => visibleCinemaHierarchyOverlaps(page)).toEqual([]);
});
