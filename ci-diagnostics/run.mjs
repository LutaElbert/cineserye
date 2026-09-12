import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

const browser = process.argv[2];
if (!['chromium', 'webkit'].includes(browser)) throw Error('Choose chromium or webkit.');
const config = '--config=ci-diagnostics/playwright.config.ts';
let selection;
if (browser === 'chromium') {
  selection = [];
  for (const file of ['story-assistant-stress.spec.ts', 'stress.spec.ts']) {
    const original = await readFile(`e2e/${file}`, 'utf8');
    const target = `e2e/ci-diagnostic-${file}`;
    // Generated copies preserve every original test statement and import path.
    // Only a diagnostic beforeEach observer is added; product files are untouched.
    await writeFile(target, `import { installRestoreProbe } from '../ci-diagnostics/restore-probe';\ninstallRestoreProbe();\n${original}`);
    selection.push(target);
  }
} else {
  selection = ['e2e/media-response-safety.spec.ts', 'e2e/retained-clip-recovery.spec.ts',
    'e2e/premise-production-critic.spec.ts', 'e2e/scene-planner.spec.ts', '--grep',
    'empty-store backup restores images but cannot (approve a|render an approved) metadata-only video$|restored approved clip recovers only its identical retained bytes: (available|expired|different-bytes)$|critic story and assistant at desktop$|recovers a pending proposal, edits an accepted shot, and preserves revision history$'];
}
const env = { ...process.env, CINESERYE_E2E_RUNTIME: 'node-fixture' };
const args = [config, `--project=${browser}`, '--workers=3', ...selection];
const listed = spawnSync(process.execPath, ['node_modules/playwright/cli.js', 'test', ...args, '--list', '--reporter=list'], { env, encoding: 'utf8' });
process.stdout.write(listed.stdout ?? ''); process.stderr.write(listed.stderr ?? '');
if (listed.status !== 0 || !listed.stdout.includes(`Total: ${browser === 'chromium' ? 2 : 7} tests`)) throw Error('Diagnostic test selection mismatch.');
if (process.argv.includes('--list-only')) process.exit(0);
const run = spawnSync(process.execPath, ['scripts/test-built.mjs', 'node-fixture', ...args], { env, stdio: 'inherit' });
process.exitCode = run.status ?? 1;
