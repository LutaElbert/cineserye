import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function installStorageHarness(page: Page) {
  await page.route('**/__test-modules/*.js', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    if (!/^[\w.-]+\.js$/.test(name)) return route.abort();
    await route.fulfill({ contentType: 'application/javascript', body: await readFile(resolve('artifacts/simplified-flow/browser-modules', name)) });
  });
}
