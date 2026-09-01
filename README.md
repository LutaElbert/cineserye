# Cineserye

Cineserye is a local-first, agent-ready cinema workspace for developing stories from premise to scene to shot. This repository is a private, independent project generated from `LutaElbert/canvas-starter`; it has its own Git history, dependencies, browser storage namespace, Cloudflare configuration, and product roadmap.

The first copilot vertical slice is now implemented: one selected scene becomes a cited, budget-aware, chronological prompt package that remains a preview until the creator accepts it. Deterministic fixture mode is the default. Optional live mode uses Parallel Search and Gemini on Vertex AI through the official TypeScript ADK. Cineserye still contains no authentication, cloud project store, image/video generation, or deployment.

## Foundation

- React Flow canvas with selection, pan, zoom, minimap, connectors, drag, resize, ordering, visibility, and locking.
- Rich concept titles and notes, raster images, editable vector layers, automatic layout, and branch workflows.
- Undo/redo, IndexedDB autosave, local checkpoints, strict restore validation, portable `.cineserye` backups, and editable SVG export.
- Keyboard workflows, reduced-motion support, responsive panels, accessible labels, and automated accessibility checks.
- Unit, browser, compatibility, type, lint, build, and dependency-audit gates.
- Security headers and a privacy baseline designed for an on-device application.
- A prompt-first scene planner with character, location, prop, shot, cited source, continuity, and illustrative generation-cost views.
- An automatic Project Outline that derives production groups, chronological shots, duration, and expected cost from the active cinema canvas without storing a second hierarchy.
- Server-only provider contracts, bounded retry/timeout/cancellation, runtime output validation, and content-free structured telemetry.
- Ghost proposal review with atomic acceptance, rejection without mutation, and one-step undo.

The initial story canvas is a linear fixture:

```text
Story Premise → Scene 01 → Shot 01
```

## Architecture boundaries

The reusable editor remains in `app/editor`. Cinema-specific records, prompt artifacts, fixtures, and presentation projection live in `app/domain/cinema`. The cinema sidecar is a versioned, runtime-validated part of the persistent editor document and portable backup. Existing concept nodes remain generic visual hosts for the `scene`, `shot`, `character`, `asset`, and `agent-run` records.

All copilot output enters through `app/editor/canvas-commands.ts`. That boundary accepts an untrusted command proposal, applies it only to a clone, enforces lock and graph rules, validates the complete result, and returns one atomic document. Neither fixture nor live providers can write directly to React state, IndexedDB, backups, or exports.

## Scene-planner walkthrough

1. Select `Scene 01` or choose **Plan scene** in the top bar.
2. Confirm tone, location/period, production band, optional generation-cost ceiling, target duration, and available equipment.
3. In live mode only, explicitly consent to sending that selected brief to Parallel and Vertex AI.
4. Browse the generated Planning, Characters, Locations, Props, Visual Elements, and Shots groups in the Project Outline.
5. Select any outline item to focus its corresponding ghost node.
6. Review **Details**, **Prompt**, **Sources**, and **Cost** in the inspector.
7. Reject the proposal to leave the canvas unchanged, or accept it as one undoable operation.

Fixture mode uses no external requests. Live research cards link to their normalized sources. Generation prices remain visibly illustrative in both modes.

See the [remaining-sprints implementation plan](docs/SPRINT_IMPLEMENTATION_PLAN.md), [current-feature audit](docs/FEATURE_AUDIT.md), [initial vertical-slice plan](docs/IMPLEMENTATION_PLAN.md), [architecture and extension guide](docs/ARCHITECTURE.md), and [Cineserye foundation test plan](CINESERYE_FOUNDATION_TEST_PLAN.md).

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

### Optional live providers

Authenticate local Vertex access with Application Default Credentials, then start Cineserye with server-only environment variables:

```sh
gcloud auth application-default login
gcloud config set project cineserye

export CINESERYE_PROVIDER_MODE=live
export PARALLEL_API_KEY='set-this-outside-git'
export GOOGLE_CLOUD_PROJECT=cineserye
export GOOGLE_CLOUD_LOCATION=global
export CINESERYE_VERTEX_MODEL=gemini-3.7-flash
npm run dev
```

Do not prefix provider variables with `NEXT_PUBLIC_`. Cloud telemetry and full prompt/response logging remain off unless `CINESERYE_ENABLE_CLOUD_TELEMETRY=true` is deliberately set after a content-retention review.

## Verification

```sh
npm run check
npm run typecheck
npm run lint
npm test
npm run build
npm run check:client-boundary
npm audit --audit-level=high
npx playwright install chromium firefox webkit
npm run test:e2e
```

The opt-in local Vertex/ADK contract smoke uses credits and never calls Parallel:

```sh
CINESERYE_RUN_VERTEX_SMOKE=1 npx vitest run app/server/cinema/vertex-adk-live.test.ts --config vitest.config.ts
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

Cloudflare configuration is retained for future preview and production workflows, but this application has not been deployed. No D1, R2, or application user-data binding is configured. A later deployment must be an explicit, separately reviewed action.
