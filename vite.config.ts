import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

export default defineConfig(({ command }) => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: { watch: {
      // Test evidence is not application source. Watching generated traces can
      // cause reloads while a user or a browser test is interacting with a node.
      ignored: ['**/artifacts/**', '**/test-results/**', '**/playwright-report/**'],
      ...(isCodexSeatbeltSandbox ? { useFsEvents: false, usePolling: true } : {}),
    } },
    plugins: [
      vinext(),
      ...(command === 'build'
        ? [cloudflare({
            viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
          })]
        : []),
    ],
  };
});
