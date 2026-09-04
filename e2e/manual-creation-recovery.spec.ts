import { expect, test } from '@playwright/test';
import { addCinemaDraft, canvasNode, confirmCineseryeDialog, openEditor, waitForSaved } from './helpers';

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

async function flowNodePositions(page: import('@playwright/test').Page, ids?: string[]) {
  return page.locator('.react-flow__node').evaluateAll((elements, requestedIds) => {
    const requested = new Set(requestedIds);
    return Object.fromEntries(elements
      .map((element) => [element.getAttribute('data-id') ?? '', (element as HTMLElement).style.transform])
      .filter(([id]) => id && (!requested.size || requested.has(id))));
  }, ids ?? []);
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
    await page.getByRole('button', { name: 'Delete unlocked layers', exact: true }).click();
    await confirmCineseryeDialog(page, 'Delete 3 layers');
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
  const initialLaneBoxes = await Promise.all([
    canvasNode(page, 'Scene 01').boundingBox(),
    canvasNode(page, 'Scene 02').boundingBox(),
    canvasNode(page, 'Shot 01').boundingBox(),
    canvasNode(page, 'Shot 02').boundingBox(),
  ]);
  expect(Math.abs(initialLaneBoxes[0]!.x - initialLaneBoxes[1]!.x)).toBeLessThan(3);
  expect(initialLaneBoxes[1]!.y).toBeGreaterThan(initialLaneBoxes[0]!.y);
  expect(Math.abs(initialLaneBoxes[2]!.x - initialLaneBoxes[3]!.x)).toBeLessThan(3);
  expect(initialLaneBoxes[3]!.y).toBeGreaterThan(initialLaneBoxes[2]!.y);

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
      sourceHandle: null, targetHandle: null, type: 'smoothstep', relationship: 'hierarchy',
    });
  }

  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Fit View' }).click();
  await expect(page.getByLabel('Connector from Scene 02 to Shot 04')).toBeVisible();
  await expect.poll(() => visibleCinemaHierarchyOverlaps(page)).toEqual([]);
});

test('keeps an accepted plan stable when adding a manual shot and next scene', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  const chooser = page.getByRole('dialog', { name: /Start with your scene/ });
  await chooser.getByRole('button', { name: /Explore the sample/ }).click();
  await expect(page.getByText('Sample opened locally with fixture sources.')).toBeVisible();

  const acceptedIds = await page.locator('.react-flow__node').evaluateAll((elements) => (
    elements.map((element) => element.getAttribute('data-id')).filter((id): id is string => Boolean(id))
  ));
  const acceptedPositions = await flowNodePositions(page, acceptedIds);
  const acceptedOverlaps = await visibleCinemaHierarchyOverlaps(page);
  const scene = canvasNode(page, 'Scene 01 · The Abandoned Cinema');

  await scene.click();
  await page.getByRole('button', { name: 'Add shot', exact: true }).click();
  await expect(page.getByLabel('Concept title')).toContainText('Shot 07');
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await expect(page.getByLabel('Connector from Scene 01 · The Abandoned Cinema to Shot 07')).toBeVisible();
  expect(await flowNodePositions(page, acceptedIds)).toEqual(acceptedPositions);

  await page.getByRole('button', { name: 'Fit View' }).click();
  await scene.click();
  await page.getByRole('button', { name: 'Add next scene', exact: true }).click();
  await expect(page.getByLabel('Concept title')).toContainText('Scene 02');
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await expect(page.getByLabel('Connector from The Reel That Knows Tomorrow to Scene 02')).toBeVisible();
  await expect(page.getByLabel(/Connector from Scene 01 · The Abandoned Cinema to Scene 02/)).toHaveCount(0);
  expect(await flowNodePositions(page, acceptedIds)).toEqual(acceptedPositions);
  await expect.poll(() => visibleCinemaHierarchyOverlaps(page)).toEqual(acceptedOverlaps);
  expect((await visibleCinemaHierarchyOverlaps(page)).filter((pair) => (
    pair.includes('Shot 07') || pair.includes('Scene 02')
  ))).toEqual([]);
  await page.getByRole('button', { name: 'Fit View' }).click();
  const acceptedSceneLane = await Promise.all([
    canvasNode(page, 'Scene 01 · The Abandoned Cinema').boundingBox(),
    canvasNode(page, 'Scene 02').boundingBox(),
  ]);
  expect(Math.abs(acceptedSceneLane[0]!.x - acceptedSceneLane[1]!.x)).toBeLessThan(3);
  expect(acceptedSceneLane[1]!.y).toBeGreaterThan(acceptedSceneLane[0]!.y);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(canvasNode(page, 'Scene 02')).toHaveCount(0);
  expect(await flowNodePositions(page, acceptedIds)).toEqual(acceptedPositions);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(canvasNode(page, 'Scene 02')).toBeVisible();

  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(canvasNode(page, 'Shot 07')).toBeVisible();
  await expect(canvasNode(page, 'Scene 02')).toBeVisible();
  expect((await visibleCinemaHierarchyOverlaps(page)).filter((pair) => (
    pair.includes('Shot 07') || pair.includes('Scene 02')
  ))).toEqual([]);
});

test('centers a draft scene against three shots and moves the next draft scene band', async ({ page }) => {
  await openEditor(page);

  const selectOutline = (name: string) => page.getByRole('navigation', { name: 'Project outline' })
    .getByRole('button', { name, exact: true })
    .click();
  const modelPosition = async (name: string) => {
    await selectOutline(name);
    const inspector = page.locator('.inspector-panel');
    return {
      x: Number(await inspector.getByRole('spinbutton', { name: 'X', exact: true }).inputValue()),
      y: Number(await inspector.getByRole('spinbutton', { name: 'Y', exact: true }).inputValue()),
    };
  };

  const originalScene01 = await modelPosition('Scene 01');
  await selectOutline('Scene 01');
  await page.getByRole('button', { name: 'Add next scene', exact: true }).click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await selectOutline('Scene 02');
  await page.getByRole('button', { name: 'Add next scene', exact: true }).click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();

  await selectOutline('Scene 02');
  await page.getByRole('button', { name: 'Add shot', exact: true }).click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await selectOutline('Shot 02');
  await page.getByRole('button', { name: 'Add next shot', exact: true }).click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();

  const scene03BeforeThirdShot = await modelPosition('Scene 03');
  await selectOutline('Shot 03');
  await page.getByRole('button', { name: 'Add next shot', exact: true }).click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();

  const scene02 = await modelPosition('Scene 02');
  const scene03 = await modelPosition('Scene 03');
  const shot02 = await modelPosition('Shot 02');
  const shot03 = await modelPosition('Shot 03');
  const shot04 = await modelPosition('Shot 04');
  expect(scene02.y + 34).toBe((shot02.y + shot04.y + 68) / 2);
  expect(shot02.x).toBe(shot03.x);
  expect(shot03.x).toBe(shot04.x);
  expect(scene02.x).toBeLessThan(shot02.x);
  expect(scene03.y).toBeGreaterThan(shot04.y + 68);
  expect(scene03.y).toBeGreaterThan(scene03BeforeThirdShot.y);
  expect(await modelPosition('Scene 01')).toEqual(originalScene01);
  await expect(page.getByLabel('Connector from Story Premise to Scene 02')).toBeVisible();
  await expect(page.getByLabel('Connector from Scene 02 to Shot 04')).toBeVisible();
  await expect.poll(() => visibleCinemaHierarchyOverlaps(page)).toEqual([]);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(canvasNode(page, 'Shot 04')).toHaveCount(0);
  expect(await modelPosition('Scene 03')).toEqual(scene03BeforeThirdShot);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(canvasNode(page, 'Shot 04')).toBeVisible();
  expect(await modelPosition('Scene 03')).toEqual(scene03);

  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  expect(await modelPosition('Scene 02')).toEqual(scene02);
  expect(await modelPosition('Scene 03')).toEqual(scene03);
  await expect.poll(() => visibleCinemaHierarchyOverlaps(page)).toEqual([]);
});

test('routes direct Story to Scene siblings through one derived hierarchy spine', async ({ page }) => {
  await openEditor(page);
  const initialConnector = page.getByLabel('Connector from Story Premise to Scene 01');
  await expect(initialConnector).not.toHaveAttribute('data-cinema-route', 'story-scene-bus');

  await page.getByRole('button', { name: 'Scene 01', exact: true }).click();
  await page.getByRole('button', { name: 'Add next scene', exact: true }).click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  const scene01Connector = page.getByLabel('Connector from Story Premise to Scene 01');
  const scene02Connector = page.getByLabel('Connector from Story Premise to Scene 02');
  await expect(scene01Connector).toHaveAttribute('data-cinema-route', 'story-scene-bus');
  await expect(scene02Connector).toHaveAttribute('data-cinema-route', 'story-scene-bus');
  const firstTrunk = await scene01Connector.getAttribute('data-cinema-trunk-x');
  expect(firstTrunk).toBeTruthy();
  await expect(scene02Connector).toHaveAttribute('data-cinema-trunk-x', firstTrunk!);
  await expect(page.getByLabel(/Connector from Scene 01 to Scene 02/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Scene 02', exact: true }).click();
  await page.getByRole('button', { name: 'Add next scene', exact: true }).click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  const scene03Connector = page.getByLabel('Connector from Story Premise to Scene 03');
  await expect(scene03Connector).toHaveAttribute('data-cinema-route', 'story-scene-bus');
  await expect(scene03Connector).toHaveAttribute('data-cinema-trunk-x', firstTrunk!);

  await waitForSaved(page);
  const persistedSceneEdges = await page.evaluate(() => new Promise<Array<{
    type?: string;
    relationship?: string;
    cinemaRoute?: string;
  }>>((resolve, reject) => {
    const request = indexedDB.open('cineserye-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const stored = database.transaction('documents', 'readonly').objectStore('documents').get('current');
      stored.onerror = () => reject(stored.error);
      stored.onsuccess = () => {
        const document = stored.result as {
          nodes: Array<{ id: string; data: { domainType?: string } }>;
          edges: Array<{ target: string; type?: string; data?: { relationship?: string; cinemaRoute?: string } }>;
        };
        const sceneNodeIds = new Set(document.nodes
          .filter((node) => node.data.domainType === 'cinema.scene')
          .map((node) => node.id));
        resolve(document.edges
          .filter((edge) => sceneNodeIds.has(edge.target))
          .map((edge) => ({
            type: edge.type,
            relationship: edge.data?.relationship,
            cinemaRoute: edge.data?.cinemaRoute,
          })));
      };
    };
  }));
  expect(persistedSceneEdges).toHaveLength(3);
  expect(persistedSceneEdges.every((edge) => (
    edge.type === 'smoothstep'
    && edge.relationship === 'hierarchy'
    && edge.cinemaRoute === undefined
  ))).toBe(true);

  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.getByLabel('Connector from Story Premise to Scene 01')).toHaveAttribute('data-cinema-trunk-x', firstTrunk!);
  await expect(page.getByLabel('Connector from Story Premise to Scene 03')).toHaveAttribute('data-cinema-trunk-x', firstTrunk!);
});

test('sparkle repairs mixed Story connector directions and scattered Scene positions atomically', async ({ page }) => {
  await openEditor(page);
  for (let sceneNumber = 1; sceneNumber < 5; sceneNumber += 1) {
    await page.getByRole('button', { name: `Scene ${String(sceneNumber).padStart(2, '0')}`, exact: true }).click();
    await page.getByRole('button', { name: 'Add next scene', exact: true }).click();
    await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  }
  await waitForSaved(page);

  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('cineserye-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('documents', 'readwrite');
      const store = transaction.objectStore('documents');
      const stored = store.get('current');
      stored.onerror = () => reject(stored.error);
      stored.onsuccess = () => {
        const document = stored.result as {
          nodes: Array<{ id: string; position: { x: number; y: number }; data: { name: string } }>;
          edges: Array<{ source: string; target: string; sourceHandle?: string; targetHandle?: string }>;
        };
        const nodeByName = new Map(document.nodes.map((node) => [node.data.name, node]));
        const storyId = nodeByName.get('Story Premise')!.id;
        const scattered = new Map([
          ['Story Premise', { x: 230, y: 300 }],
          ['Scene 01', { x: 180, y: 500 }],
          ['Scene 02', { x: 530, y: 150 }],
          ['Scene 03', { x: 350, y: 500 }],
          ['Scene 04', { x: 530, y: 390 }],
          ['Scene 05', { x: 530, y: 510 }],
        ]);
        for (const node of document.nodes) node.position = scattered.get(node.data.name) ?? node.position;
        const sceneEdges = document.edges.filter((edge) => edge.source === storyId && (
          nodeByName.get('Scene 01')?.id === edge.target
          || nodeByName.get('Scene 02')?.id === edge.target
          || nodeByName.get('Scene 03')?.id === edge.target
          || nodeByName.get('Scene 04')?.id === edge.target
          || nodeByName.get('Scene 05')?.id === edge.target
        ));
        for (const edge of sceneEdges) {
          const targetName = document.nodes.find((node) => node.id === edge.target)!.data.name;
          if (targetName === 'Scene 01' || targetName === 'Scene 03') {
            edge.sourceHandle = 'bottom';
            edge.targetHandle = 'top';
          } else {
            delete edge.sourceHandle;
            delete edge.targetHandle;
          }
        }
        document.edges = [
          ...sceneEdges.filter((edge) => edge.target === nodeByName.get('Scene 01')!.id),
          ...document.edges.filter((edge) => !sceneEdges.includes(edge)),
          ...sceneEdges.filter((edge) => edge.target !== nodeByName.get('Scene 01')!.id),
        ];
        store.put(document);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    };
  }));
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();

  const outline = page.getByRole('navigation', { name: 'Project outline' });
  const modelPosition = async (name: string) => {
    await outline.getByRole('button', { name, exact: true }).click();
    const inspector = page.locator('.inspector-panel');
    return {
      x: Number(await inspector.getByRole('spinbutton', { name: 'X', exact: true }).inputValue()),
      y: Number(await inspector.getByRole('spinbutton', { name: 'Y', exact: true }).inputValue()),
    };
  };
  expect(await modelPosition('Scene 01')).toEqual({ x: 180, y: 500 });
  await page.getByRole('button', { name: 'Reorganize project layout' }).click();
  await expect(page.getByText('Project hierarchy reorganized.')).toBeVisible();

  const arrangedScenes = [];
  for (let sceneNumber = 1; sceneNumber <= 5; sceneNumber += 1) {
    arrangedScenes.push(await modelPosition(`Scene ${String(sceneNumber).padStart(2, '0')}`));
  }
  expect(new Set(arrangedScenes.map((position) => position.x))).toEqual(new Set([530]));
  expect(arrangedScenes.map((position) => position.y)).toEqual(
    [...arrangedScenes.map((position) => position.y)].sort((left, right) => left - right),
  );
  const connectors = Array.from({ length: 5 }, (_, index) => page.getByLabel(
    `Connector from Story Premise to Scene ${String(index + 1).padStart(2, '0')}`,
  ));
  const sharedTrunk = await connectors[0].getAttribute('data-cinema-trunk-x');
  expect(sharedTrunk).toBeTruthy();
  for (const connector of connectors) {
    await expect(connector).toHaveAttribute('data-cinema-route', 'story-scene-bus');
    await expect(connector).toHaveAttribute('data-cinema-trunk-x', sharedTrunk!);
  }

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await modelPosition('Scene 01')).toEqual({ x: 180, y: 500 });
  await expect(page.getByLabel('Connector from Story Premise to Scene 01')).not.toHaveAttribute('data-cinema-route', 'story-scene-bus');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect((await modelPosition('Scene 01')).x).toBe(530);
  await expect(page.getByLabel('Connector from Story Premise to Scene 01')).toHaveAttribute('data-cinema-route', 'story-scene-bus');

  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.getByLabel('Connector from Story Premise to Scene 05')).toHaveAttribute('data-cinema-trunk-x', sharedTrunk!);
});

test('sparkle restores outlier Scenes to a dominant bottom row', async ({ page }) => {
  await openEditor(page);
  for (let sceneNumber = 1; sceneNumber < 5; sceneNumber += 1) {
    await page.getByRole('button', { name: `Scene ${String(sceneNumber).padStart(2, '0')}`, exact: true }).click();
    await page.getByRole('button', { name: 'Add next scene', exact: true }).click();
    await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  }
  await waitForSaved(page);

  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('cineserye-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('documents', 'readwrite');
      const store = transaction.objectStore('documents');
      const stored = store.get('current');
      stored.onerror = () => reject(stored.error);
      stored.onsuccess = () => {
        const document = stored.result as {
          nodes: Array<{ id: string; position: { x: number; y: number }; data: { name: string } }>;
          edges: Array<{ source: string; target: string; sourceHandle?: string; targetHandle?: string }>;
        };
        const nodeByName = new Map(document.nodes.map((node) => [node.data.name, node]));
        const storyId = nodeByName.get('Story Premise')!.id;
        const positions = new Map([
          ['Story Premise', { x: 400, y: 80 }],
          ['Scene 01', { x: 100, y: 500 }],
          ['Scene 02', { x: 364, y: 500 }],
          ['Scene 03', { x: 628, y: 500 }],
          ['Scene 04', { x: 900, y: 250 }],
          ['Scene 05', { x: 1200, y: 800 }],
        ]);
        for (const node of document.nodes) node.position = positions.get(node.data.name) ?? node.position;
        const sceneIds = new Set(Array.from({ length: 5 }, (_, index) => (
          nodeByName.get(`Scene ${String(index + 1).padStart(2, '0')}`)!.id
        )));
        for (const edge of document.edges) {
          if (edge.source !== storyId || !sceneIds.has(edge.target)) continue;
          const targetName = document.nodes.find((node) => node.id === edge.target)!.data.name;
          if (targetName === 'Scene 01' || targetName === 'Scene 02' || targetName === 'Scene 03') {
            edge.sourceHandle = 'bottom';
            edge.targetHandle = 'top';
          } else {
            delete edge.sourceHandle;
            delete edge.targetHandle;
          }
        }
        store.put(document);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    };
  }));
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();

  const outline = page.getByRole('navigation', { name: 'Project outline' });
  const modelPosition = async (name: string) => {
    await outline.getByRole('button', { name, exact: true }).click();
    const inspector = page.locator('.inspector-panel');
    return {
      x: Number(await inspector.getByRole('spinbutton', { name: 'X', exact: true }).inputValue()),
      y: Number(await inspector.getByRole('spinbutton', { name: 'Y', exact: true }).inputValue()),
    };
  };
  expect(await modelPosition('Scene 04')).toEqual({ x: 900, y: 250 });
  await page.getByRole('button', { name: 'Reorganize project layout' }).click();
  await expect(page.getByText('Project hierarchy reorganized.')).toBeVisible();

  const arrangedScenes = [];
  for (let sceneNumber = 1; sceneNumber <= 5; sceneNumber += 1) {
    arrangedScenes.push(await modelPosition(`Scene ${String(sceneNumber).padStart(2, '0')}`));
  }
  expect(new Set(arrangedScenes.map((position) => position.y))).toEqual(new Set([500]));
  expect(arrangedScenes.map((position) => position.x)).toEqual(
    [...arrangedScenes.map((position) => position.x)].sort((left, right) => left - right),
  );
  const [storyBox, firstSceneBox, lastSceneBox] = await Promise.all([
    canvasNode(page, 'Story Premise').boundingBox(),
    canvasNode(page, 'Scene 01').boundingBox(),
    canvasNode(page, 'Scene 05').boundingBox(),
  ]);
  expect(storyBox).toBeTruthy();
  expect(firstSceneBox).toBeTruthy();
  expect(lastSceneBox).toBeTruthy();
  expect(Math.abs(
    storyBox!.x + storyBox!.width / 2
    - (firstSceneBox!.x + lastSceneBox!.x + lastSceneBox!.width) / 2,
  )).toBeLessThan(3);
  await expect.poll(() => visibleCinemaHierarchyOverlaps(page)).toEqual([]);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await modelPosition('Scene 04')).toEqual({ x: 900, y: 250 });
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect((await modelPosition('Scene 04')).y).toBe(500);

  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  expect((await modelPosition('Scene 05')).y).toBe(500);
});

test('reorganizes a disordered draft hierarchy by narrative order as one undoable action', async ({ page }) => {
  await openEditor(page);
  const outline = page.getByRole('navigation', { name: 'Project outline' });
  const selectOutline = (name: string) => outline.getByRole('button', { name, exact: true }).click();
  const modelPosition = async (name: string) => {
    await selectOutline(name);
    const inspector = page.locator('.inspector-panel');
    return {
      x: Number(await inspector.getByRole('spinbutton', { name: 'X', exact: true }).inputValue()),
      y: Number(await inspector.getByRole('spinbutton', { name: 'Y', exact: true }).inputValue()),
    };
  };
  const setPosition = async (name: string, x: number, y: number) => {
    await selectOutline(name);
    const inspector = page.locator('.inspector-panel');
    await inspector.getByRole('spinbutton', { name: 'X', exact: true }).fill(String(x));
    await inspector.getByRole('spinbutton', { name: 'X', exact: true }).blur();
    await inspector.getByRole('spinbutton', { name: 'Y', exact: true }).fill(String(y));
    await inspector.getByRole('spinbutton', { name: 'Y', exact: true }).blur();
  };

  await selectOutline('Scene 01');
  await page.getByRole('button', { name: 'Add next scene', exact: true }).click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await selectOutline('Scene 02');
  await page.getByRole('button', { name: 'Add next scene', exact: true }).click();
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();

  await setPosition('Scene 02', 900, 800);
  await setPosition('Scene 03', 380, 40);
  const disorderedScene03 = await modelPosition('Scene 03');
  await page.getByRole('button', { name: 'Reorganize project layout' }).click();
  await expect(page.getByText('Project hierarchy reorganized.')).toBeVisible();

  const story = await modelPosition('Story Premise');
  const scene01 = await modelPosition('Scene 01');
  const scene02 = await modelPosition('Scene 02');
  const scene03 = await modelPosition('Scene 03');
  expect(scene01.x).toBe(scene02.x);
  expect(scene02.x).toBe(scene03.x);
  expect(scene01.y).toBeLessThan(scene02.y);
  expect(scene02.y).toBeLessThan(scene03.y);
  expect(story.y + 34).toBe((scene01.y + scene03.y + 68) / 2);
  await expect.poll(() => visibleCinemaHierarchyOverlaps(page)).toEqual([]);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await modelPosition('Scene 03')).toEqual(disorderedScene03);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(await modelPosition('Scene 03')).toEqual(scene03);

  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  expect(await modelPosition('Story Premise')).toEqual(story);
  expect(await modelPosition('Scene 02')).toEqual(scene02);
});

test('automatically updates one Project Outline and preserves flat Layers as a separate view', async ({ page }) => {
  await openEditor(page);
  const outline = page.getByRole('navigation', { name: 'Project outline' });
  await expect(page.getByRole('heading', { name: 'Project Outline' })).toBeVisible();
  await expect(outline.getByRole('button', { name: 'Story Premise', exact: true })).toBeVisible();
  await expect(outline.getByRole('button', { name: 'Scene 01', exact: true })).toBeVisible();
  await expect(outline.getByRole('button', { name: 'Shot 01', exact: true })).toBeVisible();
  await expect(outline.getByText('1 shot · 0s', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Scene 01', exact: true }).click();
  await page.getByRole('button', { name: 'Add shot', exact: true }).click();
  await page.getByLabel('Concept title').fill('Shot 02 - Flashlight reveal');
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  const secondShot = outline.getByRole('button', { name: 'Shot 02 - Flashlight reveal', exact: true });
  await expect(secondShot).toBeVisible();
  await expect(outline.getByText('2 shots · 0s', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Collapse Scene 01' }).click();
  await expect(secondShot).toHaveCount(0);
  await outline.getByRole('button', { name: 'Scene 01', exact: true }).click();
  await page.getByRole('button', { name: 'Add shot', exact: true }).click();
  await page.getByLabel('Concept title').fill('Shot 03 - Auto-expanded branch');
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await expect(outline.getByRole('button', { name: 'Shot 03 - Auto-expanded branch', exact: true })).toBeVisible();

  await outline.getByRole('button', { name: 'Scene 01', exact: true }).click();
  await addCinemaDraft(page, 'Note');
  await page.getByLabel('Concept title').fill('Wardrobe continuity');
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  const wardrobeNote = outline.getByRole('button', { name: 'Wardrobe continuity', exact: true });
  await expect(wardrobeNote).toBeVisible();
  await expect(outline.getByRole('list', { name: 'Notes in Scene 01' })).toContainText('Wardrobe continuity');

  await page.getByRole('button', { name: 'Collapse Scene 01' }).click();
  const search = page.getByLabel('Search project outline');
  await search.fill('flashlight reveal');
  await expect(outline.getByRole('button', { name: 'Story Premise', exact: true })).toBeVisible();
  await expect(outline.getByRole('button', { name: 'Scene 01', exact: true })).toBeVisible();
  await expect(outline.getByRole('button', { name: 'Shot 02 - Flashlight reveal', exact: true })).toBeVisible();
  await expect(page.locator('.layer-search').getByText('1', { exact: true })).toBeVisible();
  await search.fill('');
  await expect(secondShot).toHaveCount(0);

  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Canvas layers' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Project outline' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Project Outline', exact: true }).click();
  await page.getByRole('button', { name: 'Expand Scene 01' }).click();
  await expect(page.getByRole('navigation', { name: 'Project outline' }).getByRole('button', { name: 'Shot 02 - Flashlight reveal', exact: true })).toBeVisible();

  await waitForSaved(page);
  const attachmentRelationship = await page.evaluate(() => new Promise<string | null>((resolve, reject) => {
    const request = indexedDB.open('cineserye-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const stored = database.transaction('documents', 'readonly').objectStore('documents').get('current');
      stored.onerror = () => reject(stored.error);
      stored.onsuccess = () => {
        const document = stored.result as {
          nodes: Array<{ id: string; data: { name: string } }>;
          edges: Array<{ target: string; data?: { relationship?: string } }>;
        };
        const noteId = document.nodes.find((node) => node.data.name === 'Wardrobe continuity')?.id;
        resolve(document.edges.find((edge) => edge.target === noteId)?.data?.relationship ?? null);
        database.close();
      };
    };
  }));
  expect(attachmentRelationship).toBe('attachment');
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Project outline' }).getByRole('button', { name: 'Shot 02 - Flashlight reveal', exact: true })).toBeVisible();
});
