# Cineserye

Cineserye is a local-first, agent-ready cinema workspace for developing stories from premise to scene to shot. This repository is a private, independent project generated from `LutaElbert/canvas-starter`; it has its own Git history, dependencies, browser storage namespace, Cloudflare configuration, and product roadmap.

This baseline deliberately stops before a real copilot. It includes a local, typed mock scene planner for validating the prompt-first experience, but contains no AI provider, API keys, authentication, cloud data store, or media-generation integration, and it has not been deployed.

## Foundation

- React Flow canvas with selection, pan, zoom, minimap, connectors, drag, resize, ordering, visibility, and locking.
- Rich concept titles and notes, raster images, editable vector layers, automatic layout, and branch workflows.
- Undo/redo, IndexedDB autosave, local checkpoints, strict restore validation, portable `.cineserye` backups, and editable SVG export.
- Keyboard workflows, reduced-motion support, responsive panels, accessible labels, and automated accessibility checks.
- Unit, browser, compatibility, type, lint, build, and dependency-audit gates.
- Security headers and a privacy baseline designed for an on-device application.
- A prompt-first mock scene planner with character, location, prop, shot, source, continuity, and illustrative generation-cost views.
- An automatic Project Outline that derives production groups, chronological shots, duration, and expected cost from the active cinema canvas without storing a second hierarchy.
- Ghost proposal review with atomic acceptance, rejection without mutation, and one-step undo.

The initial story canvas is a linear fixture:

```text
Story Premise → Scene 01 → Shot 01
```

## Architecture boundaries

The reusable editor remains in `app/editor`. Cinema-specific models, prompt artifacts, mock data, and the planned extension registry live in `app/domain/cinema`. The planned node vocabulary is `scene`, `shot`, `character`, `asset`, and `agent-run`; none is activated in the persistent editor schema yet. The mock experience deliberately uses existing concept nodes as visual hosts and keeps full cinema details in a typed sidecar until the UI is approved.

Future copilot output must enter through `app/editor/canvas-commands.ts`. That boundary accepts an untrusted command proposal, applies it only to a clone, enforces lock and graph rules, validates the complete result, and returns one atomic document. The mock planner now uses that result for a non-persistent ghost preview and a single undoable commit. It does not call a provider or mutate the saved document before approval.

## Mock scene-planner walkthrough

1. Select `Scene 01` or choose **Plan scene** in the top bar.
2. Wait for the local mock proposal for *The Reel That Knows Tomorrow*.
3. Browse the generated Planning, Characters, Locations, Props, Visual Elements, and Shots groups in the Project Outline.
4. Select any outline item to focus its corresponding ghost node.
5. Review **Details**, **Prompt**, **Sources**, and **Cost** in the inspector.
6. Reject the proposal to leave the canvas unchanged, or accept it as one undoable operation.

The mock uses no external requests. Research cards and prices are visibly marked illustrative.

See the [implementation plan](docs/IMPLEMENTATION_PLAN.md), [architecture and extension guide](docs/ARCHITECTURE.md), and [Cineserye foundation test plan](CINESERYE_FOUNDATION_TEST_PLAN.md).

## Local development

Requirements:

- Node.js 22.13 or newer
- npm
- A current Chrome, Edge, Firefox, or Safari release

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Verification

```sh
npm run check
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=high
npx playwright install chromium firefox webkit
npm run test:e2e
```

CI builds the application and runs Playwright against the local production Cloudflare Worker in Chromium, Firefox, and WebKit. Verification does not deploy the Worker.

## Storage, backup, and export identifiers

- IndexedDB database: `cineserye-local`
- Portable project format: `cineserye-project`
- Portable backup extension: `.cineserye`
- Cloudflare Worker name: `cineserye`
- Temporary brand mark: `C`

The browser owns the working copy. Download a `.cineserye` backup before clearing site data or changing devices. Review [PRIVACY.md](PRIVACY.md) before adding any provider or server-side feature.

## Deployment

Cloudflare configuration is retained for future preview and production workflows, but this baseline is not deployed. No D1, R2, or application user-data binding is configured. A later deployment must be an explicit, separately reviewed action.
