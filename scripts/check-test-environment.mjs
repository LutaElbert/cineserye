import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Mandatory in acceptance/CI: unavailable native tools must fail, not turn the
// renderer suites into a misleading green capability-dependent skip.
for (const [binary, args] of [['node', ['--version']], ['npm', ['--version']], ['ffmpeg', ['-version']], ['ffprobe', ['-version']]]) {
  console.log(execFileSync(binary, args, { encoding: 'utf8' }).split('\n')[0]);
}
console.log('lockfile sha256:', createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'));
console.log('Playwright:', JSON.parse(readFileSync('node_modules/@playwright/test/package.json', 'utf8')).version);
console.log('Browser revisions:', readFileSync('node_modules/playwright-core/browsers.json', 'utf8'));
