import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, readFile, appendFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const runtime = process.argv[2];
if (!['node-fixture', 'worker'].includes(runtime)) throw new Error('Choose node-fixture or worker.');
const probe = createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const baseURL = `http://localhost:${port}`;
const env = { ...process.env, CINESERYE_E2E_RUNTIME: runtime, PLAYWRIGHT_BASE_URL: baseURL,
  CINESERYE_E2E_FIXTURE: 'true', CINESERYE_PROVIDER_MODE: 'fixture', CINESERYE_LIVE_ENABLED: 'false',
  CINESERYE_LOCAL_ASSEMBLY_ENABLED: 'true', CINESERYE_ENABLE_CLOUD_TELEMETRY: 'false',
  CINESERYE_RUN_VIDEO_SMOKE: '0', CINESERYE_RUN_STORYBOARD_SMOKE: '0', CINESERYE_RUN_VERTEX_SMOKE: '0', CINESERYE_RUN_STORY_LIVE_SMOKE: '0',
  WRANGLER_SEND_METRICS: 'false' };
// Never pass provider credentials to a fixture process. No .env files belong in
// an acceptance checkout; callers use a fresh worktree/checkout with no secrets.
for (const key of Object.keys(env)) if (/^(GOOGLE_|GCLOUD_|PARALLEL_|GEMINI_|CLOUDFLARE_API_)/.test(key)) delete env[key];
const command = runtime === 'node-fixture' ? ['vinext', 'start', '--port', String(port), '--hostname', 'localhost']
  : ['wrangler', 'dev', '--local', '--config', 'dist/server/wrangler.json', '--port', String(port)];
const server = spawn(`./node_modules/.bin/${command[0]}`, command.slice(1), { env, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
server.stdout.on('data', (data) => { logs = (logs + data).slice(-24_000); });
server.stderr.on('data', (data) => { logs = (logs + data).slice(-24_000); });
server.on('error', (error) => { logs += error.message; });
let browserTests;
const stop = () => { browserTests?.kill('SIGTERM'); server.kill('SIGTERM'); };
process.once('SIGINT', stop); process.once('SIGTERM', stop);
try {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (server.exitCode !== null) throw new Error(`Test server exited: ${logs}`);
    try {
      const response = await fetch(`${baseURL}/api/cinema/workflow-capabilities`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) {
        const capability = await response.json();
        if (capability.mode !== 'fixture' || capability.runtime !== (runtime === 'node-fixture' ? 'local-node' : 'unsupported')) {
          throw new Error(`Runtime identity mismatch: ${JSON.stringify({ mode: capability.mode, runtime: capability.runtime })}`);
        }
        ready = true; break;
      }
    } catch (error) { if (String(error).includes('identity mismatch')) throw error; }
    await delay(500);
  }
  if (!ready) throw new Error(`Built server did not become ready: ${logs}`);
  console.log(`Testing built ${runtime} at ${baseURL}; fixture-only, retries disabled.`);
  browserTests = spawn('./node_modules/.bin/playwright', ['test', '--workers=3', ...process.argv.slice(3)], { env, stdio: 'inherit' });
  const exitCode = await new Promise((resolve, reject) => { browserTests.once('error', reject); browserTests.once('exit', resolve); });
  const report = JSON.parse(await readFile(`artifacts/simplified-flow/${runtime}.json`, 'utf8'));
  const tests = [];
  const visit = (suite) => { for (const spec of suite.specs ?? []) tests.push(...spec.tests); for (const nested of suite.suites ?? []) visit(nested); };
  for (const suite of report.suites) visit(suite);
  const counts = { passed: 0, failed: 0, skipped: 0, interrupted: 0, notRun: 0 };
  for (const test of tests) {
    const result = test.results.at(-1);
    if (!result || result.status === 'skipped' && test.expectedStatus !== 'skipped') counts.notRun++;
    else if (result.status === 'interrupted') counts.interrupted++;
    else if (result.status === 'skipped') counts.skipped++;
    else if (result.status === 'passed') counts.passed++;
    else counts.failed++;
  }
  const summary = `${runtime}: total=${tests.length}, ${Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(', ')}; flaky=${report.stats.flaky}\n`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  process.exitCode = exitCode ?? 1;
} finally {
  stop();
  await mkdir('test-results', { recursive: true });
  // Local fixture logs only; CI does not upload artifacts or extend storage use.
  await appendFile(`test-results/${runtime}-server.log`, logs);
}
