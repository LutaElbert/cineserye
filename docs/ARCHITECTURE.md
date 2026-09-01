# Cineserye architecture and extension guide

Cineserye keeps its canvas engine generic, cinema meaning in a versioned domain sidecar, and every agent behind a validated proposal boundary.

```text
selected scene + creator constraints
                |
        server-only coordinator
          /                 \
 Parallel Search       Vertex Gemini via ADK
          \                 /
        validated cinema sidecar
                |
 deterministic CanvasCommandProposal compiler
                |
 locked ghost preview → accept or reject
                |
 editor history, graph rules, IndexedDB, backup/export
```

## Generic editor foundation

`app/editor` owns selection, viewport behavior, drag, resize, connections, ordering, undo/redo, graph integrity, IndexedDB persistence, checkpoints, backup/restore, SVG export, keyboard support, responsive panels, accessibility, and security limits.

Provider prompts, credentials, model SDKs, research logic, and cinema business rules do not belong in this layer. Generic canvas fixes should remain reusable independently of Cineserye's product decisions.

`app/editor/canvas-commands.ts` is the only agent mutation route. It treats commands as untrusted, limits the batch, applies them to a clone, respects locks and connection rules, validates the complete graph after every command, and returns affected IDs without mutating editor state.

Generic concept nodes may carry an optional bounded `domainType`. The editor validates, persists, and includes the value in portable backups but does not assign product meaning to it. `app/domain/cinema/manual-creation.ts` maps Cineserye's `cinema.story`, `cinema.scene`, `cinema.shot`, `cinema.character`, `cinema.location`, `cinema.prop`, `cinema.visual-element`, and `cinema.note` types to labels, naming, styles, and contextual relationship rules. Manual creation and role conversion compile to `CanvasCommandProposal` and therefore exercise the same mutation boundary as future agent output.

Full-canvas deletion uses React Flow's pre-delete boundary. It confirms the destructive intent and writes a validated `last-non-empty` document into the existing IndexedDB document store before removal. Undo remains the primary same-session route; the persisted recovery copy handles reload. Recovery replaces the complete document atomically, clears the recovery copy after success, and never merges potentially inconsistent fragments.

## Cinema domain and presentation

`app/domain/cinema/project-data.ts` defines the persisted version-2 cinema sidecar. Valid V1 sidecars migrate deterministically into a stable project identity and one recoverable revision; Scene Brief V1 values separately migrate into the V2 brief contract. The sidecar contains relational records for:

- `scene`: brief, synopsis, purpose, continuity notes, and chronological shot IDs;
- `shot`: scene, order, duration, framing, movement, audio, risk, and continuity node IDs;
- `character`: appearance, voice, and wardrobe references;
- `asset`: location, prop, visual element, reference, or other reusable item with provenance;
- `agent-run`: lifecycle, providers/model, warnings, prompts, sources, and timestamps;
- prompt records;
- research-source records with supported, needs-verification, or irrelevant review state plus creator pinning and usage relationships;
- illustrative, credits-based, or explicitly unpriced cost records with a versioned profile and visible assumptions.
- immutable accepted-plan revision snapshots with predecessor links and one active revision.

Runtime validation resolves every scene, shot, character, asset, prompt, source, cost, run, and host canvas node relationship. The sidecar participates in document migrations, IndexedDB autosave, checkpoints, `.cineserye` backup/restore, and undo/redo.

`app/domain/cinema/project-presentation.ts` projects those persistent records into the read-only view consumed by canvas cards, the inspector, and the automatic Project Outline. The outline stores only local collapse state; node existence, selection, visibility, locking, proposal status, duration, and costs derive from the active preview or saved document.

## Provider and agent boundary

`app/server/cinema` is server-only:

- `provider-contracts.ts` separates research from shot planning.
- `parallel-research-provider.ts` submits four bounded queries, accepts only HTTP(S) URLs, deduplicates results, caps response size/count, and normalizes citations.
- `vertex-adk-shot-planner.ts` runs an official TypeScript ADK `LlmAgent` against Vertex AI using ADC and a lean response schema.
- `planner-output.ts` applies the strict Zod boundary, resolves zero-based continuity indexes, reconciles durations exactly, computes cost views from a versioned profile, and produces versioned domain records. It accepts only explicit valid source IDs and never invents fallback citations.
- `provider-resilience.ts` owns cancellation, timeouts, and at most one retry.
- `telemetry.ts` emits content-free phase events with `scene-planner-v1` and `no-content-v1` identifiers.
- `proposal-compiler.ts` deterministically compiles the validated sidecar into generic canvas commands. The model never authors editor commands.

Fixture providers remain the default for deterministic UI and pull-request tests. Live mode is enabled only by server environment configuration and requires explicit per-request content-transfer consent in both the UI and API boundary.

## Review and persistence sequence

1. The browser sends one validated Scene Brief V2 after the creator reviews the creation, generation-budget, and physical-production sections.
2. Research runs before planning; neither provider can access editor mutation or storage functions.
3. Strict validation and deterministic compilation complete on the server.
4. The browser applies the command proposal to a cloned document through the generic boundary.
5. The browser writes the validated ready proposal to the local `pending-proposals` store with a fingerprint of the accepted source document before exposing review.
6. The creator inspects locked ghost nodes, prompts, linked sources, continuity, and costs. Source curation mutates only the preview until acceptance.
7. Reload restores an exact matching pending proposal without another provider call; a changed source fingerprint quarantines it.
8. Reject discards the preview byte-for-byte. Accept records one history snapshot, commits nodes/edges/sidecar once, and appends an immutable plan revision.
9. One undo reverses the entire accepted proposal; redo and reload restore it. Accepted shot edits use a cinema-domain command that updates the sidecar and derived host atomically and marks owned prompts stale.
10. Restoring a superseded revision rehydrates its immutable snapshot, gives every generated record a fresh restore-run identity, compiles new derived hosts through the same canvas boundary, and accepts it as a successor revision. The formerly current revision remains immutable in history.

## Evaluation and observability

`tests/eval` contains a versioned, Agents CLI–compatible three-case dataset and scoring configuration. `evaluation-adapter.ts` creates a versioned artifact containing the brief, validated result, provider configuration, scoring policy, run ID, and content-free trace. Vitest is the deterministic gate for schemas, citations, duration, continuity, costs, mutation safety, and telemetry privacy. `vertex-adk-live.test.ts` is opt-in and proves the real Vertex/ADK contract with local ADC while using a local research fixture.

The browser retains at most 50 content-free run traces in the local `agent-traces` store. The provider-mode badge exposes safe configuration metadata and trace JSON export; the export never contains scenes, prompts, research findings, citations, or credentials. Cloud trace or completion export is not configured. Prompt/response capture and completion upload are disabled unless `CINESERYE_ENABLE_CLOUD_TELEMETRY=true` is deliberately supplied after a retention review.

## Deliberately absent

- authentication, accounts, collaboration, or cloud project storage;
- image, storyboard-frame, audio, or video generation;
- API-key entry in the browser;
- automatic proposal acceptance or background autonomy;
- A2A exposure, deployment, or provisioned observability infrastructure.

The next media-facing phase should begin only after a creator approves text prompts: generate one storyboard reference frame for one accepted shot, preserve provenance, and keep a separate approval boundary before any video generation.
