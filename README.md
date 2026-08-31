# Canvas Starter

Canvas Starter is a production-minded foundation for apps built around an infinite visual workspace. It provides the editor mechanics, local persistence, import/export, accessibility, and regression coverage so a derived product can focus on its own node types and workflows.

It is a clean, independent snapshot with its own history and product-neutral defaults, ready to become a GitHub template.

## What is included

- React Flow canvas with selection, pan, zoom, minimap, connectors, drag, resize, ordering, visibility, and locking.
- Concept, raster-image, vector-group, and vector-path layer models.
- Rich concept titles and notes with links, lists, numbering, and checklists.
- Layers panel, inspector, quick templates, search, multi-select alignment, branch creation, collapse, and automatic layout.
- Undo/redo, IndexedDB autosave, local checkpoints, portable `.canvas` backups, restore validation, and editable SVG export.
- Keyboard workflows, reduced-motion support, responsive desktop/mobile panels, and automated accessibility checks.
- Strict graph and document validation, image safety limits, security headers, unit tests, Playwright coverage, and Cloudflare Workers deployment scripts.
- A local image-vectorization implementation retained behind a disabled feature flag.

AI agents, cloud accounts, collaboration, media generation, and product-specific nodes are deliberately not included. A derived app should add those as a separate domain layer instead of coupling them to the canvas engine.

## Requirements

- Node.js 22.13 or newer
- npm
- A current Chrome, Edge, Firefox, or Safari release

## Start a derived project

After this repository is marked as a GitHub template, create a repository from it in the GitHub UI or with:

```sh
gh repo create OWNER/APP_NAME --private --template LutaElbert/canvas-starter --clone
cd APP_NAME
npm ci
npm run dev
```

Open `http://localhost:3000`.

For an existing clone, begin in these extension points:

1. Change product name, storage namespace, backup extension, and export labels in `app/editor/config.ts`.
2. Replace the example canvas in `app/editor/initial-document.ts`.
3. Add domain node data to `app/editor/types.ts`, renderers and controls to `app/editor/Editor.tsx`, and import validation to `app/editor/document-file.ts`.
4. Put agent/provider code outside the editor and expose narrow, validated canvas commands to it.

See [Extending Canvas Starter](docs/EXTENDING.md) for the recommended boundary and a Cineserye example.

## Editing shortcuts

- `Enter` edits the selected concept.
- Double-click a layer name or press `F2` to rename it; `Enter` commits and `Escape` cancels.
- `Tab` adds a child when an unlocked concept or image node has canvas focus.
- `Shift+Enter` adds a sibling when an unlocked concept or image node has canvas focus.
- `Cmd/Ctrl+Enter` finishes rich-text editing; `Escape` cancels it.
- `Cmd/Ctrl+B`, `Cmd/Ctrl+I`, `Cmd/Ctrl+U`, and `Cmd/Ctrl+Shift+X` format selected text.
- `Cmd/Ctrl+K` opens the link editor.
- `Cmd/Ctrl+Z` and `Cmd/Ctrl+Shift+Z` undo and redo canvas operations when text is not being edited.

## Verification

```sh
npx playwright install chromium firefox webkit
npm run check
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm audit --audit-level=high
```

CI builds the app and runs the browser suite against the local Cloudflare Worker in Chromium, Firefox, and WebKit. The coverage includes import, editing, graph validation, locked-layer behavior, search, branch operations, checkpoints, backup/restore, persistence, accessibility, export, mobile panels, and a 500-layer stress fixture. See [the layer and connection test plan](LAYER_CONNECTION_TEST_PLAN.md) for the behavioral contract.

## Cloudflare Workers

No D1, R2, or server-side user-data binding is required by the starter.

```sh
npx wrangler login
npm run deploy:preview
```

After preview QA, deploy the tested commit with `npm run deploy`. Set `CLOUDFLARE_ACCOUNT_ID` in the environment or add the non-secret account ID to `wrangler.jsonc`. Never commit an API token.

## Local data and privacy

The starter keeps imported images and documents in the browser. Browser storage can still be cleared by the user, browser, device policy, or storage pressure, so download a portable `.canvas` backup before changing devices or clearing site data. Review [PRIVACY.md](PRIVACY.md) before adding any cloud or AI provider.
