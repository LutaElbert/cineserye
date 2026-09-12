import { readFileSync } from 'node:fs';

const [reportPath, expectedText] = process.argv.slice(2);
const expected = Number(expectedText);
if (!reportPath || !Number.isSafeInteger(expected) || expected < 1) {
  throw new Error('Usage: node scripts/assert-renderer-report.mjs <playwright-report.json> <expected-count>');
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const rendererTests = [];
const visit = (suite) => {
  for (const spec of suite.specs ?? []) {
    if (spec.file?.endsWith('final-cut-export.spec.ts')) rendererTests.push(...spec.tests);
  }
  for (const nested of suite.suites ?? []) visit(nested);
};
for (const suite of report.suites ?? []) visit(suite);

const passed = rendererTests.filter((test) => test.results?.at(-1)?.status === 'passed').length;
const skipped = rendererTests.filter((test) => test.results?.at(-1)?.status === 'skipped').length;
const failed = rendererTests.length - passed - skipped;
console.log(`native renderer proof: expected=${expected}, executed=${rendererTests.length}, passed=${passed}, failed=${failed}, skipped=${skipped}`);
if (rendererTests.length !== expected || passed !== expected || failed !== 0 || skipped !== 0) {
  throw new Error('Native renderer proof count mismatch; capability skips cannot satisfy the renderer gate.');
}
