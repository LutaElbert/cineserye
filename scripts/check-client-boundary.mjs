import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDirectory = fileURLToPath(new URL('../dist/client/', import.meta.url));
const forbiddenMarkers = [
  'PARALLEL_API_KEY',
  'GOOGLE_CLOUD_PROJECT',
  'CINESERYE_VERTEX_MODEL',
  'fixture-research',
  'fixture-shot-planner',
  'cineserye.copilot',
];

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }))).flat();
}

const matches = [];
for (const path of await files(clientDirectory)) {
  if (!/\.(?:js|css|html|json)$/.test(path)) continue;
  const source = await readFile(path, 'utf8');
  for (const marker of forbiddenMarkers) {
    if (source.includes(marker)) matches.push(`${marker} in ${path}`);
  }
}

if (matches.length) {
  console.error(`Server-only provider data leaked into the client build:\n${matches.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Client boundary check passed: provider configuration and adapter code remain server-only.');
}
