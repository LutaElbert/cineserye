import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const EXPECTED_ACCOUNT = 'elbertluta@gmail.com';
const EXPECTED_PROJECT = 'cineserye';

function gcloud(args) {
  return execFileSync('gcloud', [...args, '--quiet'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function readAdcSummary() {
  const configuredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const adcPath = configuredPath || join(
    process.env.CLOUDSDK_CONFIG || join(homedir(), '.config', 'gcloud'),
    'application_default_credentials.json',
  );
  if (!existsSync(adcPath)) return { present: false, quotaProject: null, credentialType: null };
  const value = JSON.parse(readFileSync(adcPath, 'utf8'));
  return {
    present: true,
    quotaProject: typeof value.quota_project_id === 'string' ? value.quota_project_id : null,
    credentialType: typeof value.type === 'string' ? value.type : 'unknown',
  };
}

try {
  const activeAccounts = gcloud(['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)'])
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const configuredProject = gcloud(['config', 'get-value', 'project']);
  const adc = readAdcSummary();
  const vertexApiEnabled = gcloud([
    'services', 'list', '--enabled', `--project=${EXPECTED_PROJECT}`, `--account=${EXPECTED_ACCOUNT}`,
    '--filter=name:aiplatform.googleapis.com', '--format=value(name)',
  ]) === 'aiplatform.googleapis.com';
  const blockers = [
    ...(activeAccounts.length !== 1 || activeAccounts[0] !== EXPECTED_ACCOUNT
      ? [`Active gcloud account must be exactly ${EXPECTED_ACCOUNT}.`] : []),
    ...(configuredProject !== EXPECTED_PROJECT ? [`Configured gcloud project must be ${EXPECTED_PROJECT}.`] : []),
    ...(!adc.present ? ['Application Default Credentials are missing.'] : []),
    ...(adc.quotaProject !== EXPECTED_PROJECT ? [`ADC quota project must be ${EXPECTED_PROJECT}.`] : []),
    ...(!vertexApiEnabled ? ['Vertex AI API is not enabled or could not be verified.'] : []),
  ];
  console.log(JSON.stringify({
    ready: blockers.length === 0,
    account: { expected: EXPECTED_ACCOUNT, active: activeAccounts[0] ?? null },
    project: { expected: EXPECTED_PROJECT, configured: configuredProject || null },
    adc: { present: adc.present, quotaProject: adc.quotaProject, credentialType: adc.credentialType },
    vertexApiEnabled,
    blockers,
    note: 'Read-only check; no account, project, API, IAM, budget, or credential setting was changed.',
  }, null, 2));
  if (blockers.length) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    ready: false,
    blockers: ['The read-only gcloud preflight could not complete.'],
    error: error instanceof Error ? error.message.replace(/[\r\n].*/s, '') : 'Unknown error',
  }, null, 2));
  process.exitCode = 1;
}
