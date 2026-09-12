import { build } from 'vite';

export default async function setup() {
  // These are the real storage/domain modules, compiled for browser integration
  // tests. Playwright intercepts their URLs; no test endpoint enters the app build.
  // Built servers deliberately do not expose Vite's /app/*.ts source loader.
  await build({ configFile: false, logLevel: 'warn', define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { outDir: 'artifacts/simplified-flow/browser-modules', emptyOutDir: false,
      lib: { entry: { persistence: 'app/editor/persistence.ts', 'project-data': 'app/domain/cinema/project-data.ts',
        'initial-document': 'app/editor/initial-document.ts', 'document-file': 'app/editor/document-file.ts' },
      formats: ['es'], fileName: (_format, name) => `${name}.js` } } });
}
