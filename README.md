# Cineserye

Cineserye is a local-first, agent-ready cinema workspace for developing stories from premise to scene to shot. This repository is a private, independent project generated from `LutaElbert/canvas-starter`; it has its own Git history, dependencies, browser storage namespace, Cloudflare configuration, and product roadmap.

The visual pre-production MVP is now implemented through Sprint 4: one selected scene becomes a cited, budget-aware, chronological prompt package that remains a preview until acceptance; creators can then curate rights-aware references and generate one to four storyboard still variants for a selected accepted shot. Deterministic fixture mode is the default. Optional live planning uses Parallel Search and Gemini on Vertex AI through the official TypeScript ADK; optional storyboard stills use an environment-selected Vertex image model. Cineserye still contains no authentication, cloud project store, video generation, or deployment.

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
- Cinema-aware manual creation for story, scene, shot, character, location, prop, visual-element, and note drafts, with contextual child/sibling actions.
- A guarded empty-canvas state with same-session undo, a persisted last-non-empty recovery copy, clean scene bootstrap, backup restore, and an explicit sample choice.
- A scene-level Reference Deck for validated local uploads, existing canvas images, and non-fetched external inspiration links, with explicit provenance, rights, allowed-use, approval, pinning, search, filtering, and shot usage.
- Content-addressed local media storage with SHA-256 deduplication, safe orphan cleanup, and version-6 `.cineserye` backups that embed and verify required media.
- A one-shot Storyboard Workbench with an offline fixture, an opt-in Vertex adapter, explicit preflight confirmation, server output/spend caps, cancellation, three-variant review, exact provenance, and one approved shot anchor.

The initial story canvas is a linear fixture:

```text
Story Premise → Scene 01 → Shot 01
```

## Architecture boundaries

The reusable editor remains in `app/editor`. Cinema-specific records, prompt artifacts, fixtures, and presentation projection live in `app/domain/cinema`. The cinema sidecar is a versioned, runtime-validated part of the persistent editor document and portable backup. Existing concept nodes remain generic visual hosts for the `scene`, `shot`, `character`, `asset`, and `agent-run` records.

All copilot output enters through `app/editor/canvas-commands.ts`. That boundary accepts an untrusted command proposal, applies it only to a clone, enforces lock and graph rules, validates the complete result, and returns one atomic document. Neither fixture nor live providers can write directly to React state, IndexedDB, backups, or exports.

## Scene-planner walkthrough

1. On a new browser profile, choose **Start a scene** for a neutral workspace or **Explore sample** for the local demonstration project. Neither choice contacts a provider.
2. Select the scene, write its creative intent in the node body, then choose **Generate shot plan**.
3. Confirm creation mode, format, tone, location, duration, story beats, and must-include or must-avoid details. Set AI-generation credits or currency separately from physical-production constraints such as equipment and production band.
4. In live mode only, explicitly consent to sending that selected brief to Parallel and Vertex AI.
5. Browse the generated Planning, Characters, Locations, Props, Visual Elements, and Shots groups in the Project Outline.
6. Select any outline item to focus its corresponding ghost node.
7. Review **Details**, **Prompt**, **Sources**, and **Cost** in the inspector. Research starts as **Needs verification**; pin useful sources, mark them supported, or remove irrelevant items before acceptance.
8. Reject the proposal to leave the canvas unchanged, or accept it as one undoable operation.

## Visual pre-production walkthrough

1. Select an accepted scene or shot and open **Visuals**.
2. Upload a PNG/JPEG/WebP image, attach an existing raster canvas layer, or add an HTTPS inspiration link. External links are never fetched automatically.
3. Categorize the reference, confirm its rights, enable image-generation use where permitted, approve it, and attach it to the selected shot. Inspiration-only items remain visible but are excluded from provider payloads.
4. Review the inherited storyboard prompt, output count, model profile, approved references, and estimate. Changing the output count clears the confirmation.
5. Confirm and generate one to four still variants. Fixture mode is offline and costs $0; live mode requires server-side pricing and a maximum estimated-spend setting before it can run.
6. Compare, reject, regenerate, or approve one frame as the shot anchor. The accepted shot and plan revision remain unchanged.
7. Download a `.cineserye` backup to carry the validated media and provenance to another browser profile.

## Manual canvas building

Use **Add** in the Layers panel or **Add filmmaking layer** in the canvas toolbar to open the creation palette. It exposes cinema roles instead of generic templates and enforces simple prerequisites—for example, a shot requires a scene. When a scene is selected, a new shot, character, location, prop, visual element, or note is connected beneath it automatically. Selected story, scene, and shot cards also expose contextual actions such as **Add scene**, **Add shot**, and **Add next shot**.

These drafts remain generic canvas concept nodes with a validated `domainType`; the canvas engine stores but does not interpret that value. The cinema domain layer owns role labels, naming, relationship rules, and conversion behavior. Manual creation and role conversion use the same validated command boundary reserved for future copilot proposals.

If every unlocked layer is deleted, Cineserye asks for confirmation and stores the last non-empty document locally before applying the deletion. The empty canvas then offers **Undo delete** during the current session or **Recover last canvas** after reload. It also provides explicit choices to start with a scene, add a layer, restore a backup, or explore the sample. Sample data is never inserted automatically.

The active provider mode is always visible in the toolbar. Fixture mode uses no external requests. Live research cards link to their normalized sources, and a shot is cited only when the planner explicitly returns a valid relationship—Cineserye never substitutes a fallback citation. Generation prices remain visibly illustrative or unpriced in both modes, with profile assumptions shown alongside the estimate.

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
# Storyboard stills remain blocked until both values are configured.
export CINESERYE_VERTEX_IMAGE_MODEL=gemini-2.5-flash-image
export CINESERYE_STORYBOARD_USD_PER_IMAGE='set-current-provider-price'
export CINESERYE_STORYBOARD_MAX_ESTIMATED_USD='set-a-small-per-request-limit'
export CINESERYE_STORYBOARD_MAX_OUTPUTS=4
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

The separate storyboard smoke also spends credits and is never part of ordinary CI:

```sh
CINESERYE_RUN_STORYBOARD_SMOKE=1 npx vitest run app/server/cinema/storyboard-live.test.ts --config vitest.config.ts
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
