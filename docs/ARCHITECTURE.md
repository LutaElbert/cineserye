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

accepted shot + approved local references
                |
      storyboard preflight + spend cap
                |
 fixture provider / Vertex image adapter
                |
 validated blobs + immutable provenance
                |
compare variants → approve one shot anchor
                |
       video capability + spend preflight
                |
      fixture provider / Vertex Veo adapter
                |
  queued → running → finalizing → local MP4
                |
        review → approve one clip
```

## Generic editor foundation

`app/editor` owns selection, viewport behavior, drag, resize, connections, ordering, undo/redo, graph integrity, IndexedDB persistence, checkpoints, backup/restore, SVG export, keyboard support, responsive panels, accessibility, and security limits. `node-layout.ts` exposes provider-neutral node rectangles and lane packing, while `graph-rules.ts` uses measured dimensions and locked nodes as collision obstacles for deterministic Tidy. Cinema proposal layout consumes those generic primitives without teaching the editor what a shot or character means.

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
- visual pre-production records for typed references, explicit rights/allowed-use/approval, storyboard runs, immutable frame provenance, long-running video operations, and immutable clip provenance.

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

`app/domain/cinema/visual-preproduction.ts` is the separate visual domain layer. It validates reference types and usage, enforces conservative generation eligibility, blocks deletion while usages exist, validates storyboard and video provenance, and permits only one approved frame anchor and one approved clip per shot. Existing version-1 visual sidecars gain empty video maps deterministically. `app/editor/persistence.ts` owns a provider-neutral `media-blobs` IndexedDB store keyed by SHA-256; it does not interpret cinema records.

`app/server/cinema/storyboard-provider.ts` defines the still-image provider contract. The fixture emits deterministic safe SVG storyboards without networking. The opt-in Vertex adapter defaults to the current recommended `gemini-2.5-flash-image` model but remains environment-selectable. The route validates accepted-plan intent, prompt purpose, approved reference payloads, output count, safety, response dimensions, provider provenance, current unit pricing, and maximum estimated spend before returning pixels. The browser validates raster signatures again before local storage.

`app/editor/cinema-plan-proposal.ts` projects accepted cinema records into two dimension-aware generated lanes: context records and chronological shots. It estimates safe initial heights, refines them from rendered DOM measurements, persists the refined proposal on acceptance, and migrates legacy fixed-height accepted plans on reload. Story and Scene anchors remain creator-owned and are not repositioned by this migration.

`app/features/storyboard/VisualPreproductionPanel.tsx` is a projection over the visual-pre-production sidecar, not another source of truth. The selected-shot workbench appears first; the scene Reference Deck is collapsed until requested; changing the 1–4 output selection invalidates confirmation; and reference, frame, and plan approvals remain separate domain operations.

`app/server/cinema/video-capabilities.ts` snapshots the verified model boundary independently from provider code. `app/api/cinema/generate-video/route.ts` validates approved frames, exact one-output settings, MIME/size limits, live consent, current unit pricing, and maximum spend before starting a provider operation. `app/server/cinema/video-provider.ts` keeps `@google/genai` server-only, uses the SDK's `generateVideos`/`getVideosOperation` lifecycle, and exposes a deterministic valid-MP4 fixture for ordinary tests. The current app profile defaults to environment-selectable `veo-3.1-fast-generate-001` in `us-central1`, 4/6/8 seconds, 9:16/16:9, 720p/1080p, one silent output, and optional last frame. The SDK does not expose service cancellation, so live cancellation is explicitly local stop-tracking.

`app/features/video/VideoPreproductionPanel.tsx` persists the local operation identity before polling, resumes it after browser reload, stores successful MP4 bytes by SHA-256, and creates a separate candidate clip record only after storage succeeds. Setting changes invalidate confirmation. Failed, timed-out, and cancelled operations keep content-bounded diagnostics and can be retried as linked operations without altering the approved plan or frame.

Portable backup version 6 embeds referenced images but intentionally excludes MP4 bytes. Video metadata and approval remain in the document, and the UI tells creators to download clips separately. Restore verifies embedded image size and SHA-256 before writing any blob, never fetches external inspiration links or video, and remains compatible with text-only backup versions 1–5.

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
- generated audio, multi-shot video generation, or automatic timeline assembly;
- API-key entry in the browser;
- automatic proposal acceptance or background autonomy;
- A2A exposure, deployment, or provisioned observability infrastructure.

The next implementation phase is Sprint 7 multi-scene microdrama production. It must preserve the verified one-scene approval and storage boundaries and must not make video generation a prerequisite for planning or sequence review.
