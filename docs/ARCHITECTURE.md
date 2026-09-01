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

## Cinema domain and presentation

`app/domain/cinema/project-data.ts` defines the persisted version-1 cinema sidecar. Scene briefs use a separately versioned V2 contract, and valid V1 briefs migrate at the validation boundary. The sidecar contains relational records for:

- `scene`: brief, synopsis, purpose, continuity notes, and chronological shot IDs;
- `shot`: scene, order, duration, framing, movement, audio, risk, and continuity node IDs;
- `character`: appearance, voice, and wardrobe references;
- `asset`: location, prop, visual element, reference, or other reusable item with provenance;
- `agent-run`: lifecycle, providers/model, warnings, prompts, sources, and timestamps;
- prompt records;
- research-source records with supported, needs-verification, or irrelevant review state plus creator pinning and usage relationships;
- illustrative, credits-based, or explicitly unpriced cost records with a versioned profile and visible assumptions.

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
5. The creator inspects locked ghost nodes, prompts, linked sources, continuity, and costs. Source curation mutates only the preview until acceptance.
6. Reject discards the preview byte-for-byte. Accept records one history snapshot and commits nodes, edges, and cinema sidecar once.
7. One undo reverses the entire accepted proposal; redo and reload restore it.

## Evaluation and observability

`tests/eval` contains a versioned, Agents CLI–compatible three-case dataset and scoring configuration. Vitest is the deterministic gate for schemas, citations, duration, continuity, costs, mutation safety, and telemetry privacy. `vertex-adk-live.test.ts` is opt-in and proves the real Vertex/ADK contract with local ADC while using a local research fixture.

Cloud trace or completion export is not configured. Prompt/response capture and completion upload are disabled unless `CINESERYE_ENABLE_CLOUD_TELEMETRY=true` is deliberately supplied after a retention review.

## Deliberately absent

- authentication, accounts, collaboration, or cloud project storage;
- image, storyboard-frame, audio, or video generation;
- API-key entry in the browser;
- automatic proposal acceptance or background autonomy;
- A2A exposure, deployment, or provisioned observability infrastructure.

The next media-facing phase should begin only after a creator approves text prompts: generate one storyboard reference frame for one accepted shot, preserve provenance, and keep a separate approval boundary before any video generation.
