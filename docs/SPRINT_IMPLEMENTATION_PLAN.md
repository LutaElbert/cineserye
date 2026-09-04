# Cineserye Sprints 1–10 implementation plan

**Plan date:** 2026-09-01

**Last reconciled:** 2026-09-03

**Historical starting baseline:** `f315cf0209b474810d0faebe8e8c632980f53555`

**Sprint 8 baseline:** `3765db94b2b5e5c23f4202e20952e98575330cc4`

**Source documents:** [current-feature audit](FEATURE_AUDIT.md), [architecture guide](ARCHITECTURE.md), and [initial vertical-slice plan](IMPLEMENTATION_PLAN.md)

**Scope:** a ten-sprint roadmap from one-scene workflow closure through a locally verified copilot, tightly controlled live research/planning, and evidence-backed reliability closure

**Post–Sprint 10 follow-up:** [ancestor-aware Story → Scene → Shot layout](HIERARCHICAL_CANVAS_LAYOUT_PLAN.md) — complete and verified

**Execution status (2026-09-02):** Sprints 1–10 are implemented. Sprint 8 provides a fixture-first continuity audit with bounded findings and fingerprint-checked corrections. Sprint 9's fail-closed live boundary requires `elbertluta@gmail.com`, project/quota project `cineserye`, explicit consent, an operator ceiling, and a local enable switch; its credit-consuming live smoke is correctly recorded as **Not run** pending fresh authorization. Sprint 10 adds separate development/holdout grades, no-content retention, a 100-run fixture soak, spend governance, and a readiness report. Deployment, autonomous/background mutation, authentication, collaboration, and required live media generation remain outside this roadmap.

| Sprint | Status | Acceptance evidence |
| --- | --- | --- |
| 1 — Trustworthy First Plan | Complete | Fixture/live planning boundary, cited proposal review, cost semantics, atomic accept/reject, and regression suite |
| 2 — Revision and Recovery | Complete | Immutable revisions, restore-as-new, accepted-shot edits, pending-proposal recovery, cancellation, traces, and evaluation assets |
| 3 — Rights-Aware Reference Deck | Complete | Explicit rights/use approval, upload/canvas/link origins, SHA-256 dedupe, shot/prompt usage, safe cleanup, media-inclusive backup/restore, policy and accessibility tests |
| 4 — One-Shot Storyboard Frame | Complete | Offline fixture and opt-in Vertex adapter, accepted-plan/reference validation, 1–4 variants, spend caps, cancel/retry, immutable provenance, one approved anchor, reload/restore, dimension-aware canvas layout, workbench-first Visuals UI, and accessibility tests |
| 5 — Professional Planning and Handoff | Complete | One-source-of-truth table/board/canvas editing, independent production order/setups, continuity matrix, directed intent, mobile statuses, and a cross-browser six-file ZIP handoff |
| 6 — One-Shot Video Experiment | Complete | Current Veo capability snapshot, bounded start-frame operation, spend guard, reload/cancel/retry, local MP4/metadata, and independent approval |
| 7 — Multi-Scene Microdrama Production | Complete | Three independently planned scenes, reviewed import, shared continuity/variants/exceptions, aggregate sequence, migration/performance/evaluation gates |
| 8 — Continuity-Aware Copilot Audit | Complete | Fixture-first scoped audit, five-finding cap, evidence/impact disclosure, stale-result protection, reviewed intentional-exception correction, and deterministic tests |
| 9 — Controlled Live Research and Planning | Complete; live smoke not run | Exact identity/project/quota preflight, digest-bound consent, hard per-run ceiling, local enable switch, provider isolation, and mocked boundary tests; credit-consuming cases remain opt-in |
| 10 — Agent Quality, Telemetry, and Reliability Closure | Complete | 18/18 development and 6/6 holdout local grades at 1.0000, 100-run fixture soak, 500-event/30-day no-content retention, spend circuit breakers, and readiness report |

Post-sprint UX hardening is tracked separately in [Structured Layer Outline Implementation Plan](./STRUCTURED_LAYER_OUTLINE_PLAN.md). It makes the manual Layers panel mirror validated Story → Scene → Shot/attachment relationships while preserving a flat z-order view.

Reusable destructive-action UX is tracked in [Reusable Confirmation Dialog Implementation Plan](./REUSABLE_CONFIRMATION_DIALOG_PLAN.md). It replaces browser-native confirmations without changing the existing undo, recovery, validation, or storage boundaries.

Mixed accepted-plan/manual-creation layout hardening is complete and verified in [Mixed-State Cinema Layout Implementation Plan](./MIXED_STATE_CINEMA_LAYOUT_PLAN.md). It keeps accepted planning lanes stable when creators add draft shots or scenes, self-heals legacy displaced generated lanes on reload, and closes generated-title numbering gaps.

Unified draft/production navigation is tracked in [Unified Project Outline Implementation Plan](./UNIFIED_PROJECT_OUTLINE_PLAN.md). It keeps one automatic Project Outline before, during, and after planning while retaining Layers as the flat technical view.

Parent-aware typed-layer routing is tracked in [Parent-Aware Cinema Layout Implementation Plan](./PARENT_AWARE_LAYOUT_PLAN.md). New cinema layers inherit their parent and sibling lane without changing unrelated or accepted canvas content.

Scene-owned subtree centering is tracked in [Scene Production Bands Implementation Plan](./SCENE_PRODUCTION_BANDS_PLAN.md). Draft scenes center against their production-child lanes and reserve enough vertical space for later scene bands.

### Verified Sprint 10 closure

- Compatibility: Vinext reports **100%** (9 supported, 0 partial, 0 issues).
- Static validation: TypeScript, ESLint, and the server/client provider-boundary check pass.
- Unit/integration: **181 passed, 3 opt-in live tests skipped** across 39 files.
- Browser regression: **187 passed** across Chromium, Firefox, and WebKit, with two intended non-Chromium stress skips.
- Local Agents CLI: development **18/18** and sealed holdout **6/6**, both mean `1.0000` using the deterministic `bounded_audit_contract` metric.
- Production build: passed. No deployment was performed.
- Dependency audit: no high or critical findings; 13 moderate transitive ADK/OpenTelemetry and `gaxios`/`uuid` findings remain because the offered complete remediation would force a breaking ADK downgrade.
- Provider safety: live Parallel, Vertex, storyboard, video, managed evaluation, and Cloud Trace remained **Not run**; no provider credits were spent and no Google Cloud state was read or changed.

### Verified Sprint 7 baseline

- Compatibility: Vinext reports **100%** (9 supported, 0 partial, 0 issues).
- Static validation: TypeScript, ESLint, and the server/client provider-boundary check pass.
- Unit/integration: **170 passed, 3 opt-in live tests skipped** across 37 files.
- Browser regression: **184 passed** across Chromium, Firefox, and WebKit, with two intended non-Chromium stress skips.
- Production build and server/client boundary scan: complete, with no deployment performed.
- Dependency audit: no high or critical findings at the configured high-severity gate; 13 moderate transitive findings remain in Google ADK/OpenTelemetry and `gaxios`/`uuid`. Their available full fix would introduce a breaking ADK downgrade, so it was not applied silently.
- Provider safety: all automated and UI acceptance runs used the deterministic offline fixture. The opt-in live smoke test was intentionally not run, so no provider credits were spent.
- WebKit portability: local binary media is stored as raw bytes and reconstructed as browser blobs, avoiding WebKit's direct-Blob IndexedDB limitation while preserving SHA-256 deduplication and portable backups.
- Canvas layout: generated context and shot lanes use measured node dimensions, deterministic vertical packing, and explicit column gaps. Existing accepted fixed-height plans migrate on reload without moving the creator's Story or Scene anchors; generic Tidy also respects mixed heights and locked-node obstacles.
- Visual workflow: the selected-shot Storyboard Workbench appears before a collapsed scene Reference Deck, variants are direct 1–4 controls, Model and Estimate remain readable at the 340px inspector width, and the confirmation/generation footer remains reachable. Browser measurement confirmed a single tab row and no control truncation.

## 1. Outcome and implementation posture

This plan evolves the verified local proof of concept without replacing the generic canvas engine or weakening the current proposal boundary. Every sprint must leave a coherent, testable product increment. Media generation is gated behind versioning, recovery, provenance, and explicit approval.

### Build mode

- **Execution:** autonomous implementation with a user-visible demo gate at the end of every sprint.
- **Git cadence:** one focused commit per work package; one final sprint-close commit only when the full gate passes.
- **Branching:** use `codex/sprint-<number>-<short-name>` for sprint work unless the user explicitly chooses direct-to-main work.
- **Verification:** focused tests during each work package, the complete regression matrix at sprint close, and opt-in live tests only when they are bounded and explicitly expected to spend credits.
- **Deployment:** prohibited throughout this plan unless separately authorized.
- **Provider secrets:** server-only; never stored in the project document, client bundle, screenshots, logs, or test artifacts.
- **Human approval:** research, planning, references, still frames, and video remain separate approval boundaries.
- **Google Cloud identity:** every Cineserye Google Cloud operation must explicitly target account `elbertluta@gmail.com` and project/quota project `cineserye`; never fall back to another active CLI configuration.

### Architecture invariants

1. `app/editor` remains a provider-neutral canvas engine.
2. Cinema meaning remains in versioned records under `app/domain/cinema`.
3. Untrusted provider output never writes directly to React state, IndexedDB, media storage, backups, or exports.
4. All document mutations pass runtime validation and one atomic command boundary.
5. Accepted records have stable identities and immutable revision history.
6. Rejection, cancellation, timeout, validation failure, or provider failure never alters the accepted document.
7. Fixture mode remains deterministic and makes no external requests.
8. Live calls require a specific content-transfer and spend boundary.
9. Every generated or imported media artifact records provenance and downstream usage.
10. No sprint may regress generic-canvas behavior, backup compatibility, accessibility, or mobile operation.

## 2. Dependency map and stop points

```text
Verified one-scene baseline
  |
  v
Sprint 1 — Trustworthy First Plan
  |
  v
Sprint 2 — Revision, Recovery, and Source-of-Truth Editing
  |
  v
Sprint 3 — Rights-Aware Visual Reference Deck
  |
  v
Sprint 4 — One-Shot Storyboard Frame
  |
  +-----------> Hackathon MVP stop and polish
  |
  v
Sprint 5 — Professional Planning and Handoff
  |
  v
Sprint 6 — One-Shot Video Experiment
  |
  v
Sprint 7 — Multi-Scene Microdrama Production
  |
  v
Sprint 8 — Continuity-Aware Copilot Audit
  |
  v
Sprint 9 — Controlled Live Research and Planning
  |
  v
Sprint 10 — Agent Quality, Telemetry, and Reliability Closure
```

### Recommended product gates

- **Gate A — trustworthy text plan:** Sprints 1–2 complete.
- **Gate B — visual pre-production MVP:** Sprints 1–4 complete. This is the recommended hackathon boundary.
- **Gate C — professional solo workflow:** Sprints 1–5 complete.
- **Gate D — controlled media proof:** Sprints 1–6 complete.
- **Gate E — project-level product:** Sprints 1–7 complete.
- **Gate F — trustworthy local copilot:** Sprints 1–8 complete.
- **Gate G — bounded live proof:** Sprints 1–9 complete, with live evidence captured only after explicit authorization.
- **Gate H — evidence-backed demo readiness:** Sprints 1–10 complete; deployment remains a separate approval and implementation program.

## 3. Shared domain evolution strategy

Do not overload the existing `CinemaProjectDataV1` indefinitely. Each breaking record change must ship with a migration and round-trip tests.

### Planned schema evolution

| Sprint | Domain change | Document change |
| --- | --- | --- |
| 1 | Scene brief V2, explicit creation mode and budget semantics, strict citation relationships | Migrate accepted V1 briefs without changing existing prompt text |
| 2 | Plan revisions, predecessor links, project ID, domain edit commands, pending proposal envelope | Add a local pending-proposals store; migrate fixed legacy run IDs |
| 3 | Typed reference assets, provenance, rights state, media references | Add content-addressed local reference-blob storage |
| 4 | Storyboard-frame artifacts and frame-generation runs | Add still-image blob lifecycle and backup metadata |
| 5 | Camera/lighting setups, production order, export metadata | Preserve narrative order separately from production order |
| 6 | Video artifacts, long-running operation state, capability/pricing snapshot | Add video-blob lifecycle and explicit media portability rules |
| 7 | Multiple scenes, shared continuity entities, project-level plans and totals | Migrate single-scene projects without changing their active scene |
| 8 | Audit runs, findings, evidence links, scope fingerprints, correction proposals, and disposition state | Additive optional records; old projects remain valid with an empty audit collection |
| 9 | Provider preflight, consent receipt, sanitized usage summary, live-run lineage, and pricing snapshot | Persist no credential/token; backups include only non-sensitive provider evidence |
| 10 | Quality baselines, eval suite versions, local diagnostic aggregates, feedback disposition, reliability incidents, and spend-ledger summaries | Keep raw eval prompts/traces and telemetry artifacts outside portable user projects by default |

### Migration rules

- Parsing an old valid project must never invent external sources, rights, approvals, or provider spend.
- Unknown future schema versions remain a hard error with a useful message.
- Migrations are deterministic and idempotent.
- Every migration is exercised through IndexedDB, `.cineserye` backup/restore, undo/redo, and presentation projection.
- Large binary media is referenced by content hash; document JSON does not silently duplicate blobs.

## 4. Canonical use-case scenarios

These scenarios anchor acceptance tests across multiple sprints.

### UC-01 — New creator makes a phone-shot suspense scene

Ana opens Cineserye for the first time, selects **Start a scene**, enters a 30-second one-location scene, chooses `AI-generated`, `9:16`, a low generation budget, and phone-only equipment. She sees Live mode and the content-transfer summary before submitting. The proposal cites only relevant sources, stays within the selected duration, and explains its generation-cost assumptions.

### UC-02 — Professional cinematographer revises coverage

Marco accepts a six-shot plan, then changes a close-up to a 50mm static medium close-up, extends it by two seconds, and shortens another shot. The shot card, table, total duration, prompts, budget, outline, backup, and undo history update together. He creates a second plan revision without losing revision one.

### UC-03 — Documentary creator receives limited research

Lea enters a historical reconstruction scene. Parallel returns two useful sources and several irrelevant results. Lea removes the irrelevant items. Unsupported creative suggestions are marked **Needs verification** rather than inheriting fallback citations. The planner remains cautious and labels dramatized assumptions.

### UC-04 — Creator reloads during review

Noah finishes a paid live plan but closes the tab before accepting. On reload, Cineserye restores the exact pending proposal, source document fingerprint, warnings, selection, and review state without repeating provider calls.

### UC-05 — Creator cancels an expensive run

Mika starts live planning, notices an incorrect brief during the research phase, and presses **Cancel planning**. The request aborts, a content-free cancelled run record remains available for diagnostics, and the accepted canvas is unchanged. She corrects the brief and retries as a linked run.

### UC-06 — Creator builds a rights-aware reference deck

Sam uploads a creator-owned actor reference, adds a location image licensed for commercial use, and saves a ShotDeck URL as inspiration-only. Cineserye allows the first two to guide generation after approval but prevents the inspiration-only URL from silently becoming a model input.

### UC-07 — Creator approves one storyboard frame

Inez selects one accepted shot, confirms its prompt and inherited references, reviews model/settings and estimated spend, generates three bounded still variants, rejects two, and approves one. Every variant retains model, prompt, settings, references, cost, provenance, and approval status.

### UC-08 — Small team receives a professional handoff

An independent director exports an accepted plan as a shot-list CSV, printable storyboard PDF, prompt package, and sources/provenance report. The files identify the scene and plan revision and clearly mark illustrative costs.

### UC-09 — Creator animates one approved frame

Kai selects an approved storyboard frame, optionally supplies an approved end frame, confirms a bounded video cost, and generates one clip. Cancellation and failure preserve the frame and accepted plan. The clip remains unapproved until Kai reviews it.

### UC-10 — Creator expands into a three-scene microdrama

Rae imports or creates three short scenes, reviews the extracted boundaries, plans them individually, and sees shared character, wardrobe, location, and prop continuity. Updating a shared wardrobe element identifies affected shots before any revision is accepted.

### UC-11 — Creator audits continuity before generation

Rae selects Mara and runs a project audit. Cineserye identifies that Mara's rain-soaked coat in Scene 2 conflicts with a clean-coat prompt in Scene 3, shows every affected shot and the relevant variant records, and explains the likely regeneration cost. Rae chooses the finding, reviews one bounded correction proposal, accepts it as a single undoable change, and can restore the prior state with one undo.

### UC-12 — Creator authorizes one bounded live audit

Rae switches from Fixture to Live. Before any request, Cineserye shows that public-web research will go to Parallel and the minimized audit context will go to Vertex AI, verifies `elbertluta@gmail.com` with project/quota project `cineserye`, displays the maximum request count and configured spend ceiling, and requires a fresh confirmation. One research request and one planning request run; returned citations and usage metadata remain reviewable, while the accepted project stays unchanged until Rae explicitly accepts a correction.

### UC-13 — Maintainer proves the copilot is demo-ready

Elbert runs the complete fixture regression, a versioned Agents CLI evaluation with untouched holdout cases, a 100-run fault/soak exercise, privacy/redaction scans, and spend-ledger reconciliation. The readiness report shows hard safety gates, behavioral scores, before/after comparisons, latency/error distributions, and open risks without containing raw scenes, prompts, excerpts, tokens, or media. A failure blocks readiness rather than lowering the threshold, and no deployment occurs.

## 5. Sprint 1 — Trustworthy First Plan

### Sprint objective

A newcomer can start from a blank workspace, understand the provider and cost boundary, describe any kind of scene without sample bias, and receive a plan whose displayed citations have defensible relationships.

### In scope

- canonical **Generate shot plan** language;
- first-run **Start a scene** / **Explore the sample** choice;
- visible Fixture/Live mode;
- mobile access to New, backup, mode, and planning;
- neutral Scene Brief V2;
- meaningful scene-content validation;
- creation mode, format, audio, beats, and constraints;
- separate AI-generation budget and physical-production constraints;
- removal of fallback citations and automatic pinning;
- source relevance and verification states.

### Out of scope

- plan revisions;
- persisted pending proposals;
- visual-reference images;
- image or video generation.

### Work packages

#### S1-WP1 — Canonical workflow language and provider visibility

**Build**

- Replace `Plan scene`, `Draft shot prompts`, and ambiguous complete-state labels with a shared state-to-label mapping.
- Use **Generate shot plan**, **Generating shot plan**, **Review shot plan**, and **Create revision** consistently.
- Add a safe provider badge sourced from `/api/cinema/provider-status`.
- Add an accessible mobile overflow containing New, backup/restore, provider status, and export.

**Acceptance**

- The same planning verb appears in the toolbar, inspector, dialog, progress, review, accessibility tree, tests, and README.
- Provider mode is visible before consent/submission and reveals no credentials.
- All project actions remain available at 390px width.

#### S1-WP2 — First-run project chooser

**Build**

- Detect a genuinely uninitialized local database separately from an existing blank project.
- Offer **Start a scene** and **Explore the sample**.
- Move the existing Reel fixture behind the sample choice.
- Keep **New** recoverable through backup and explicit confirmation.

**Acceptance**

- First-run users never land in an unexplained accepted-demo state.
- Returning users resume their local document without seeing onboarding again.
- Fixture/sample selection makes no external request.

#### S1-WP3 — Scene Brief V2

**Build**

- Add `creationMode`, `aspectRatio`, `targetPlatform`, `genreTone`, `dialogueAudioIntent`, `requiredBeats`, `mustInclude`, `mustAvoid`, `generationBudget`, and `productionConstraints`.
- Preserve selected scene text as the primary input.
- Reject placeholder-only content such as `Scene 01`.
- Keep sample values in sample fixtures only.
- Add deterministic V1-to-V2 migration.

**Acceptance**

- Fiction, documentary, commercial, and hybrid/live-action scenes can use the same brief.
- Required and optional fields are clear to newcomers and editable by professionals.
- Old accepted V1 projects load without semantic changes.

#### S1-WP4 — Budget semantic split

**Build**

- Represent AI-generation budget separately from physical production constraints.
- Replace currency heuristics with a versioned cost-assumption profile.
- Allow `unpriced`, credit-based, or currency-based estimates.
- Persist provider/model/resolution/output/retry assumptions and pricing snapshot date when known.

**Acceptance**

- A physical production ceiling is never compared with an AI provider charge.
- An unpriced model produces attempt/credit guidance without inventing a currency quote.
- Every estimate remains explicitly non-guaranteed.

#### S1-WP5 — Citation integrity and source curation

**Build**

- Remove source-ID fallback from `linkedSourceIds`.
- Introduce `supported`, `needs-verification`, `irrelevant`, and creator-pinned states.
- Track source-to-claim/node usage.
- Stop auto-pinning the first results.
- Show retrieval time, query purpose, domain, and usage count.

**Acceptance**

- Missing or invalid source IDs cannot appear as supporting citations.
- A creator can pin, remove, or mark a source irrelevant before acceptance.
- Citation coverage counts only explicit valid relationships.

### Sprint 1 use-case walkthrough

Run UC-01 and UC-03 end to end in fixture mode. Repeat UC-01 at 390px with keyboard-only input. Confirm the live badge and consent copy using a mocked live-status route without submitting external content.

### Sprint 1 test cases

| ID | Level | Test |
| --- | --- | --- |
| S1-UT-01 | Unit | Scene Brief V2 accepts valid AI, live-action, and hybrid briefs. |
| S1-UT-02 | Unit | Placeholder, empty, oversized, or malformed scene content is rejected with a field error. |
| S1-UT-03 | Unit | V1 briefs migrate deterministically and retain prior meaning. |
| S1-UT-04 | Unit | Generation and production budgets remain distinct through validation and serialization. |
| S1-UT-05 | Unit | Invalid or missing source IDs remain uncited and never receive fallback sources. |
| S1-UT-06 | Unit | Citation coverage excludes irrelevant and needs-verification relationships. |
| S1-IT-01 | Integration | Fixture planning consumes every new intent field and returns a valid proposal. |
| S1-IT-02 | Integration | Live-status payload exposes mode/consent only and contains no secret material. |
| S1-E2E-01 | Browser | First launch offers Start a scene and Explore the sample. |
| S1-E2E-02 | Browser | Returning accepted projects bypass onboarding and resume safely. |
| S1-E2E-03 | Browser | Canonical Generate shot plan labels remain consistent across all states. |
| S1-E2E-04 | Browser | Mobile overflow exposes New, backup, mode, plan, and export. |
| S1-E2E-05 | Browser | Source curation changes the preview only and rejection leaves the source document unchanged. |
| S1-A11Y-01 | Accessibility | First-run choice, brief errors, mode, and source states are announced and keyboard reachable. |

### Sprint 1 regression gate

- Existing generic initial graph remains `Story Premise → Scene 01 → Shot 01` after choosing Start a scene.
- Sample fixture remains deterministic and offline.
- Existing V1 `.cineserye` files restore.
- Accept/reject/undo/redo semantics remain atomic.
- Existing editor, graph, persistence, export, stress, and accessibility suites pass.

### Sprint 1 demo gate

Show UC-01 from a cleared local database and UC-03 with an invalid model source ID. Do not proceed if any unrelated fallback citation appears.

## 5.1 Sprint 1.1 — Cinema creation and empty-canvas recovery

This shipped bridge closes the blank-workspace UX gap before Sprint 2's proposal-revision work.

### Use-case scenarios

- A first-time creator selects **Scene 01**, chooses **Add shot**, names the new draft, and receives a validated Scene → Shot connection without arranging or wiring it manually.
- A creator adds characters, locations, props, visual elements, and production notes through one categorized palette, then converts a draft's cinema role without losing its text.
- A creator deletes the entire canvas, immediately restores it with undo, or reloads and recovers the persisted last-non-empty copy.
- A creator intentionally starts over from the empty state with a scene, imports a backup, or opens the sample; no mock data appears automatically.

### Acceptance criteria

- Manual story, scene, shot, character, location, prop, visual-element, and note drafts use validated `cinema.*` metadata while remaining generic canvas nodes.
- Contextual child and sibling actions derive from cinema role and create valid connections through `CanvasCommandProposal`.
- The creation palette communicates shot and story prerequisites, traps focus as a modal dialog, closes with Escape, and works at the mobile breakpoint.
- Deleting the final unlocked layer set requires confirmation and saves one validated local recovery copy before mutation.
- Empty state exposes session undo, persisted recovery, clean scene bootstrap, typed Add, backup restore, and explicit sample actions.
- Restore, autosave, `.cineserye` round-trip, undo/redo, graph validation, selection, accessibility, and the accepted shot-planning path do not regress.

### Test cases

- Unit: role recognition and legacy inference, contextual role mapping, stable sequential names, bounded `domainType` round-trip and rejection.
- Browser: typed creation, automatic connections, command undo/redo, role conversion with text preservation, palette prerequisites, full-delete confirmation, session undo, reload recovery, and accessibility semantics.
- Regression: complete type, lint, unit, compatibility, build, client-boundary, dependency audit, and Chromium/Firefox/WebKit Playwright gates.

## 6. Sprint 2 — Revision, Recovery, and Source-of-Truth Editing

### Implementation status — delivered foundation on `codex/sprint-2-revision-recovery`

The current branch implements the source-of-truth foundation: deterministic V1-to-V2 migration, stable project and run-scoped identities, immutable revision snapshots and comparison, restore-as-new-revision, atomic accepted-shot editing with prompt invalidation, reload-safe pending proposal recovery, cancellation, active-request idempotency, safe provider status, and a capped content-free local trace panel/export. The evaluation adapter is covered by the deterministic TypeScript test suite and remains compatible with a future Agents CLI endpoint.

Two production-hardening items remain deliberately outside the local foundation: durable idempotency across deployed instances and a chargeable provider health probe. Neither is required for the local-only, non-deployed proof of concept.

### Sprint objective

Make planning iterative and recoverable. An accepted plan can be revised without losing history; domain edits cannot diverge from their canvas presentation; paid ready proposals survive reload.

### In scope

- stable project ID and plan-revision records;
- unique run-scoped entity IDs;
- predecessor/successor relationships and revision comparison;
- validated domain edit commands;
- authoritative inspector editing or locked derived hosts;
- pending-proposal IndexedDB store;
- source-document fingerprinting;
- creator-facing phase progress, cancellation, retry, and safe error recovery;
- request idempotency for the local prototype;
- safe provider configuration/last-known-health status;
- local content-free trace view;
- executable behavioral evaluation adapter.

### Work packages

#### S2-WP1 — Project and revision identity

**Build**

- Add a stable `projectId` during migration.
- Add `CinemaPlanRevisionRecord` with scene, revision number, run, predecessor, status, summary, accepted timestamp, and superseded timestamp.
- Make run/shot/prompt/asset host IDs collision-safe across revisions.
- Preserve the first accepted legacy plan as revision one.

**Acceptance**

- Two revisions coexist without duplicate IDs.
- Old projects load as a single recoverable revision.
- Deleting or superseding a revision cannot orphan accepted entities.

#### S2-WP2 — Domain edit command boundary

**Build**

- Create validated commands for scene, shot, character, asset, prompt, continuity, duration, and order changes.
- Compile domain commands and visual host patches as one atomic document transaction.
- Decide one authoritative UI: inspector edit forms are recommended; derived host text should not be independently editable.

**Acceptance**

- A title, lens, duration, or continuity edit updates sidecar, host, outline, totals, prompts/invalidations, backup, and undo together.
- Invalid edits reject atomically.
- Reordering shots preserves unique chronological order and recomputes totals.

#### S2-WP3 — Create and compare revisions

**Build**

- Add **Create revision** from an accepted plan.
- Seed a revision brief from accepted values plus creator revision notes.
- Add a comparison model for created, removed, changed, and retained records.
- Allow accept, reject, and restore previous accepted revision.

**Acceptance**

- Revision one remains recoverable after accepting revision two.
- Review clearly states what changed and what continuity elements were reused.
- Rejecting revision two keeps revision one byte-equivalent.

#### S2-WP4 — Pending proposal persistence

**Build**

- Add a dedicated IndexedDB `pending-proposals` store keyed by project/scene/revision.
- Store proposal, validated cinema payload, source-document fingerprint, mode, warning summary, and ready timestamp.
- Restore only when the source fingerprint matches; otherwise offer discard/regenerate.
- Clean up on accept, reject, project reset, or expiration.

**Acceptance**

- UC-04 restores without another provider request.
- A changed source document never receives a stale proposal silently.
- Backup behavior explicitly includes or excludes pending work and explains the choice.

#### S2-WP5 — Progress, cancellation, retry, and idempotency

**Build**

- Stream content-free phase events or implement an equivalent phase-safe protocol.
- Add **Cancel planning** and persistent error cards.
- Send a client-generated idempotency key and maintain a bounded local server registry for duplicate active requests.
- Retry as a linked run rather than mutating a failed run.

**Acceptance**

- Research, planning, validation, and proposal phases are visible.
- Cancellation aborts providers and writes no accepted history entry.
- Double submission cannot charge twice within the local process guarantee.
- The UI explains that cross-instance durable idempotency is a deployment concern.

#### S2-WP6 — Provider preflight and private local trace

**Build**

- Extend status with `configured`, safe last-known result, model/profile, and timestamp; never auto-spend to verify.
- Add an explicit developer **Test connections** action if a provider requires a chargeable request.
- Persist content-free local run events and expose a developer trace panel/export.

**Acceptance**

- Invalid Parallel auth, missing ADC, quota/rate limits, and unavailable model states have distinct safe guidance.
- Raw scenes, prompts, findings, URLs with credentials, and secrets never appear in trace output.

#### S2-WP7 — Behavioral evaluation adapter

**Build**

- Adapt the local Cineserye workflow to the Agents CLI evaluation contract without introducing Python into the production path.
- Expand datasets for the cases listed in the feature audit.
- Store score reports outside the client bundle and define minimum structural and qualitative thresholds.

**Acceptance**

- A documented command generates and grades fixture-backed cases.
- Scores are inspected rather than relying only on process exit status.
- Failing cases link back to run IDs and safe diagnostics.

### Sprint 2 use-case walkthrough

Run UC-02, UC-04, and UC-05. Include a revision with changed lens/duration, a reload at ready review, and cancellation during a delayed fixture research provider.

### Sprint 2 test cases

| ID | Level | Test |
| --- | --- | --- |
| S2-UT-01 | Unit | Legacy fixed IDs migrate into one valid revision. |
| S2-UT-02 | Unit | Two revisions produce unique entities and valid predecessor links. |
| S2-UT-03 | Unit | Domain edits compile to one synchronized sidecar/host transaction. |
| S2-UT-04 | Unit | Invalid duration/order/continuity edits reject atomically. |
| S2-UT-05 | Unit | Source fingerprints are deterministic over persistable source state. |
| S2-UT-06 | Unit | Trace serialization contains no forbidden content fixtures. |
| S2-IT-01 | Integration | Pending proposal round-trips through IndexedDB and restores on matching source. |
| S2-IT-02 | Integration | Stale proposal is quarantined after a source edit. |
| S2-IT-03 | Integration | Duplicate idempotency key reuses/rejects active local work. |
| S2-IT-04 | Integration | Cancellation during research and planning closes the run safely. |
| S2-IT-05 | Integration | Retry links to failed predecessor and returns a new run ID. |
| S2-E2E-01 | Browser | Accepted plan exposes Create revision and comparison review. |
| S2-E2E-02 | Browser | Manual shot edit updates card, table-ready presentation, totals, undo, reload, and backup. |
| S2-E2E-03 | Browser | Ready proposal survives reload without external requests. |
| S2-E2E-04 | Browser | Cancel and retry controls work with keyboard and mobile panels. |
| S2-EVAL-01 | Evaluation | Diverse fixture cases meet schema, citation, continuity, duration, budget, and usefulness thresholds. |

### Sprint 2 regression gate

- One-step proposal acceptance and undo remain intact.
- Legacy accepted plans are neither duplicated nor lost.
- Generic concept editing remains unchanged for non-cinema nodes.
- Pending proposals never appear in SVG or accepted backup unless explicitly specified.
- Fixture mode remains network silent.

### Sprint 2 demo gate

Complete UC-02, reload into UC-04, and cancel UC-05. Do not proceed to reference media while host/sidecar divergence or lost paid proposals remain possible.

## 7. Sprint 3 — Rights-Aware Visual Reference Deck

### Sprint objective

Give every scene a curated set of approved character, location, prop, wardrobe, style, and composition references with explicit provenance, rights state, and downstream usage—without generating media yet.

### In scope

- typed reference records;
- local image upload and safe validation;
- attach existing canvas images as references;
- external reference links without silent downloading;
- provenance and rights/usage state;
- creator approval for research-only, image-generation, or video-generation use;
- content-addressed local blob storage;
- reference deck UI, filtering, pin/remove, and usage mapping;
- prompt inheritance by stable reference IDs;
- reference-aware backup/restore and storage cleanup.

### Work packages

#### S3-WP1 — Reference domain and policy

**Build**

- Add `CinemaReferenceAssetRecord` with type, owner scope, origin, MIME/dimensions/hash, provenance, source URL, rights status, allowed uses, approval status, notes, and usage IDs.
- Distinguish research source, inspiration link, uploaded reference, generated frame, and video frame.
- Define conservative defaults: external links are inspiration-only until explicitly reviewed.

**Acceptance**

- No record is generation-approved by inference.
- Rights and allowed-use state survives backup and revision.
- Deleting a referenced asset is blocked or requires resolving usages.

#### S3-WP2 — Local media store

**Build**

- Add an IndexedDB blob store keyed by SHA-256 content hash.
- Validate signature, MIME, dimensions, file size, and supported image types.
- Deduplicate identical media.
- Track references so orphaned blobs can be cleaned without deleting used media.

**Acceptance**

- Re-uploading the same file does not duplicate storage.
- Corrupt/mislabeled files are rejected.
- Clearing one unused reference does not remove a blob still used elsewhere.

#### S3-WP3 — Reference Deck UI

**Build**

- Add a scene-level Reference Deck group and grid/list view.
- Support upload, attach existing image, add external URL metadata, categorize, approve, revoke, pin, filter, and search.
- Display rights state and downstream usage prominently.

**Acceptance**

- UC-06 can be completed without leaving the app.
- Screen-reader users can identify reference type, approval, rights, and usage.
- Mobile supports upload and review without horizontal loss.

#### S3-WP4 — Prompt and continuity integration

**Build**

- Allow character/asset/shot prompts to inherit approved reference IDs.
- Show resolved references beside text continuity dependencies.
- Invalidate generation readiness when an approved required reference is revoked or missing.

**Acceptance**

- A prompt cannot claim a reference it does not resolve.
- Inspiration-only references are visible to the creator but excluded from generation payloads.
- Changes produce a reviewable affected-shot list.

#### S3-WP5 — Reference portability and cleanup

**Build**

- Define `.cineserye` reference portability: embedded small images or a versioned bundle manifest, with explicit size caps.
- Validate restore hashes and missing-media states.
- Add storage usage and safe cleanup controls.

**Acceptance**

- A portable backup either contains required reference media or clearly declares missing external media.
- Restore never fetches external URLs automatically.

### Sprint 3 use-case walkthrough

Run UC-06 with one creator-owned upload, one licensed upload, one inspiration-only external link, a duplicate upload, and a revoked approval used by two shots.

### Sprint 3 test cases

| ID | Level | Test |
| --- | --- | --- |
| S3-UT-01 | Unit | Reference records reject unsupported type, origin, rights, use, and MIME combinations. |
| S3-UT-02 | Unit | Generation eligibility requires explicit allowed use and approval. |
| S3-UT-03 | Unit | Reference usage relationships resolve across prompts and shots. |
| S3-IT-01 | Integration | Blob hashing deduplicates identical uploads and preserves reference counts. |
| S3-IT-02 | Integration | Backup/restore verifies media hash and reports missing blobs safely. |
| S3-IT-03 | Integration | External link restore performs no network fetch. |
| S3-E2E-01 | Browser | Upload, categorize, approve, revoke, pin, filter, and delete follow policy. |
| S3-E2E-02 | Browser | Inspiration-only reference cannot be selected for generation use. |
| S3-E2E-03 | Browser | Reference usage navigation focuses every consuming prompt/shot. |
| S3-SEC-01 | Security | Polyglot, oversized, corrupt, and misleading image files are rejected. |
| S3-A11Y-01 | Accessibility | Reference cards and policy states are fully keyboard/screen-reader usable. |

### Sprint 3 regression gate

- Existing generic image import, vectorization, drag/drop, paste, SVG, and backup behavior still pass.
- Reference blobs never enter telemetry or provider payloads without explicit approved use.
- Deleting cinema records still cascades safely without orphaned relationship records.

### Sprint 3 demo gate

Complete UC-06 and export/restore the project on a clean browser profile. Do not enable image generation until provenance and allowed-use enforcement are proven.

**Completion evidence:** passed. The browser scenario covers an inspiration-only external link with no fetch, duplicate local upload deduplication, explicit rights/use approval, shot attachment, prompt inheritance, and portable backup hash verification. Unit tests cover invalid rights state, explicit eligibility, relationship validation, and deletion guards.

## 8. Sprint 4 — One-Shot Storyboard Frame

### Sprint objective

Generate, compare, and approve a bounded set of still storyboard variants for one selected accepted shot using only approved references. Do not generate video.

### In scope

- server-only image-generation provider contract;
- environment-selected Vertex image model/profile;
- runtime capability and pricing/credit profile;
- shot-level generation preflight and consent;
- one to four bounded variants;
- cancellation, timeout, retry, safety errors, and spend guard;
- local still-artifact storage;
- variant comparison and one approved frame;
- complete prompt/model/settings/reference/provenance history;
- mocked and opt-in live evaluation.

### Work packages

#### S4-WP1 — Storyboard generation contract

**Build**

- Define `StoryboardImageProvider`, request/result schemas, capability profile, and typed errors.
- Select the default model only after listing currently available Vertex image models during implementation; keep it environment-configurable.
- Enforce server-only credentials and bounded response sizes.

**Acceptance**

- Provider output is validated before any blob is stored.
- Unsupported aspect ratio/reference combinations are rejected before spend.
- Fixture provider remains deterministic and offline.

#### S4-WP2 — Storyboard artifact domain

**Build**

- Add storyboard generation run and frame records with shot/revision, prompt version, reference IDs, provider/model, settings, safety status, cost/credits, hash, timestamps, and approval state.
- Preserve rejected variants as optional local history until the creator deletes them.

**Acceptance**

- Every frame can be traced to exact text and visual inputs.
- Only one frame can be approved as the current anchor per shot/version unless explicitly supporting alternates.

#### S4-WP3 — Spend and content-transfer preflight

**Build**

- Show prompt summary, approved references, model, aspect ratio, output count, estimated spend/credits, and data destinations.
- Require explicit confirmation immediately before generation.
- Enforce configured per-request output and estimated-spend limits server-side.

**Acceptance**

- No image request can run from an unaccepted plan, unapproved reference, or unconfirmed spend boundary.
- Changing settings invalidates prior confirmation.

#### S4-WP4 — Variant generation and review UI

**Build**

- Add **Generate storyboard frame** to one accepted shot.
- Display progress, cancel, variants, metadata, comparison, approve, reject, and regenerate actions.
- Keep frame review separate from plan acceptance.

**Acceptance**

- UC-07 completes with three variants and one approval.
- Rejecting all variants leaves the plan unchanged.
- Approved frame appears as a shot child/reference, not as a replacement for the shot node.

#### S4-WP5 — Storage, backup, evaluation, and safety

**Build**

- Store validated image blobs content-addressably.
- Include frame metadata and approved media in the defined portable backup policy.
- Add visual consistency/manual review rubric and opt-in live contract smoke.
- Record safe provider usage and latency without image/prompt content.

**Acceptance**

- Reload and restore preserve approved frame and provenance.
- Live tests are opt-in, bounded, and excluded from ordinary CI.
- Safety/provider rejection produces no broken artifact.

### Sprint 4 use-case walkthrough

Run UC-07 with fixture generation, then one explicitly approved bounded live smoke using a non-confidential sample scene. Compare variants and restore the approved frame from backup.

### Sprint 4 test cases

| ID | Level | Test |
| --- | --- | --- |
| S4-UT-01 | Unit | Storyboard request resolves one accepted shot, prompt version, and approved references. |
| S4-UT-02 | Unit | Unsupported settings, unapproved references, and excessive outputs are rejected. |
| S4-UT-03 | Unit | Frame approval enforces one current anchor and immutable generation metadata. |
| S4-IT-01 | Integration | Fixture provider returns bounded validated variants with deterministic hashes. |
| S4-IT-02 | Integration | Cancel/timeout/rate-limit/safety errors store no incomplete blob. |
| S4-IT-03 | Integration | Approved frame round-trips through persistence and backup. |
| S4-E2E-01 | Browser | Shot → preflight → variants → compare → approve workflow succeeds. |
| S4-E2E-02 | Browser | Reject all and regenerate preserve accepted plan and revision history. |
| S4-E2E-03 | Browser | Spend confirmation is required again after settings change. |
| S4-LIVE-01 | Opt-in live | One safe sample returns a valid image within configured output/spend limit. |
| S4-A11Y-01 | Accessibility | Variant grid, metadata, selection, and approval are keyboard and screen-reader usable. |

### Sprint 4 regression gate

- Planning does not require an image provider.
- Text-only projects and backups remain valid.
- Reference rights enforcement cannot be bypassed through copied prompt text or direct API payload.
- Client-boundary scan proves no image-provider secret or Google token is bundled.

### Sprint 4 demo gate

Run UC-01 through UC-07 in one story: start blank, plan, revise, curate references, generate variants, and approve one frame. This is the recommended hackathon MVP stop.

**Completion evidence:** passed in deterministic fixture mode. Computer-use and Playwright scenarios generated three variants, changed the single approved anchor, cancelled and retried a run, restored verified pixels from a version-6 `.cineserye` backup, and reran the visual accessibility scan. The live smoke remains deliberately opt-in through `CINESERYE_RUN_STORYBOARD_SMOKE=1` because it can spend Vertex credits.

## 9. Sprint 5 — Professional Planning and Handoff

### Sprint objective

Make the accepted plan useful for a real solo pre-production workflow beyond the canvas through dense editing, production grouping, continuity review, and portable reports.

### In scope

- shot table and storyboard view;
- optional directed storyboard alternatives—production-safe, emotion-first, visually experimental, and budget-conscious—without changing the one-shot approval boundary;
- narrative order and production order;
- camera/lighting/location setup groups;
- continuity matrix and affected-shot analysis;
- batch edit and shot status;
- shot-list CSV, storyboard/shot-list PDF, prompt package, source/provenance report, and cost report;
- print/mobile readiness;
- export validation and deterministic filenames.

### Work packages

#### S5-WP1 — Shot table and board projection

- Add table/board/canvas view switching without duplicating domain state.
- Expose configurable columns for shot, beat, description, framing, angle, movement, lens, duration, audio, continuity, risk, cost, and status.
- Route edits/reorder through Sprint 2 domain commands.

#### S5-WP1A — Directed storyboard alternatives (optional, bounded)

- Let the creator request explicit alternative intents such as production-safe, emotion-first, visually experimental, or budget-conscious rather than relying only on stochastic samples of one prompt.
- Record the selected intent, prompt version, references, provider/model, and settings with every generated frame.
- Preserve the current one-shot scope, 1–4 output cap, explicit confirmation, spend guard, and single approved anchor.
- Do not add video generation, automatic approval, or an autonomous prompt loop.

#### S5-WP2 — Production setups and order

- Add setup records with camera, lens, lighting, location, equipment, notes, and estimated setup time.
- Preserve narrative order separately from production order.
- Group and drag shots between setups with validation.

#### S5-WP3 — Continuity matrix and change impact

- Provide characters/wardrobe/props/location/style/audio versus shots matrix.
- Warn on missing or conflicting dependencies.
- Show affected shots before accepting shared-reference edits.

#### S5-WP4 — Handoff exports

- Implement deterministic CSV, PDF, Markdown/JSON, source/provenance, and generation-cost exports.
- Include project, scene, revision, timestamps, provider/model/settings, citation state, rights notes, and illustrative-cost disclaimer.
- Sanitize filenames and exported rich text.

#### S5-WP5 — Set-use and mobile polish

- Add planned/ready/captured/skipped states without conflating generation and physical capture.
- Provide a compact phone shot checklist and printable fallback.

### Sprint 5 acceptance criteria

- UC-08 produces readable, complete, revision-specific exports.
- Table edits and canvas/outline/inspector remain synchronized.
- Narrative order remains stable when production order changes.
- Continuity conflicts are visible before export.
- Every export passes schema/content and visual layout verification.
- When directed alternatives are enabled, every candidate exposes its declared intent and remains independently reviewable and unapproved.

### Sprint 5 test cases

| ID | Level | Test |
| --- | --- | --- |
| S5-UT-01 | Unit | Narrative and production order validate independently. |
| S5-UT-02 | Unit | Setup moves preserve every shot exactly once. |
| S5-UT-03 | Unit | Continuity matrix detects missing and conflicting dependencies. |
| S5-UT-04 | Unit | CSV/JSON/Markdown exports escape formulas, markup, and unsafe URLs. |
| S5-UT-05 | Unit | Directed storyboard intents remain bounded, provenance-complete, and separate from approval state. |
| S5-IT-01 | Integration | Batch table edits produce one undoable synchronized transaction. |
| S5-IT-02 | Integration | All exports round-trip or validate against their documented contract. |
| S5-E2E-01 | Browser | Switch among canvas, table, and board without losing selection or edits. |
| S5-E2E-02 | Browser | Drag production order without changing narrative playback order. |
| S5-E2E-03 | Browser | Phone checklist remains usable with enlarged text and reduced motion. |
| S5-VIS-01 | Visual | Render every PDF page and inspect clipping, pagination, headings, images, and disclaimers. |

### Sprint 5 regression gate

- Canvas remains the relationship view, not a second source of truth.
- Existing SVG and `.cineserye` exports still behave identically.
- Spreadsheet exports neutralize formula injection.
- PDF generation runs locally and does not upload project content.

### Sprint 5 demo gate

Complete UC-08 and hand the exported package to a reviewer unfamiliar with the app. The reviewer must identify shot order, references, prompts, costs, and open warnings without opening Cineserye.

**Completion evidence:** passed. The accepted revision now drives synchronized Canvas, Shot table, and Board projections; production order and setup membership validate independently from narrative order; continuity states surface conflicts before export; and directed storyboard candidates retain a declared bounded intent while remaining unapproved. The local handoff downloads as one Safari-compatible ZIP containing six deterministic revision-specific files (CSV shot list, PDF shot list, prompt Markdown, source/provenance Markdown, cost CSV, and JSON manifest). Formula injection, markup, unsafe URLs, filenames, revision scoping, and ZIP membership are unit-tested. The generated PDF was rendered through Poppler and visually inspected after fixing line clipping and punctuation degradation. The close gate passed TypeScript, ESLint, all 149 unit/integration tests with two opt-in live skips, Vinext 100% compatibility, client-boundary validation, production build, high-severity audit, and all 166 runnable Playwright scenarios across Chromium, Firefox, and WebKit with two intended stress skips. No live provider credits were spent and nothing was deployed.

## 10. Sprint 6 — One-Shot Video Experiment

### Sprint objective

Turn one approved storyboard frame into one reviewable clip with strict capability, spend, storage, cancellation, provenance, and approval controls.

### In scope

- provider-neutral video-generation contract;
- current Vertex/Veo capability registry selected at implementation time;
- approved start frame and optional approved end frame;
- one-shot prompt/settings preflight;
- bounded sample count, duration, resolution, and cost;
- asynchronous operation state, polling/cancellation, timeout, and retry;
- local video artifact storage and download;
- version comparison and approval;
- no multi-shot generation or automatic timeline assembly.

### Work packages

#### S6-WP1 — Capability-aware video provider

- Define `VideoGenerationProvider`, operation schemas, status polling, cancellation, and typed errors.
- Query or configure supported model capabilities; never assume references, start/end frames, audio, aspect ratio, or duration are universally supported.
- Keep model IDs environment-controlled and verified against official availability during implementation.

#### S6-WP2 — Video artifact and operation domain

- Add operation and clip records with shot/frame/revision, prompt, references, provider/model/settings, duration, resolution, audio flag, seed when available, usage/cost, hashes, timestamps, and approval.
- Preserve failed/cancelled operation metadata without incomplete media.

#### S6-WP3 — Video preflight and spend guard

- Show start/end frames, motion prompt, negative constraints, model capability, duration, resolution, audio, sample count, and estimated spend.
- Require explicit confirmation and enforce server-side ceilings.

#### S6-WP4 — Long-running operation UX

- Add queued/running/finalizing/ready/failed/cancelled states.
- Support cancel, safe retry, background-tab resilience, and reload recovery where the provider operation ID remains valid.
- Never auto-approve a finished clip.

#### S6-WP5 — Video storage, portability, and review

- Store clips content-addressably with explicit local quota handling.
- Allow download and metadata export.
- Define whether `.cineserye` embeds video, references an external file, or creates a separate media bundle; never silently create huge backups.
- Add side-by-side/version-stack review and one current approval.

### Sprint 6 acceptance criteria

- UC-09 succeeds for one shot and one bounded clip.
- Unsupported model/setting combinations are blocked before spend.
- Cancelling or failing preserves plan, references, and approved frame.
- Every clip is traceable and remains unapproved until reviewed.
- Storage quota and portability behavior are explicit.

### Sprint 6 test cases

| ID | Level | Test |
| --- | --- | --- |
| S6-UT-01 | Unit | Capability registry blocks unsupported references, frames, durations, and audio. |
| S6-UT-02 | Unit | Spend policy rejects excessive duration/resolution/sample count. |
| S6-UT-03 | Unit | Clip metadata resolves approved frame, shot, plan revision, and prompt version. |
| S6-IT-01 | Integration | Mock long-running operation progresses deterministically and survives reload. |
| S6-IT-02 | Integration | Cancel, timeout, provider failure, and retry produce valid terminal states. |
| S6-IT-03 | Integration | Quota failure never leaves an accepted or orphaned media record. |
| S6-E2E-01 | Browser | Frame → preflight → operation → clip review → approval succeeds. |
| S6-E2E-02 | Browser | Changing settings invalidates confirmation and recomputes estimate. |
| S6-E2E-03 | Browser | Cancel and retry remain operable on mobile and keyboard. |
| S6-LIVE-01 | Opt-in live | One safe bounded sample completes or returns a classified provider error. |
| S6-PRIV-01 | Privacy | Video payload, logs, traces, and exports contain only intended inputs/metadata. |

### Sprint 6 regression gate

- No video SDK enters the client bundle.
- Storyboard frame approval remains independently reversible.
- Ordinary test/build commands never call the live video provider.
- Media cleanup never deletes referenced or approved images.

### Sprint 6 demo gate

Complete UC-09 with a bounded fixture operation and one approved live sample only when credits and content transfer are explicitly reviewed.

**Completion evidence:** passed in deterministic fixture mode. The accepted frame-to-clip workflow now uses a provider-neutral asynchronous contract and a dated, environment-selectable Veo 3.1 profile. Unsupported frame formats, reference-image combinations, duration, aspect, resolution, audio, and sample counts are rejected before provider work; live mode additionally requires a current per-second price and per-request ceiling. Operations persist queued/running/finalizing/ready/failed/cancelled/timed-out state and retry lineage, survive browser reload while the local server owns the provider handle, and never alter the accepted plan or frame. Valid fixture MP4 bytes are content-addressed locally only after successful persistence; quota failure creates no clip record. Candidates retain exact revision/prompt/frame/provider/settings/cost provenance and remain unapproved until review. MP4 and JSON metadata downloads are explicit, while `.cineserye` backups clearly preserve metadata only. Vinext compatibility, TypeScript, ESLint, 162 passing unit/integration tests with three opt-in live skips, build, client-boundary scanning, high-severity dependency audit, and the full 175-scenario Chromium/Firefox/WebKit browser regression suite passed with two intended stress skips. The opt-in live Veo smoke was intentionally skipped, so no provider credits or external content transfer occurred.

## 11. Sprint 7 — Multi-Scene Microdrama Production

### Sprint objective

Expand the proven single-scene loop into a small project while preserving scene-level approval, shared continuity, revision history, budgets, and performance.

### In scope

- manual multi-scene creation;
- plain-text/treatment import with proposed scene boundaries;
- explicit review before creating scene records;
- project outline with multiple scenes and active scene;
- shared characters, locations, props, wardrobe, and style references;
- project-level continuity and change impact;
- per-scene plans/revisions and project totals;
- scene-level storyboard/video artifacts;
- simple approved-clip sequence view after Sprint 6;
- no Final Draft fidelity, real-time collaboration, or deployed cloud store.

### Work packages

#### S7-WP1 — Multi-scene project domain

- Generalize scene identity and ordering.
- Allow shared entities across scene IDs with scoped variants.
- Preserve existing single-scene projects as valid multi-scene projects with one scene.

#### S7-WP2 — Scene creation and import review

- Add manual scene creation and duplication.
- Accept plain text or treatment input and propose boundaries/beat summaries.
- Require creator review/edit before adding scenes.
- Keep FDX/Fountain parsing as separately scoped adapters if later required.

#### S7-WP3 — Project Outline and navigation

- Group each scene's planning, references, shots, frames, and clips.
- Support active-scene focus, filtering, collapsed state, and project totals.
- Keep large projects responsive through projection memoization/virtualization where needed.

#### S7-WP4 — Shared continuity and variants

- Reuse global characters/assets with per-scene wardrobe, age, condition, time-of-day, and location variants.
- Show project-wide affected scenes/shots before accepting a shared change.
- Add continuity exceptions with explicit rationale.

#### S7-WP5 — Project planning and sequence

- Plan scenes independently and optionally request a project-level coverage/continuity review that cannot mutate scenes automatically.
- Add a simple sequence of approved clips/frames with narrative order, duration, and missing-shot indicators.

#### S7-WP6 — Project performance, portability, and evaluation

- Stress test realistic microdrama sizes and media references.
- Define storage budgets, lazy media loading, and backup bundles.
- Expand behavioral evals to cross-scene continuity and intent preservation.

### Sprint 7 acceptance criteria

- UC-10 creates three reviewed scenes and plans each independently.
- Shared continuity updates identify every affected shot before acceptance.
- One scene's failure or revision does not corrupt another scene.
- Project totals equal scene totals; narrative and production orders remain explicit.
- Single-scene backups migrate without visible regression.

### Sprint 7 test cases

| ID | Level | Test |
| --- | --- | --- |
| S7-UT-01 | Unit | Single-scene data migrates to a valid multi-scene project. |
| S7-UT-02 | Unit | Scene order, shared entities, scoped variants, and exceptions validate. |
| S7-UT-03 | Unit | Project totals equal exact scene/shot/artifact totals. |
| S7-IT-01 | Integration | Proposed scene import creates nothing until explicit acceptance. |
| S7-IT-02 | Integration | Revising one scene preserves other accepted revisions byte-for-byte. |
| S7-IT-03 | Integration | Shared-reference change produces complete affected-scene analysis. |
| S7-E2E-01 | Browser | Create, reorder, filter, collapse, and plan three scenes. |
| S7-E2E-02 | Browser | Navigate shared character usages and approve one scoped variant. |
| S7-E2E-03 | Browser | Sequence view identifies approved, missing, failed, and unplanned shots. |
| S7-PERF-01 | Performance | Ten scenes, 100 shots, 50 references, and media metadata remain within interaction budgets. |
| S7-EVAL-01 | Evaluation | Cross-scene character, wardrobe, prop, location, and tone continuity meets threshold. |

### Sprint 7 regression gate

- Single-scene projects behave exactly as before unless multi-scene features are used.
- Scene isolation holds across planning, revisions, recovery, media, and undo.
- Large projects do not eagerly decode every image/video blob.
- Backup restore clearly reports missing external media without fetching it.

### Sprint 7 demo gate

Complete UC-10 and export a three-scene project package. This closes the multi-scene foundation and unlocks the separately gated local copilot work in Sprint 8; hosted collaboration remains a separate program.

**Completion evidence:** passed in deterministic fixture mode. The new Project workspace creates or duplicates outlines, parses plain-text treatments into editable boundary proposals without mutation, and adds them only after acceptance. Each scene keeps an independent active revision; accepting or revising one scene preserves every other scene and canvas host. Project totals, narrative order, production order, artifact status, filtering, collapse state, active-scene navigation, shared entity usage, impact review, scoped variants, and rationale-backed exceptions are derived from the validated sidecar. The 10-scene/100-shot/50-reference performance case remains metadata-only and completes within its interaction budget. The local Agents CLI `cross_scene_impact_contract` graded 2/2 cases with a 1.0000 mean and no cloud call. Vinext compatibility remained 100%; TypeScript, ESLint, build, client-boundary scanning, high-severity audit, 170 passing unit/integration tests with three opt-in live skips, and the complete 184-pass Chromium/Firefox/WebKit browser matrix with two intended stress skips passed. No live planning, storyboard, video, or managed evaluation call ran; no provider credits were spent and nothing was deployed.

## 12. Sprint 8 — Continuity-Aware Copilot Audit

### Sprint objective

Turn the verified multi-scene project model into a trustworthy, fixture-first copilot that audits one explicit scope, discloses evidence and impact, and prepares bounded corrections without gaining direct mutation authority.

### Product boundary

- The creator chooses a project, scene, or shared character/asset scope.
- An audit run returns at most five ranked findings; it does not edit the project.
- A finding may prepare one correction proposal only after the creator asks for it.
- A correction proposal contains deterministic affected-record and cost-delta analysis.
- Accept and reject remain explicit; acceptance is one validated, undoable command batch.
- No live Parallel, Vertex, storyboard, or video call is required for Sprint 8.
- No background audit, autonomous acceptance, cross-session personal memory, or deployment is added.

### Selected architecture

```text
Creator-selected scope + immutable project fingerprint
  → deterministic context/relationship projection
  → provider-neutral audit analyzer (fixture first)
  → CinemaAuditResultV1 runtime validation
  → ranked read-only findings
  → creator selects one finding
  → deterministic correction compiler
  → CanvasCommandProposal validation
  → ghost diff + impact/cost review
  → explicit accept or reject
```

The TypeScript application remains the production runtime. Google Agents CLI supports design discipline and local behavioral grading; it does not justify introducing a second Python production service. Before implementation, study the `deep-search` recipe for bounded cited research and the `long-horizon-harness` recipe for human approval/tool guards, then adapt only the relevant patterns to the existing TypeScript boundary.

### Domain additions

- `CinemaAuditRunRecord`: scope, source fingerprint, analyzer/version, lifecycle, timestamps, and sanitized telemetry identity.
- `CinemaAuditFindingRecord`: category, severity, confidence band, explanation, evidence record IDs, affected scene/shot IDs, and disposition.
- `CinemaAuditCorrectionProposal`: one finding, validated commands, before/after summary, expected continuity effect, cost delta, and proposal fingerprint.
- Supported first-pass categories: character identity, wardrobe/condition, prop/location state, time-of-day/period, visual-style drift, missing continuity dependencies, duration, and generation-budget exposure.
- Every record is additive and optional so valid Sprint 7 backups migrate to an empty audit collection without visible change.

### Work packages and implementation order

#### S8-WP1 — Contract, recipe study, and threat model

- Update `.agents-cli-spec.md` with the audit lifecycle, tools, non-goals, and approval boundary.
- Study the two matching ADK reference recipes and record exactly which approval/citation patterns will be adapted.
- Define prompt-injection, stale-project, false-positive, over-broad-mutation, and sensitive-telemetry threats.
- Lock the fixture schema and feature flag before UI work begins.

#### S8-WP2 — Audit domain and deterministic context builder

- Add versioned audit records, migration, runtime validation, and `.cineserye` round-trip support.
- Build a metadata-only context projection for the chosen scope; never include unrelated project text or media bytes.
- Calculate affected scenes/shots and estimated cost delta deterministically from accepted records.
- Fingerprint the exact source revisions so findings and corrections can become stale safely.

#### S8-WP3 — Fixture analyzer and correction compiler

- Introduce a provider-neutral `CinemaAuditProvider` with a deterministic fixture implementation.
- Treat findings as untrusted input; reject unknown IDs, unsupported categories, impossible evidence, duplicate findings, and unsafe command intent.
- Compile allowed corrections through cinema-domain commands and the existing canvas proposal validator.
- Prevent the analyzer from importing editor state, persistence, backup, export, media, or direct command-application functions.

#### S8-WP4 — Audit and correction-review experience

- Add **Audit project** to the Project workspace with visible Fixture mode.
- Present severity, confidence, explanation, evidence, affected scenes/shots, and estimated regeneration impact without relying on color.
- Let the creator dismiss a finding, mark it intentional, or prepare its correction.
- Show a ghost diff and exact affected-record list before accepting one correction.
- Invalidate the proposal when its scope, accepted revision, shared variant, or cost basis changes.

#### S8-WP5 — Evaluation and sanitized telemetry

- Extend the local trace dataset with known continuity conflicts, intentional exceptions, clean controls, prompt injection, and stale-snapshot cases.
- Grade structural behavior locally with Agents CLI custom metrics; do not use an LLM judge in ordinary CI.
- Record only IDs, counts, timings, provider/version, statuses, and metric results by default—never raw scenes, prompts, research excerpts, or media.
- Add an optional ADK-compatible evaluation endpoint only if it can remain isolated from the production runtime; do not scaffold a Python service merely to satisfy the CLI.

#### S8-WP6 — Portability, accessibility, performance, and closure

- Preserve audit records and dispositions in backup/restore without persisting secrets or raw provider payloads.
- Ensure the complete audit/review/accept/undo workflow is keyboard-operable at 390px and has no serious accessibility violations.
- Keep scope projection and impact calculation under the project interaction budget for 10 scenes/100 shots/50 references.
- Run all Sprint 1–7 regression suites before closing the sprint.

### Sprint 8 acceptance criteria

- UC-11 completes in Fixture mode from scope selection through one accepted correction and one-step undo.
- An audit result can contain findings but cannot contain or apply editor commands.
- Every finding resolves to real evidence records and lists the complete affected scene/shot set.
- The correction compiler permits only the allowlisted domain changes for that finding.
- Rejecting or dismissing a finding leaves the accepted document byte-equivalent.
- Acceptance creates exactly one history entry and never changes an unrelated scene revision.
- Any source fingerprint mismatch marks the result stale and blocks acceptance until re-audit.
- Intentional continuity exceptions suppress or qualify the matching finding rather than being overwritten.
- Fixture mode makes zero external requests and produces deterministic results.
- The local evaluation achieves 100% critical-fixture recall, zero unsafe mutations, zero missing affected records, and no false positives in the clean-control fixtures.

### Sprint 8 test cases

| ID | Level | Test |
| --- | --- | --- |
| S8-UT-01 | Unit | Audit records, findings, evidence, lifecycle, and migration validate strictly. |
| S8-UT-02 | Unit | Scope projection includes required shared records and excludes unrelated scene text/media. |
| S8-UT-03 | Unit | Impact analysis returns the exact affected scenes/shots and reconciled cost delta. |
| S8-UT-04 | Unit | Fingerprint changes invalidate a pending finding/correction. |
| S8-UT-05 | Unit | Intentional exceptions suppress or qualify matching findings. |
| S8-SEC-01 | Security | Prompt injection in scene, source, or asset text remains inert data. |
| S8-SEC-02 | Security | Provider output containing raw canvas commands, unknown IDs, or over-broad changes is rejected. |
| S8-IT-01 | Integration | Fixture audit creates read-only findings and no canvas/history mutation. |
| S8-IT-02 | Integration | One correction previews, accepts atomically, and reverses with one undo. |
| S8-IT-03 | Integration | Reject, dismiss, stale result, failure, timeout, and cancellation preserve accepted state. |
| S8-IT-04 | Integration | Audit records round-trip through IndexedDB and `.cineserye` backup/restore. |
| S8-E2E-01 | Browser | Audit Mara across three scenes, inspect all impact, prepare a scoped variant, accept, and undo. |
| S8-E2E-02 | Browser | Mark an intentional continuity exception and confirm the audit explanation updates. |
| S8-E2E-03 | Browser | Keyboard/mobile audit, review, reject, stale-state recovery, and focus restoration remain usable. |
| S8-A11Y-01 | Accessibility | Findings, severity, confidence, evidence, impact, and approval state are conveyed semantically. |
| S8-PERF-01 | Performance | Audit projection for 10 scenes/100 shots/50 references completes within 100ms without reading blobs. |
| S8-EVAL-01 | Evaluation | Conflict, clean-control, exception, injection, and stale-snapshot cases meet the agreed structural thresholds. |

### Sprint 8 regression gate

- Planning, references, storyboard, video, professional views, multi-scene revisions, backups, and exports behave as before when audit is unused.
- The audit cannot silently broaden a shared entity's scene scope.
- A correction never invalidates an unrelated approved frame or clip without listing it in impact.
- Existing `cross_scene_impact_contract` cases remain at a 1.0000 local score.
- Provider SDKs remain absent from the client bundle.

### Sprint 8 demo gate

Complete UC-11 with the three-scene Mara wardrobe/condition inconsistency, show the complete affected-shot disclosure, accept one scoped correction, undo it, and show a clean re-audit. This closes Gate F without any external call or provider spend.

**Completion evidence:** implemented in Fixture mode. The Project workspace exposes project, scene, and entity scopes; the deterministic analyzer ranks no more than five continuity/duration/budget findings; dismiss leaves continuity records unchanged; accepting an intentional exception rechecks the source fingerprint and executes one cinema-domain transaction. Focused S8 tests cover deterministic fingerprints, read-only audit, correction acceptance, and stale rejection. A three-browser scenario creates a scene-scoped wardrobe change, inspects its complete audit impact, records the intentional exception, and reverses it with one Undo. No provider call is made.

## 13. Sprint 9 — Controlled Live Research and Planning

### Sprint objective

Prove that Cineserye can safely run one bounded live public-web research plus Vertex text-analysis workflow while using the intended Google identity/project, minimizing transferred content, enforcing application-level spend limits, preserving citations, and requiring explicit creator approval before every mutation.

### In scope

- Live Parallel Search for current, public-web evidence.
- Live Vertex Gemini text analysis/planning through the existing server-only TypeScript/ADK adapter.
- One preflight and consent contract shared by scene planning and continuity audit.
- Exact Google Cloud identity/project/quota-project verification for local development.
- Provider usage/cost evidence, cancellation, bounded retry, idempotency, and classified failures.
- Fixture-first CI plus separately invoked live smoke tests.
- No deployment, service-account creation, infrastructure provisioning, cloud project storage, authentication, live storyboard generation, or live Veo generation.

### Mandatory Google Cloud boundary

- Required user account: `elbertluta@gmail.com`.
- Required Google Cloud project: `cineserye`.
- Required ADC quota project: `cineserye`.
- CLI credentials and Application Default Credentials are separate and must both be checked before a live request.
- Every scriptable `gcloud` command must pass explicit account/project flags when supported; repository tooling must not rely on whichever global configuration happens to be active.
- A mismatched account, project, quota project, disabled live flag, missing consent receipt, or missing spend ceiling is a hard stop—never a warning with fallback.
- Credential login, quota-project mutation, API enablement, budget/spend-cap creation, IAM changes, and any live request require explicit user authorization at execution time.

### Work packages and implementation order

#### S9-WP1 — Read-only environment and capability preflight

- Add a repository-owned preflight that reports CLI account, configured project, ADC presence/quota project, required API availability, provider mode, selected model/profile, and live-test flags without printing tokens.
- Fail closed unless the expected account/project contract is satisfied.
- Discover available models and current pricing/capability documentation at implementation time; do not silently replace the configured model.
- Keep account switching and ADC login as explicit operator actions rather than automatic side effects.

#### S9-WP2 — Consent and application-level spend policy

- Show provider, exact data classes, public-search objective, minimized Vertex context, maximum calls/results/characters, selected model, and configured per-run ceiling.
- Bind consent to a payload/provider/pricing hash and invalidate it on any material change.
- Require an operator-configured hard per-run ceiling; live mode is disabled when it is absent.
- Add a local session/day safeguard and stop follow-on calls when the application ceiling is exhausted.
- Treat Cloud Billing alerts as notifications rather than a guaranteed cap; optionally review an eligible project spend cap separately, never as a substitute for server-side limits.

#### S9-WP3 — Parallel Search hardening

- Keep `PARALLEL_API_KEY` server-only and use the documented Search API contract.
- Bound the objective, query count, result count, excerpt character budget, timeout, and retry count.
- Normalize URL, title, excerpts, publish date, search/session IDs, warnings, and usage while retaining only the minimum evidence required by the project.
- Deduplicate canonical URLs, allow only `https`, reject malformed responses, and treat retrieved text as untrusted.
- Preserve limited-research behavior when no supported result remains.

#### S9-WP4 — Vertex audit/planning hardening

- Send only the selected scene/audit scope, explicit constraints, normalized findings, and normalized citations.
- Require schema-constrained output and at most one structural repair attempt.
- Preserve the TypeScript production runtime and existing provider-neutral interface.
- Block direct commands, unresolved IDs, unsupported mutation kinds, uncited external claims, and output exceeding shot/finding/cost limits.
- Record model/profile, region, request identity, usage when returned, and sanitized failure class without prompt/response bodies.

#### S9-WP5 — Lifecycle, cancellation, and failure recovery

- Link research and planning spans under one run ID with abort propagation.
- Permit one bounded retry only for classified transient failures; never retry safety, quota, consent, validation, or spend failures automatically.
- Prevent duplicate chargeable work through request fingerprints/idempotency where the provider supports it and local pending-run recovery otherwise.
- Persist a content-free failure/cancellation record while leaving the accepted project unchanged.
- Require a new consent receipt before retrying after any payload, provider, model, or price change.

#### S9-WP6 — Evaluation, live smoke, documentation, and closure

- Keep deterministic unit/integration/browser tests as the required CI path.
- Expand Agents CLI traces to cover correct tool order, citation grounding, abstention, mutation refusal, content minimization, and spend-policy adherence.
- Run live tests individually and only after the user approves the displayed maximum cost and transferred content.
- Start with one bounded Parallel-only smoke and one Vertex-only smoke; run the combined UC-12 smoke only after both pass.
- Record date, account/project assertion, model/profile, request counts, returned usage, estimated/actual charge when available, and outcome—never credentials or raw content.
- Update README, privacy baseline, architecture, provider runbook, test plan, and hackathon demo evidence.

### Sprint 9 acceptance criteria

- UC-12 completes only after the preflight proves `elbertluta@gmail.com` + `cineserye` + ADC quota project `cineserye` and the creator confirms the exact transfer/spend summary.
- A mismatched account/project/quota project blocks the live button and produces actionable remediation without changing global CLI state automatically.
- Ordinary development, CI, unit, build, and browser commands make zero live provider requests.
- One live audit uses no more calls/results/characters than the confirmed envelope and never triggers storyboard/video generation.
- Every displayed live research claim resolves to a returned Parallel URL; unsupported claims are labeled or omitted.
- All Vertex output passes domain and command validation before it becomes a reviewable correction.
- Cancel, timeout, quota, safety, malformed output, and provider failure leave the accepted project unchanged and create no orphaned artifact.
- The provider usage summary reconciles request counts and records unavailable price fields honestly rather than inventing costs.
- No secret, access token, raw provider header, raw scene/prompt, or full research excerpt appears in client bundles, exports, default logs, or traces.
- Live acceptance never deploys resources, enables APIs, changes IAM, or creates a cloud budget implicitly.

### Sprint 9 test cases

| ID | Level | Test |
| --- | --- | --- |
| S9-UT-01 | Unit | Preflight rejects wrong CLI account, project, ADC quota project, mode, or missing ceiling. |
| S9-UT-02 | Unit | Consent hash changes when payload, provider, model, pricing snapshot, or limits change. |
| S9-UT-03 | Unit | Spend policy blocks missing/stale pricing, excessive calls, or exhausted local allowance. |
| S9-UT-04 | Unit | Parallel response normalization validates URLs, citations, warnings, usage, and character caps. |
| S9-UT-05 | Unit | Vertex result normalization rejects unknown IDs, commands, unsupported claims, and excess output. |
| S9-UT-06 | Unit | Retry classifier permits only bounded transient retries. |
| S9-SEC-01 | Security | API keys, ADC tokens, headers, prompts, and raw excerpts are absent from client/export/log/trace fixtures. |
| S9-SEC-02 | Security | Retrieved prompt injection cannot alter tool order, provider limits, or mutation policy. |
| S9-IT-01 | Integration | Mock Parallel → mock Vertex → validation → ghost review follows the required tool sequence. |
| S9-IT-02 | Integration | Cancellation aborts both phases and preserves accepted state. |
| S9-IT-03 | Integration | Reload recovers a ready proposal without repeating a chargeable request. |
| S9-IT-04 | Integration | Quota, safety, timeout, malformed response, and network failures classify correctly with no orphan. |
| S9-E2E-01 | Browser | Live preflight displays identity/project, transfer classes, limits, and spend ceiling before confirmation. |
| S9-E2E-02 | Browser | Changing any live setting invalidates confirmation and blocks submission. |
| S9-E2E-03 | Browser | Mock live success, cancellation, error, and retry remain keyboard/mobile accessible. |
| S9-EVAL-01 | Evaluation | Tool order, citation grounding, abstention, mutation refusal, and spend compliance meet thresholds. |
| S9-LIVE-00 | Opt-in read-only | Verify intended CLI account/project, ADC quota project, model availability, and API readiness without an AI request. |
| S9-LIVE-01 | Opt-in live | One non-confidential bounded Parallel search returns normalized citations and usage. |
| S9-LIVE-02 | Opt-in live | One non-confidential bounded Vertex fixture returns schema-valid text output. |
| S9-LIVE-03 | Opt-in live | One explicitly approved UC-12 audit completes within the displayed envelope. |

### Sprint 9 regression gate

- Fixture behavior remains deterministic and is the default even when credentials exist locally.
- Existing live media routes remain separately disabled and cannot be reached from the audit/planning workflow.
- Provider SDK/config modules remain server-only.
- All Sprint 1–8 mutation, revision, rights, provenance, accessibility, portability, and performance gates remain green.
- The complete three-browser suite passes with mocked providers before any opt-in live smoke.

### Sprint 9 demo gate

Show the read-only preflight, a consent screen with the exact Parallel/Vertex transfer and ceiling, one approved live UC-12 run, cited findings, a rejected correction with no mutation, and the sanitized usage receipt. If identity, quota project, price, model availability, or provider configuration cannot be proven, demonstrate the safe blocked state and do not spend credits.

**Completion evidence:** the safe blocked state and controlled live boundary are implemented and verified with mocked configuration/provider tests. Live mode requires the exact `elbertluta@gmail.com` account assertion, project and ADC quota project `cineserye`, positive operator ceiling, local enable switch, and a digest-bound consent receipt for the selected brief. The credit-consuming S9-LIVE-01/02/03 cases are **Not run** because no fresh authorization was requested at execution time. No global CLI state, API, IAM, budget, or deployment setting was changed.

### Current primary references for implementation-time verification

- [Google Cloud ADC setup](https://docs.cloud.google.com/docs/authentication/provide-credentials-adc)
- [Google Cloud quota project](https://docs.cloud.google.com/docs/quotas/set-quota-project)
- [Google Gen AI SDK for Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs/sdks/overview)
- [Vertex AI model catalog](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models)
- [Cloud Billing budgets and alerts](https://docs.cloud.google.com/billing/docs/how-to/budgets)
- [Parallel Search quickstart](https://docs.parallel.ai/search/search-quickstart)
- [Parallel Search API reference](https://docs.parallel.ai/api-reference/search/search)

## 14. Sprint 10 — Agent Quality, Telemetry, and Reliability Closure

### Sprint objective

Turn the Sprint 8–9 copilot into an evidence-backed demo candidate by proving agent quality on development and sealed holdout cases, adding privacy-preserving local diagnostics, exercising recovery under faults and sustained fixture load, and reconciling every provider action against consent and spend policy. This sprint improves confidence rather than adding another creative capability.

### In scope

- Versioned development and holdout evaluation datasets for scene planning and continuity audit.
- Deterministic local Agents CLI code metrics as mandatory hard gates.
- Optional managed/LLM-judge metrics only after separate content, region, model, and credit approval.
- Local no-content traces, aggregate reliability diagnostics, bounded retention, and creator feedback tags.
- Fault injection, cancellation races, reload recovery, concurrency, soak testing, and storage cleanup.
- Provider usage ledger, cost reconciliation, circuit breakers, and demo-readiness reporting.
- No deployment, Cloud observability infrastructure, prompt-response logging, BigQuery analytics, automatic prompt optimization, or autonomous learning.

### Evaluation strategy

- Maintain at least 24 synthetic/non-confidential cases: 18 development cases and six sealed holdout cases.
- Cover newcomer and professional language, multiple genres/intents, clean controls, known continuity conflicts, intentional exceptions, limited research, stale state, prompt injection, provider errors, budget pressure, and cancellation.
- Never tune prompts or thresholds against the holdout set; reveal its detailed results only at release-candidate gates.
- Required deterministic metrics: schema validity, complete impact disclosure, citation resolution, mutation safety, consent/tool-order compliance, spend-policy compliance, and telemetry redaction.
- Optional managed metrics: `multi_turn_task_success`, `multi_turn_trajectory_quality`, `multi_turn_tool_use_quality`, `grounding`, and `safety`, selected only for compatible trace shapes.
- Compare every candidate result against its recorded baseline with `agents-cli eval compare`; a target improvement may not hide regression in a hard gate.
- `eval` command success is not evidence by itself—the recorded metric values and per-case failures decide the gate.

### Observability tiers and privacy decision

#### Required Tier 0 — local no-content diagnostics

- Store run/trace IDs, phases, provider/model profile, duration, status, retry/cancel class, counts, usage/cost summary, validation outcome, and acceptance disposition.
- Never store raw scene text, complete prompts/responses, research excerpts, media, credentials, tokens, or provider headers.
- Retain at most 500 trace events or 30 days locally, whichever limit is reached first, with explicit cleanup and export controls.

#### Optional Tier 1 — one-run Cloud Trace smoke

- Consider only after explicit user selection and verification of `elbertluta@gmail.com` with project/quota project `cineserye`.
- Use no-content span/event capture and inspect the exported span fields before repeating the run.
- Treat this as an opt-in external transfer that can consume cloud resources; it is not required for the local Sprint 10 gate.

#### Out of scope Tier 2 — prompt/response logging and analytics infrastructure

- Do not enable completion upload hooks, GCS prompt/response storage, BigQuery Agent Analytics, Terraform observability resources, or third-party telemetry in this roadmap.
- These tiers can capture or retain substantially more content and require a separate retention, IAM, billing, deletion, and deployment decision.

### Work packages and implementation order

#### S10-WP1 — Quality contract and baseline freeze

- Version the quality policy, dataset manifest, agent/provider versions, metrics, thresholds, and scoring rationale.
- Freeze the Sprint 9 fixture behavior as the comparison baseline.
- Define P0 hard-gate failures that cannot be averaged away: unsafe mutation, missing affected record, unresolved citation, consent bypass, secret/content leak, and spend-ceiling bypass.
- Document when a threshold may change and require an explicit rationale plus baseline re-grade.

#### S10-WP2 — Evaluation corpus, metrics, and comparison loop

- Build separate development and sealed holdout datasets using the canonical single-turn or multi-turn trace shape as appropriate.
- Implement trusted local code metrics in real modules with tests; never embed unreviewed executable code from provider output.
- Run prepare → grade → analyze → fix → compare iterations on development cases before opening holdouts.
- Keep managed analysis, synthesis, optimization, remote code execution, and LLM judging disabled unless explicitly authorized.
- Produce timestamped JSON/HTML artifacts plus a concise machine-readable gate summary.

#### S10-WP3 — Local no-content telemetry and feedback

- Standardize span/event names across audit, research, planning, validation, proposal, review, cancellation, and recovery.
- Add a local diagnostics view with latency/error/usage aggregates and trace-to-run navigation without creative content.
- Add structured feedback tags such as helpful, false positive, missing impact, unclear evidence, too expensive, and unsafe suggestion.
- Keep optional free-text feedback local and excluded from default telemetry/eval export.
- Add retention, deletion, redacted export, and backup-exclusion tests.

#### S10-WP4 — Reliability and fault/soak harness

- Add deterministic fault injection for timeout, rate limit, quota, malformed data, citation loss, cancellation race, reload, offline transition, storage failure, and duplicate completion.
- Exercise concurrent runs on different scenes while continuing to reject duplicate active runs for the same scope.
- Run at least 100 fixture workflows with seeded variation and verify no orphan proposals/media, leaked handles, duplicate charges, or unreconciled terminal states.
- Track p50/p95 latency and storage growth; investigate any unexplained regression over the established budgets.

#### S10-WP5 — Spend ledger and circuit breakers

- Record consent envelope, provider request count, returned usage, estimate basis, currency, actual charge when supplied, and unknown/unpriced fields honestly.
- Reconcile research, planning, storyboard, and video as separate spend categories without allowing one approval to authorize another.
- Stop follow-on work on exhausted allowance, stale pricing, usage/estimate mismatch beyond policy, or missing provider receipt.
- Add a manual local kill switch that disables every live provider while preserving Fixture mode and accepted projects.
- Treat local totals as operational evidence, not as a replacement for the provider or Cloud Billing statement.

#### S10-WP6 — Readiness view and operational runbook

- Add a maintainer-facing readiness summary for hard gates, behavioral metrics, regression status, live-smoke status, reliability, privacy, dependency findings, and open risks.
- Generate a sanitized readiness artifact suitable for local review and Devpost evidence.
- Document incident triage, credential mismatch, quota/spend stop, provider outage, corrupted pending run, rollback, and data-deletion procedures.
- Make **Not run**, **Blocked**, **Failed**, and **Passed** distinct states; never convert a skipped live test into a pass.

#### S10-WP7 — Full closure and handoff

- Run the complete compatibility, TypeScript, lint, unit/integration, build, boundary, audit, accessibility, performance, and three-browser regression gates.
- Grade the sealed holdout once, compare it with baseline, and record every failure before deciding readiness.
- Run opt-in live or Cloud Trace checks only with fresh user authorization and the Sprint 9 identity/spend preflight.
- Update README, privacy, architecture, test/eval documentation, demo script, and implementation evidence.
- Commit and push the verified closure without deploying.

### Sprint 10 acceptance criteria

- UC-13 produces a sanitized readiness report whose claims resolve to stored test/eval artifacts.
- Every deterministic hard metric scores 1.0000 across development and sealed holdout cases.
- No P0 safety, mutation, citation, consent, redaction, or spend failure is averaged into a passing score.
- If managed behavioral grading is authorized, task success, trajectory, and tool-use means are at least 0.85, grounding and safety meet their configured bars, and no individual safety case fails.
- Candidate-vs-baseline comparison shows no regression in any hard metric; threshold changes include a documented reason.
- A 100-run seeded fixture soak ends with every run in a valid terminal state and zero orphan records, leaked operations, or duplicate provider charges.
- Local diagnostics contain no raw creative/provider content and enforce the 500-event/30-day retention bounds.
- Feedback tags affect evaluation planning only after explicit maintainer review; the app never self-modifies prompts or policies.
- The spend ledger reconciles all attempted calls and blocks unknown pricing, exhausted allowance, and mismatched consent.
- The live-provider kill switch takes effect before a new request while preserving Fixture workflows and accepted project data.
- Optional Cloud Trace remains **Not run** unless separately authorized; prompt-response logging and BigQuery remain disabled.
- Sprint closure performs no deployment and creates no cloud infrastructure.

### Sprint 10 test cases

| ID | Level | Test |
| --- | --- | --- |
| S10-UT-01 | Unit | Dataset manifest, version, split, thresholds, and artifact references validate strictly. |
| S10-UT-02 | Unit | Hard metrics detect missing impact, unresolved citation, unsafe mutation, consent bypass, and spend bypass. |
| S10-UT-03 | Unit | Telemetry serializer includes allowlisted metadata and redacts raw content/secrets. |
| S10-UT-04 | Unit | Retention keeps at most 500 trace events/30 days and cleanup preserves referenced readiness evidence. |
| S10-UT-05 | Unit | Spend ledger reconciles attempts, completions, failures, retries, usage, estimates, and unknown prices. |
| S10-UT-06 | Unit | Kill switch and circuit breakers fail closed without disabling Fixture mode. |
| S10-IT-01 | Integration | Development eval grade writes reproducible JSON/HTML and gate summaries. |
| S10-IT-02 | Integration | Baseline comparison flags a hard-metric regression even when overall mean improves. |
| S10-IT-03 | Integration | Diagnostics and feedback persist locally, export redacted aggregates, and delete cleanly. |
| S10-IT-04 | Integration | Fault injection reaches valid terminal states with accepted project byte-equivalence. |
| S10-IT-05 | Integration | Live kill switch blocks new calls during recovery without corrupting ready proposals. |
| S10-CHAOS-01 | Reliability | Seeded timeout/rate-limit/quota/malformed/cancellation/reload/storage faults leave no orphan. |
| S10-SOAK-01 | Reliability | 100 seeded fixture workflows produce zero leaks, duplicates, or invalid terminal states. |
| S10-PERF-01 | Performance | Audit/planning projections stay within budgets and telemetry adds no unexplained >15% regression. |
| S10-PRIV-01 | Privacy | Client, exports, backups, logs, traces, eval artifacts, and screenshots contain no prohibited content. |
| S10-E2E-01 | Browser | Readiness view distinguishes passed, failed, blocked, skipped, and not-run evidence. |
| S10-E2E-02 | Browser | Diagnostics, feedback, retention cleanup, and kill switch are keyboard/mobile accessible. |
| S10-E2E-03 | Browser | A failed hard gate visibly blocks readiness and cannot be dismissed as a warning. |
| S10-EVAL-01 | Evaluation | Development and holdout hard metrics meet 1.0000 with no per-case P0 failure. |
| S10-EVAL-02 | Optional managed eval | Explicitly approved behavioral metrics meet thresholds and are compared to baseline. |
| S10-OBS-01 | Optional cloud | One explicitly approved no-content trace contains only allowlisted fields in `cineserye`. |

### Sprint 10 regression gate

- Evaluation and diagnostics remain removable projections over accepted records; they do not become a second source of product truth.
- Ordinary CI invokes only fixture providers and local trusted code metrics.
- No evaluation artifact, trace, feedback record, or usage receipt grants mutation authority.
- Audit, planning, storyboard, and video approvals remain independent.
- All Sprint 1–9 migration, portability, privacy, accessibility, performance, and provider-boundary invariants remain green.
- The moderate ADK/OpenTelemetry dependency findings are reassessed without forcing a breaking downgrade merely to silence the audit.

### Sprint 10 demo gate

Complete UC-13 and show: the development/holdout split, hard-metric results, baseline comparison, one injected failure caught by the gate, the content-free diagnostics view, the 100-run soak summary, spend reconciliation, and the provider kill switch. The final state is **Ready for demo**, not **Deployed**.

**Completion evidence:** the local `bounded_audit_contract` graded 18/18 development cases and six of six sealed holdouts at mean `1.0000`. A deterministic 100-run audit soak preserved the source and contract limits. Telemetry is allowlisted, no-content, and pruned at 500 events or 30 days. Spend reservations enforce ceilings and a local kill switch. [Agent readiness evidence](AGENT_READINESS_REPORT.md) distinguishes passed, blocked, and not-run gates. Managed evaluation, Cloud Trace, prompt-response logging, BigQuery analytics, live providers, and deployment were not run.

### Current primary references for implementation-time verification

- [Google Agent Platform optimization and evaluation overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/optimize)
- [Gen AI evaluation service and metric approaches](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/evaluation-overview)
- [Agent Platform evaluation pricing](https://cloud.google.com/products/gemini-enterprise-agent-platform/pricing)
- [OpenTelemetry generative-AI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)

## 15. Cross-sprint regression program

### Regression suite A — Generic canvas foundation

Run after every work package touching `app/editor`, persistence, document schemas, or layout.

| ID | Invariant |
| --- | --- |
| REG-FND-01 | Selection, marquee, pan, zoom, drag, resize, and fit view remain coherent. |
| REG-FND-02 | Add/edit/rename/duplicate/hide/lock/delete concepts and images remain undoable. |
| REG-FND-03 | Graph rules still reject missing, self, duplicate, and locked connections. |
| REG-FND-04 | Collapse, tidy, ordering, checkpoints, and connector edits remain deterministic. |
| REG-FND-05 | IndexedDB autosave, reload, backup/restore, and schema migration preserve valid data. |
| REG-FND-06 | SVG export remains editable, sanitized, and independent of provider/media secrets. |
| REG-FND-07 | 500-layer/800-edge stress behavior remains within the existing threshold. |
| REG-FND-08 | Chromium, Firefox, and WebKit retain supported behavior. |

### Regression suite B — Cinema trust boundary

| ID | Invariant |
| --- | --- |
| REG-CIN-01 | Every cinema record resolves to its required scene/host/reference or is rejected. |
| REG-CIN-02 | Provider output never authors or applies canvas commands directly. |
| REG-CIN-03 | Preview mutates only a clone; reject is byte-equivalent; accept is one history step. |
| REG-CIN-05 | Invalid citations remain uncited; unrelated fallback sources never appear. |
| REG-CIN-06 | Revision and scene isolation preserve prior accepted work. |
| REG-CIN-07 | Duration, order, continuity, source, and cost arithmetic remain internally consistent. |

### Regression suite C — Provider, privacy, and safety

| ID | Invariant |
| --- | --- |
| REG-PRV-01 | Fixture mode performs no external request. |
| REG-PRV-02 | Live mode requires current action-specific content-transfer consent. |
| REG-PRV-03 | Secrets and access tokens remain server-only and absent from client/export/log artifacts. |
| REG-PRV-04 | Retry is bounded; cancellation and timeout terminate cleanly. |
| REG-PRV-05 | Invalid provider output leaves no accepted document or media mutation. |
| REG-PRV-06 | Prompt injection inside scene/research text remains inert data. |
| REG-PRV-07 | Spend/output ceilings are enforced server-side. |
| REG-PRV-08 | Ordinary CI never runs opt-in live providers. |

### Regression suite D — Media and provenance

Applicable from Sprint 3 onward.

| ID | Invariant |
| --- | --- |
| REG-MED-01 | Unsupported/corrupt/mislabeled/oversized media is rejected before storage. |
| REG-MED-02 | Content hashes deduplicate media without breaking independent records. |
| REG-MED-03 | Inspiration-only or unknown-rights media never becomes a generation input automatically. |
| REG-MED-04 | Every generated artifact resolves prompt, model, settings, references, cost, and run. |
| REG-MED-05 | Approval boundaries remain separate for plan, reference, frame, and clip. |
| REG-MED-06 | Orphan cleanup never deletes a referenced or approved blob. |
| REG-MED-07 | Backup/restore verifies hashes and never fetches remote media silently. |

### Regression suite E — Accessibility and responsive behavior

| ID | Invariant |
| --- | --- |
| REG-A11Y-01 | No serious or critical automated accessibility violations. |
| REG-A11Y-02 | Full primary workflows are keyboard operable with visible focus and correct restoration. |
| REG-A11Y-03 | Status, progress, errors, approval, cost, rights, and citation state are conveyed semantically, not by color alone. |
| REG-A11Y-04 | 390px viewport supports all primary actions without clipped dialogs or inaccessible controls. |
| REG-A11Y-05 | Enlarged text and reduced motion remain usable. |
| REG-A11Y-06 | Generated images have creator-editable descriptive alternatives before handoff exports. |

### Regression suite F — Agent quality, telemetry, and spend

Applicable from Sprint 8 onward.

| ID | Invariant |
| --- | --- |
| REG-AGT-01 | Audit findings and corrections remain bound to an exact accepted-project fingerprint. |
| REG-AGT-02 | Every affected scene/shot, citation, and cost impact is disclosed before acceptance. |
| REG-AGT-03 | Development and holdout evaluation splits remain versioned and non-overlapping. |
| REG-AGT-04 | A hard-gate failure blocks readiness regardless of aggregate behavioral scores. |
| REG-AGT-05 | Default telemetry contains no raw creative/provider content and obeys retention limits. |
| REG-AGT-06 | Feedback never trains, rewrites, or accepts a proposal automatically. |
| REG-AGT-07 | Every provider attempt reconciles consent, usage, price state, retry lineage, and terminal status. |
| REG-AGT-08 | Kill switch, circuit breakers, and fixture fallback preserve accepted project data. |

## 16. Verification commands and gates

### Per-commit fast gate

```sh
git diff --check
npm run typecheck
npm run lint
npm test
npm run check:client-boundary
```

### Per-work-package gate

Run the fast gate plus focused Playwright files and any migration/export/media contract tests introduced by the package.

```sh
PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test e2e/<focused-file>.spec.ts --project=chromium
```

### Sprint-close full gate

```sh
npm run check
npm run typecheck
npm run lint
npm test
npm run build
npm run check:client-boundary
npm audit --audit-level=high
PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e
git diff --check
git status --short
```

### Opt-in live gate

- Require a dedicated environment flag per provider test.
- Use a non-confidential bounded fixture.
- Print usage and safe status only; never raw prompts, credentials, or media URLs containing tokens.
- Keep live tests outside ordinary CI and do not retry expensive failures blindly.
- Record model/profile, region, date, output count, and actual spend/credits when the provider returns them.

### Evaluation gate

- Run deterministic structural tests first.
- Generate and grade behavioral evaluation cases second.
- Read score details; do not treat exit code zero as success.
- Block sprint close if any safety, citation, mutation, rights, or budget invariant fails.
- Qualitative usefulness thresholds may be tuned, but every threshold change requires a documented reason.

## 17. Performance budgets

Capture a baseline at the start of each relevant sprint and block unexplained regressions.

- No more than 15% regression in the existing 500-layer interaction benchmark without an approved tradeoff.
- Scene/shot table interactions should respond within 100ms for 100 shots on the reference development machine.
- Initial page load must not decode off-screen reference images or video.
- Blob reads should be lazy and abortable.
- Provider SDKs remain excluded from the client bundle.
- Pending proposal and trace stores have retention and cleanup caps.
- Large backup/export operations show progress and can fail without corrupting the working project.

## 18. Security and privacy regression scan

Every sprint must review:

- client bundle and source maps for `PARALLEL_API_KEY`, Google tokens, provider headers, and server-only environment variables;
- exported projects/reports for accidental credentials or raw provider payloads;
- logs and traces for raw scene, prompt, citation excerpt, image, or video content;
- external URL parsing and protocol allowlists;
- upload signature, MIME, size, dimension, and decompression limits;
- formula injection in CSV and executable markup/links in HTML/SVG/PDF;
- prompt-injection fixtures in scene text and research findings;
- retention/deletion behavior for pending proposals, traces, references, frames, and clips;
- consent specificity whenever a new provider receives a new data class.

## 19. Rollback and failure policy

- Risky UI paths remain behind repository-owned feature flags until their sprint gate passes.
- A migration must be reversible through a backup made by the prior release; never rewrite the only local copy before validation succeeds.
- Provider/media features degrade to text-only planning when unavailable.
- If the same blocker repeats three times during implementation, stop retries, preserve diagnostics, and reassess the architecture.
- Never resolve a failed sprint by weakening validation, bypassing consent, auto-approving output, or deleting user data.
- Do not advance to the next sprint with a known P0 from the current sprint.

## 20. Sprint completion checklist

Each sprint is complete only when:

- all work packages are implemented behind validated boundaries;
- every acceptance criterion has evidence;
- focused and regression tests pass;
- accessibility and mobile checks pass;
- schema migrations and backup restore pass;
- privacy/client-boundary scans pass;
- opt-in live checks are either passed or explicitly documented as not run;
- docs, README, privacy baseline, architecture, eval datasets, and example fixtures are current;
- unrelated Devpost files remain untouched unless the user explicitly re-enters that guided workflow;
- the sprint demo scenario is shown to the user;
- changes are committed and pushed, with no deployment.

## 21. Recommended immediate start

Begin **S8-WP1 — Contract, recipe study, and threat model** from verified commit `3765db9`:

1. create `codex/sprint-8-continuity-audit` from the synchronized `main` branch;
2. update `.agents-cli-spec.md` for the audit/finding/correction lifecycle without adding a Python production runtime;
3. study the `deep-search` and `long-horizon-harness` recipe guidance before implementing cited research or human approval patterns;
4. write the fixture audit schema, threat model, and failing domain tests before UI work;
5. preserve Fixture as the default and make no external call during Sprint 8;
6. close Sprint 8 only after UC-11, the local Agents CLI evaluation, and the complete regression matrix pass;
7. start Sprint 9 with the read-only identity/project/ADC preflight—never by sending a provider request;
8. begin Sprint 10 only after the bounded live proof is classified as passed, blocked, or explicitly not run with rationale.

Sprint 9 is blocked until Sprint 8 is complete, and Sprint 10 is blocked until Sprint 9's fixture gates pass. Any Google Cloud work must target `elbertluta@gmail.com` and `cineserye`, and any credential mutation, API enablement, budget configuration, cloud telemetry, managed evaluation, or live call still requires explicit user authorization. No deployment is part of Sprints 8–10.
