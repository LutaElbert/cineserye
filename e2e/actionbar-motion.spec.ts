import { expect, test } from '@playwright/test';
import { openEditor, waitForSaved } from './helpers';

type MotionProbe = { hold: boolean; resume: () => void; events: Array<{ type: string; label?: string | null; target: string }> };

for (const release of ['inside', 'outside'] as const) test(`toolbar press stays stable during framing and releases ${release} safely`, async ({ page }, info) => {
  // Deterministically separate pointerdown from the scheduled camera frames.
  // Native input events still perform the gesture; no click is dispatched by JS.
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    let nextId = -1;
    const frames = new Map<number, FrameRequestCallback>();
    const events: MotionProbe['events'] = [];
    const probe: MotionProbe = { hold: false, events, resume() {
      probe.hold = false;
      const pending = [...frames.values()]; frames.clear();
      for (const frame of pending) request(frame);
    } };
    Object.assign(window, { motionProbe: probe });
    window.requestAnimationFrame = (frame) => {
      if (!probe.hold) return request(frame);
      const id = nextId--; frames.set(id, frame); return id;
    };
    window.cancelAnimationFrame = (id) => { if (id < 0) frames.delete(id); else cancel(id); };
    for (const type of ['pointerdown', 'pointerup', 'click']) document.addEventListener(type, (event) => {
      const target = event.target as Element;
      events.push({ type, label: target.closest('button')?.textContent, target: target.tagName });
    }, true);
  });
  await openEditor(page);
  await page.evaluate(() => { (window as unknown as { motionProbe: MotionProbe }).motionProbe.hold = true; });
  await page.getByRole('button', { name: 'Scene 01', exact: true }).click();
  const button = page.getByRole('button', { name: 'Add next scene', exact: true });
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const down = await page.evaluate(() => (window as unknown as { motionProbe: MotionProbe }).motionProbe.events.at(-1));
  expect(down?.type).toBe('pointerdown');
  expect(down?.label?.trim()).toBe('Add next scene');
  const pressed = (await button.boundingBox())!;
  const viewport = page.locator('.react-flow__viewport');
  const cameraBefore = await viewport.getAttribute('style');
  await page.evaluate(() => (window as unknown as { motionProbe: MotionProbe }).motionProbe.resume());
  // Hold a normal press longer than the 280ms automatic framing animation.
  await page.waitForTimeout(350);
  // The hold is a minimum, not evidence that the browser serviced a frame on
  // schedule. Keep the camera-movement assertion, but wait for that real state.
  await expect(viewport).not.toHaveAttribute('style', cameraBefore!);
  const held = (await button.boundingBox())!;
  expect(Math.abs(held.x - pressed.x)).toBeLessThan(1);
  expect(Math.abs(held.y - pressed.y)).toBeLessThan(1);
  await expect(page.getByRole('button', { name: 'Scene 02', exact: true })).toHaveCount(0);
  if (release === 'outside') await page.mouse.move(30, 30);
  await page.mouse.up();
  await info.attach('pointer-events', { body: JSON.stringify(await page.evaluate(() => (window as unknown as { motionProbe: MotionProbe }).motionProbe.events)), contentType: 'application/json' });
  const created = page.getByRole('button', { name: 'Scene 02', exact: true });
  if (release === 'outside') {
    await expect(created).toHaveCount(0);
    await expect(button).toBeVisible();
    return;
  }
  await expect(created).toBeVisible();
  await expect(page.getByRole('button', { name: /^Scene \d{2}$/ })).toHaveCount(2);
  await page.getByRole('button', { name: 'Finish editing', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(created).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(created).toBeVisible();
  await waitForSaved(page);
  await page.reload();
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  await expect(created).toBeVisible();
});
