import base from '../playwright.config';
import path from 'node:path';

export default {
  ...base,
  testDir: path.resolve('e2e'),
  globalSetup: path.resolve('scripts/e2e-setup.ts'),
  outputDir: path.resolve('test-results/node-fixture'),
  reporter: [
    ['list'],
    ['json', { outputFile: path.resolve('artifacts/simplified-flow/node-fixture.json') }],
    [path.resolve('ci-diagnostics/reporter.mjs')],
  ],
};
