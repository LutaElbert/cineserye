# Cineserye implementation plan

## Purpose

Build the first real Cineserye copilot vertical slice: an independent creator selects one scene, supplies a few production constraints, receives cited research and a budget-aware six-shot prompt package, reviews the proposed canvas changes, and accepts or rejects them atomically.

This plan preserves the approved interface and the generic canvas engine. It does not include authentication, media generation, screenplay-wide planning, collaboration, billing, or deployment.

## Delivery posture

- **Recommended build mode:** autonomous implementation with user review gates after the persistent cinema schema, first live provider result, and complete end-to-end workflow.
- **Git cadence:** one focused commit per work package after its verification gate passes. Do not include `.devpost-hackathon-state.json` or unrelated hackathon notes unless explicitly requested.
- **Provider posture:** Parallel supplies research; Gemini on Vertex AI synthesizes the structured plan. Agent Development Kit (ADK) and agent protocols remain optional until a concrete orchestration need justifies them.
- **Agent tooling:** Use ADK for TypeScript for the agent workflow and Google Agents CLI throughout development, local playground/debugging, evaluation, trace inspection, and telemetry—not to introduce a second application stack.
- **Mutation rule:** provider output is always untrusted. It must pass domain validation and `app/editor/canvas-commands.ts` before the user can accept it.
- **Privacy rule:** credentials and provider calls remain server-side. The browser never receives API keys, access tokens, or raw provider configuration.
- **Deployment rule:** all work and verification remain local until deployment is separately approved.

## Definition of the proof of concept

### Primary user

An independent creator without a complete pre-production crew. The workflow must be understandable to a newcomer but retain enough shot, continuity, source, and budget detail for a professional.

### Primary workflow

```text
Selected scene
  → confirm tone, location/period, budget band and ceiling
  → research references with Parallel
  → synthesize a structured shot package with Vertex AI
  → validate cinema data and canvas commands
  → preview prompts, sources, costs and ghost nodes
  → accept everything atomically or reject without mutation
  → manually refine the accepted result
```

### Required output

- A scene-level planning run with visible lifecycle state.
- A chronological shot list for one scene.
- Storyboard and video prompts for every shot.
- Character, location, prop, and visual-element continuity dependencies.
- Source-backed production/reference findings.
- An illustrative generation-cost range and budget warning.
- An automatic Project Outline derived from the active cinema document.
- Atomic accept, reject, and one-step undo behavior.

### Explicit exclusions

- No image or video generation.
- No uploaded screenplay parser or whole-screenplay planning.
- No authentication, teams, sharing, comments, billing, or cloud project storage.
- No autonomous acceptance or silent canvas mutation.
- No precise production accounting; cost remains a labeled estimate.
- No deployment in this implementation sequence.

## Target architecture

```text
React scene-planner UI
        |
        v
server-side plan-scene endpoint
        |
        +--> Parallel research adapter
        |
        +--> Vertex Gemini planning adapter
        |
        v
cinema workflow orchestrator
        |
        +--> runtime schema validation
        +--> budget and continuity checks
        +--> CanvasCommandProposal compiler
        |
        v
ghost proposal review
        |
   accept / reject
        |
        v
generic editor history + persistence
```

The provider adapters return normalized domain results, not editor nodes. The workflow layer compiles those results into a command proposal. This prevents provider-specific formats and cinema business rules from leaking into the generic editor.

## Work packages

### 0. Freeze and document the approved UX baseline

**Status:** Implemented; requires a deliberate baseline commit before provider work.

**Build**

- Preserve the mock scene planner, inspector tabs, ghost review bar, automatic Project Outline, and current generic editor behavior as the executable UX specification.
- Record the current passing counts and capture desktop/mobile reference screenshots.
- Keep unrelated local Devpost files outside the commit.

**Acceptance criteria**

- The fresh canvas remains `Story Premise → Scene 01 → Shot 01`.
- Planning the mock scene produces six chronological shots, 36 seconds, and an expected ₱820 estimate.
- Reject leaves the base document unchanged; accept is one history entry; undo removes the accepted package.
- Generic documents continue to use the Layers panel.

**Test cases**

- `FND-01`: Run the complete compatibility, type, lint, unit, build, audit, and browser suite.
- `FND-02`: Compare desktop and mobile Project Outline against the approved reference.
- `FND-03`: Confirm no external request occurs during the mock workflow.
- `FND-04`: Verify `git diff --check` and review the staged file list before committing.
- `FND-05`: Add an E2E server-identity preflight that fails unless the target identifies itself as Cineserye, preventing tests from reusing an unrelated app on the same port.

### 1. Activate a versioned persistent cinema payload

**Build**

- Introduce `CinemaProjectDataV1` as a sidecar on the portable editor document rather than replacing generic `EditorNodeData`.
- Persist typed records for `scene`, `shot`, `character`, `asset`, `agent-run`, prompt artifacts, research sources, and cost estimates.
- Add stable relationships: project → scene, scene → shots, shot → continuity dependencies, artifact → owner, source → artifact or run.
- Add migration from the current schema and strict backup/restore validation.
- Preserve unknown future cinema fields when safe, but reject unknown schema versions.

**Acceptance criteria**

- An accepted cinema plan survives autosave, reload, `.cineserye` backup, restore, and undo/redo.
- Every cinema record resolves to an existing visual host node or is rejected.
- Deleting a scene cannot leave orphaned shots, prompts, costs, or run references.
- A generic project without cinema data opens unchanged.

**Test cases**

- `DOM-01`: Round-trip a complete cinema document through serialization and parsing.
- `DOM-02`: Migrate a schema-v4 generic document into a document with no cinema sidecar.
- `DOM-03`: Reject missing parents, duplicate IDs, invalid durations, bad currency ranges, and unresolved dependency IDs.
- `DOM-04`: Restore a valid cinema backup and verify outline order and inspector content.
- `DOM-05`: Reject an unsupported future cinema schema version with a useful error.

### 2. Add the one-scene planning brief

**Build**

- Use the selected scene node’s text as the source material.
- Add a compact preflight form for tone, location/period, budget band, optional ceiling, target duration, and available equipment.
- Prepopulate fields from existing scene metadata and retain the user’s last confirmed values per scene.
- Validate required inputs before any provider call.

**Acceptance criteria**

- Planning is available only for exactly one selected scene.
- Scene text, tone, location/period, and budget are required.
- Budget is presented as a band plus optional ceiling, never as a guaranteed production quote.
- Canceling the brief creates no history or provider request.

**Test cases**

- `BRF-01`: Open the brief from a selected scene and verify prepopulated scene text.
- `BRF-02`: Block empty scene text, missing tone, missing location/period, and invalid budget ranges.
- `BRF-03`: Accept a valid brief with and without equipment and target-duration overrides.
- `BRF-04`: Cancel and verify the canvas, history, persistence, and network log remain unchanged.
- `BRF-05`: Verify keyboard navigation, labels, errors, focus restoration, and mobile layout.

### 3. Establish server-only provider boundaries and deterministic fixtures

**Build**

- Define `ResearchProvider` and `ShotPlannerProvider` TypeScript interfaces.
- Add server-only environment validation for Parallel and Google Cloud configuration.
- Use Google Application Default Credentials from the selected `cineserye` project for local Vertex access; never serialize tokens to the client.
- Provide deterministic fixture adapters so the entire workflow remains testable without credits or network access.
- Add request IDs, timeouts, cancellation, bounded retries, and redacted structured logs.
- Prepare a workspace-scoped Agents CLI setup for evaluation and telemetry without enabling deployment commands.

**Acceptance criteria**

- Importing a provider module into a client bundle fails a boundary test.
- Missing provider configuration returns a typed, user-safe error instead of crashing.
- Fixture mode produces repeatable output and makes zero external requests.
- Logs contain run IDs, phase timings, and result counts but no scene text, credentials, or full prompts by default.
- An Agents CLI evaluation can target the fixture agent endpoint without changing the canvas or requiring a deployed service.

**Test cases**

- `PRV-01`: Exercise both provider interfaces with fixtures.
- `PRV-02`: Verify missing, malformed, and unauthorized configuration errors.
- `PRV-03`: Verify timeout, cancellation, one bounded retry, and retry exhaustion.
- `PRV-04`: Scan the client build and browser responses for provider secrets.
- `PRV-05`: Assert sensitive fields are redacted from logs and error payloads.
- `PRV-06`: Run an Agents CLI fixture evaluation against a local endpoint and verify no deployment or external provider call occurs.

### 4. Implement Parallel research for production-relevant evidence

**Build**

- Convert the scene brief into bounded research queries for location/period authenticity, props and material culture, cinematography references, and vertical-format staging.
- Normalize Parallel results into cited `ResearchSource` records with title, publisher, URL, finding, query purpose, and retrieval timestamp.
- Deduplicate sources and preserve the evidence-to-decision link used by shots and assets.
- Allow the workflow to continue with a clearly labeled limited-research state when results are sparse.

**Acceptance criteria**

- Every non-mock source shown in the UI has a resolvable citation URL and a concise finding.
- Research materially affects at least one proposed prop, location detail, composition, or budget decision.
- Duplicate URLs and unsupported protocols are removed.
- Research failure never mutates the canvas and produces a retryable run state.

**Test cases**

- `RES-01`: Normalize a normal multi-query response into unique sources.
- `RES-02`: Remove duplicates, malformed URLs, unsupported protocols, and empty findings.
- `RES-03`: Handle zero results with a limited-research warning.
- `RES-04`: Handle rate limits, timeouts, and provider errors with retry guidance.
- `RES-05`: Verify each accepted shot or asset citation points to an existing normalized source.
- `RES-06`: Contract-test the live adapter behind an opt-in environment flag; never run it in ordinary unit tests.

### 5. Implement Vertex AI structured shot planning

**Build**

- Compile the scene brief and normalized research into a provider-neutral planning request.
- Ask Gemini on Vertex AI for schema-constrained output rather than prose.
- Require chronological shots, durations, framing, camera movement, action, audio, risk, continuity dependencies, storyboard prompt, video prompt, negative constraints, and cost inputs.
- Validate the response at runtime and allow one repair attempt for structurally invalid model output.
- Keep ADK out of this slice unless the implementation truly requires multi-agent handoffs, durable tool state, or resumable execution.

**Acceptance criteria**

- Valid output produces three to eight shots whose durations reconcile with the requested target within the configured tolerance.
- Every shot belongs to the selected scene and has at least one production purpose.
- Every prompt references only known characters/assets or explicitly introduces a validated new proposal.
- Invalid or unsafe output is rejected before reaching the canvas command compiler.
- The model cannot choose acceptance on behalf of the user.

**Test cases**

- `PLN-01`: Parse a complete valid planner fixture.
- `PLN-02`: Reject missing IDs, duplicate shot numbers, negative durations, unresolved dependencies, and unknown enum values.
- `PLN-03`: Repair one malformed response, then accept the repaired validated result.
- `PLN-04`: Fail cleanly after the repair limit.
- `PLN-05`: Verify total duration tolerance and chronological ordering.
- `PLN-06`: Confirm user scene text cannot inject unsupported commands or bypass validation.

### 6. Build the orchestration lifecycle and agent-run record

**Build**

- Implement an explicit state machine: `draft → researching → planning → validating → ready`, with terminal `failed`, `cancelled`, `rejected`, and `accepted` states.
- Persist an `agent-run` record containing sanitized inputs, provider/model identifiers, timestamps, source IDs, proposal summary, warnings, and lifecycle status.
- Support cancellation through an `AbortSignal` and prevent duplicate concurrent runs for the same scene.
- Make each stage observable in the existing planning UI.
- Emit OpenTelemetry-compatible spans for the run and each research, planning, validation, proposal, and acceptance phase.

**Acceptance criteria**

- State transitions are deterministic and invalid transitions are rejected.
- A cancelled or failed run produces no canvas history entry.
- Refreshing after a ready proposal can restore the review state without repeating provider calls.
- Starting a new run never overwrites an accepted run record.
- Every trace can be correlated by `run_id`, while raw scene text, prompts, citations, credentials, and provider payloads remain excluded unless a developer explicitly enables a local diagnostic mode.

**Test cases**

- `RUN-01`: Exercise the complete happy-path transition sequence.
- `RUN-02`: Cancel during research and planning.
- `RUN-03`: Reject duplicate active runs for the same scene.
- `RUN-04`: Restore a ready proposal from persistence.
- `RUN-05`: Retry a failed run as a new run linked to its predecessor.
- `RUN-06`: Verify terminal states cannot transition back to an active state.
- `RUN-07`: Verify trace parent/child relationships, timings, status, provider/model metadata, retry count, token or usage totals when available, and proposal outcome.
- `RUN-08`: Scan exported spans and logs for scene-text fixtures, API keys, access tokens, and full provider payloads.

### 7. Compile prompts, continuity, sources, and budget decisions

**Build**

- Produce separate scene, character-reference, asset-reference, storyboard, and video prompt artifacts.
- Keep storyboard prompts textual; generated images remain out of scope.
- Resolve inherited character, location, prop, and visual-element continuity for every shot.
- Calculate minimum, expected, and high-risk generation cost from configurable per-attempt assumptions.
- Compare the high-risk range with the user’s ceiling and expose budget tradeoffs or a blocking over-budget warning according to policy.

**Acceptance criteria**

- Every shot has one storyboard prompt and one video prompt.
- Every prompt lists its inherited continuity sources and negative constraints.
- Costs satisfy `minimum ≤ expected ≤ high-risk`; the project total equals the sum of shot estimates.
- Estimates are visibly labeled illustrative and expose their assumptions.
- A proposal above the ceiling explains which shots or attempt counts drive the excess.

**Test cases**

- `ART-01`: Generate complete prompt artifacts for a six-shot fixture.
- `ART-02`: Reject prompt references to missing characters or assets.
- `ART-03`: Verify project and per-shot arithmetic in PHP.
- `ART-04`: Trigger within-budget, near-ceiling, and over-ceiling states.
- `ART-05`: Verify prompt copy preserves text exactly and never copies UI labels.
- `ART-06`: Confirm storyboard prompts and reference-image records remain distinct concepts.

### 8. Compile and review validated canvas proposals

**Build**

- Convert validated cinema records into `CanvasCommandProposal` commands.
- Preserve the current ghost-node review, inspector tabs, proposal summary, and atomic accept/reject interactions.
- Add a comparison summary showing created, updated, and deleted nodes before acceptance.
- Keep all editing, importing, connecting, and destructive actions disabled against the preview document.

**Acceptance criteria**

- Previewing a proposal never changes the persisted document or history.
- Accept commits the complete proposal and cinema sidecar once.
- Reject discards the preview and restores the exact previous selection and viewport where practical.
- One undo reverses the complete accepted proposal; redo restores it.
- Locked nodes, invalid connectors, oversized batches, and unsupported commands are rejected.

**Test cases**

- `CMD-01`: Apply a valid mixed create/update/delete/connect proposal to a clone.
- `CMD-02`: Prove the source document remains byte-equivalent during preview and reject.
- `CMD-03`: Reject locked-node changes, missing endpoints, self-edges, duplicates, invalid kinds, and oversized batches.
- `CMD-04`: Accept and verify one history entry plus persistence.
- `CMD-05`: Undo and redo the accepted cinema document and sidecar together.
- `CMD-06`: Attempt canvas keyboard shortcuts, drag/drop, import, and connect during review and verify they are inert.

### 9. Complete the automatic Project Outline and post-accept editing

**Build**

- Continue deriving the outline from the active cinema document; do not store a separate tree.
- Preserve grouping, chronological shot order, counts, duration, cost, collapse state, search, and canvas-selection synchronization.
- Add validated shot reordering and editable shot/prompt fields after acceptance.
- Recalculate numbering, duration, cost, dependencies, and outline presentation after edits.

**Acceptance criteria**

- Draft items appear automatically when a proposal becomes ready and lose the Draft marker after acceptance.
- Selecting an outline item selects and focuses exactly one canvas node; canvas selection highlights the matching outline item.
- Reordering shots updates their canonical order and visible numbering atomically.
- Renaming or deleting accepted items updates the outline without manual refresh.
- Generic documents continue to expose the original Layers behavior.

**Test cases**

- `OUT-01`: Derive all production groups from a ready proposal.
- `OUT-02`: Verify shot order `01…N` independently of editor z-order.
- `OUT-03`: Test collapse, group focus, search, and zero-result behavior.
- `OUT-04`: Synchronize selection in both directions at desktop and mobile breakpoints.
- `OUT-05`: Reorder two shots, verify renumbering, persistence, undo, and redo.
- `OUT-06`: Rename and delete accepted items and confirm automatic outline updates.

### 10. Extend persistence, backup, export, and privacy behavior

**Build**

- Include cinema sidecar records, prompts, sources, costs, and run summaries in `.cineserye` backups.
- Add a production-plan export suitable for review, initially JSON and Markdown; keep editable SVG export unchanged.
- Update privacy documentation to identify provider-bound scene text, research queries, retention assumptions, and local records.
- Add explicit user-facing disclosure before the first real provider request.

**Acceptance criteria**

- Backup/restore loses no accepted cinema data and rejects tampered relationships.
- Exported Markdown contains the scene brief, ordered shots, prompts, sources, and illustrative costs.
- No credential, access token, raw provider response, or hidden model instruction appears in backups or exports.
- Users can understand what leaves the device before initiating a live run.

**Test cases**

- `PER-01`: Round-trip a complete accepted project through backup/restore.
- `PER-02`: Export JSON and Markdown and validate required sections and order.
- `PER-03`: Scan backups and exports for secret-shaped fixtures and private configuration fields.
- `PER-04`: Reject corrupted prompt/source/run relationships.
- `PER-05`: Verify disclosure acknowledgment is required only for live mode, not fixtures.

### 11. Harden errors, accessibility, responsiveness, and scale

**Build**

- Provide actionable empty, offline, timeout, rate-limit, validation, over-budget, cancellation, and provider-unavailable states.
- Preserve keyboard-only operation, screen-reader semantics, reduced motion, enlarged text, and mobile drawers.
- Add an end-to-end accessibility scan for the cinema proposal and accepted-outline states.
- Bound source, prompt, shot, and command counts to prevent runaway model responses.

**Acceptance criteria**

- No provider or validation error destroys the saved document.
- Focus moves to the run status or first actionable error and returns sensibly after dismissal.
- The complete plan/review/accept workflow is keyboard operable at 200% text.
- No serious or critical automated accessibility violations occur.
- Oversized provider results fail before rendering or persistence.

**Test cases**

- `QLT-01`: Run axe against brief, planning, ready-review, error, and accepted states.
- `QLT-02`: Complete the workflow using keyboard only.
- `QLT-03`: Verify reduced motion, 200% text, 390px mobile, tablet, and desktop layouts.
- `QLT-04`: Simulate offline, timeout, 429, 500, invalid JSON, and cancellation states.
- `QLT-05`: Submit maximum allowed sources, prompts, shots, and commands; reject one above each limit.
- `QLT-06`: Verify generic 500-node/800-edge stress coverage remains within the existing threshold.

### 12. Build evaluation fixtures and the hackathon demo handoff

**Build**

- Create three deterministic scene fixtures: the approved Manila cinema suspense scene, a dialogue-led low-budget scene, and a genre-contrasting scene.
- Add evaluation assertions for research relevance, continuity completeness, duration reconciliation, budget compliance, citation coverage, and command validity.
- Store deterministic Agents CLI evaluation cases and scoring rules in a versioned, provider-independent dataset.
- Use Agents CLI trace generation and evaluation commands against the local ADK or compatible endpoint; keep cloud telemetry opt-in.
- Prepare demo instructions, architecture notes, screenshots, repository link, known limitations, and a concise explanation of how Parallel materially influences the output.
- Keep submission preparation separate from any Devpost submission action.

**Acceptance criteria**

- All three fixtures produce valid proposals using fixture providers.
- At least one traceable production decision per fixture is supported by Parallel research.
- The live demo can complete from scene selection to accepted plan without manual data repair.
- The submission materials explicitly distinguish implemented behavior, fixture behavior, and future work.
- Evaluation results identify the exact dataset version, agent version, model/provider configuration, and scoring policy used.

**Test cases**

- `EVA-01`: Run deterministic structural evaluations for all three fixtures.
- `EVA-02`: Verify every shot has complete prompts, dependencies, sources where claimed, and cost data.
- `EVA-03`: Run one opt-in live Parallel + Vertex smoke test and save only sanitized evidence.
- `EVA-04`: Rehearse accept, reject, retry, and undo demo paths.
- `EVA-05`: Verify no deployment or Devpost write occurs during preparation.
- `EVA-06`: Compare two prompt/agent versions against the same evaluation dataset and produce a reproducible score delta.
- `EVA-07`: Verify telemetry can remain local by default and that cloud export requires an explicit flag and authenticated Google Cloud project.

## Agents CLI development, evaluation, and telemetry profile

### Development workflow

1. Run `uvx google-agents-cli setup --workspace` to install the Google agent-development guidance at repository scope.
2. Write a short `.agents-cli-spec.md` describing the scene-planning coordinator, Parallel research tool, Vertex planner, safety boundary, and success criteria.
3. Build an isolated ADK TypeScript spike without replacing the existing React/vinext application or introducing a Python runtime into the production path.
4. Use the local playground and trace viewer to inspect tool inputs, agent transitions, structured outputs, failures, and retries.
5. Promote only the proven agent modules into Cineserye's server-side cinema domain layer.
6. Keep the existing fixture adapters available so UI and command-boundary development never depends on provider availability.

Agents CLI development support should improve implementation discipline, but generated scaffolding is not automatically authoritative. Every generated file must fit the repository boundaries, pass the normal review gates, and preserve the generic editor/cinema-domain separation.

**Development acceptance criteria**

- Agents CLI is configured only at workspace scope and does not modify unrelated repositories.
- The development spike uses ADK for TypeScript or documents a concrete blocker before proposing another runtime.
- Research and planning tools return Cineserye domain objects rather than editor nodes.
- Local playground runs cannot accept a proposal or mutate IndexedDB.
- Removing Agents CLI development files does not break the Cineserye application runtime.
- Generated or adapted agent code passes TypeScript, lint, unit, security-boundary, and fixture-mode tests before integration.

**Development test cases**

- `DEV-01`: Verify the workspace setup touches only Cineserye-approved configuration paths.
- `DEV-02`: Start the agent locally with fixture providers and produce a validated plan for the approved cinema scene.
- `DEV-03`: Inspect a failed tool call and retry trace without exposing credentials or raw scene text.
- `DEV-04`: Confirm the agent cannot import editor mutation functions or write directly to browser persistence.
- `DEV-05`: Run the Cineserye application and its full test suite with Agents CLI unavailable.
- `DEV-06`: Compare the isolated spike's output contract with the repository's cinema runtime validators before promotion.

### Evaluation dataset

Each evaluation case should contain a scene brief, constraints, fixture research result, expected structural invariants, and qualitative scoring rubric. Keep provider responses out of the golden data; expected behavior should be expressed in Cineserye domain terms.

Initial metrics:

- **Schema validity:** proposal passes every runtime validator.
- **Citation coverage:** every research-backed claim resolves to a normalized source.
- **Continuity completeness:** every shot declares required characters, locations, props, and visual elements.
- **Duration reconciliation:** summed shot duration stays within the configured scene tolerance.
- **Budget compliance:** ranges are internally consistent and warnings match the ceiling policy.
- **Production usefulness:** framing, movement, action, audio, and purpose are specific enough to review.
- **Mutation safety:** generated commands pass the command boundary and never bypass approval.

### Telemetry spans

```text
cineserye.agent_run
  ├── research.parallel
  ├── planning.vertex
  ├── validation.cinema_domain
  ├── proposal.canvas_commands
  └── review.accept | review.reject
```

Safe default attributes include `run_id`, phase status, duration, result counts, retry count, model/provider identifier, schema version, warning count, command count, and usage totals when the provider returns them. Do not record raw scene text, full prompts, citation bodies, URLs containing credentials, access tokens, headers, or raw provider responses.

### Operating modes

- **Fixture/local:** deterministic adapters, local traces, no provider or cloud telemetry requests; used by unit tests and pull requests.
- **Live/local:** real Parallel and Vertex calls with traces retained locally and sanitized.
- **Live/cloud telemetry:** explicit developer opt-in for Google Cloud trace export; never enabled by ordinary application usage or test commands.
- **Deployment:** outside this plan and requires separate approval.

## End-to-end acceptance scenarios

### Scenario A — happy path

**Given** a creator selected one valid scene and confirmed tone, period/location, budget, and target duration, **when** they request a plan, **then** Cineserye researches, plans, validates, and displays a cited chronological proposal without mutating the saved canvas. Accepting commits it once; undo removes it once.

### Scenario B — reject without side effects

**Given** a ready proposal, **when** the creator rejects it, **then** the prior document, history, persisted state, selection, and project outline contain none of the proposed records.

### Scenario C — budget pressure

**Given** a ceiling below the high-risk estimate, **when** planning completes, **then** Cineserye displays the expected overage, identifies expensive shots or attempt assumptions, and offers reviewable tradeoffs without silently removing creative requirements.

### Scenario D — limited research

**Given** Parallel returns few or no usable results, **when** planning continues, **then** the proposal is clearly marked limited-research, claims no unsupported citations, and lets the creator retry or review the conservative result.

### Scenario E — invalid model response

**Given** Vertex returns malformed or unresolved data, **when** validation fails, **then** one bounded repair may run. If repair fails, the run ends safely with no preview, persistence change, or history entry.

### Scenario F — persistence and recovery

**Given** an accepted plan, **when** the browser reloads or the project is restored from a backup, **then** cinema records, prompts, sources, costs, outline order, and canvas relationships are restored consistently.

### Scenario G — accessible mobile operation

**Given** a 390px viewport and keyboard or assistive technology, **when** the creator opens the outline, selects a shot, reviews its prompt and cost, and accepts or rejects, **then** all controls remain labeled, reachable, visible, and free of serious accessibility violations.

## Verification strategy

### Unit tests

- Domain schemas, migrations, prompt artifacts, continuity resolution, cost arithmetic, state transitions, research normalization, provider-response parsing, and command compilation.
- All provider tests use deterministic fixtures unless explicitly marked as live contract tests.

### Integration tests

- Server endpoint → research adapter → planner adapter → workflow validator → command compiler.
- Timeout, cancellation, rate limit, malformed response, repair, and limited-research behavior.
- Persistence and backup round trips containing cinema sidecar data.

### Browser tests

- Brief validation, planning progress, proposal inspection, outline synchronization, acceptance, rejection, post-accept editing, undo/redo, persistence, exports, errors, mobile panels, and accessibility.
- Run against Chromium, Firefox, and WebKit. Keep the large stress suite Chromium-only unless cross-browser execution becomes necessary.

### Opt-in live tests

- Require explicit environment flags and valid local credentials.
- Use a bounded fixture scene and strict request budget.
- Never run on ordinary pull requests or expose raw prompts, credentials, or provider responses in artifacts.

## Release gate

Every work package must pass its focused tests before the full gate:

```sh
npm run check
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=high
PLAYWRIGHT_BASE_URL=http://localhost:<cineserye-port> npm run test:e2e
git diff --check
```

Additionally:

- No serious or critical accessibility violations.
- The browser test preflight confirms the configured origin is Cineserye before running feature tests.
- No client bundle or export contains provider secrets.
- No unresolved cinema relationships or invalid graph references.
- Fixture mode makes no external requests.
- Live contract tests remain opt-in and bounded.
- No Cloudflare or Devpost deployment occurs without separate approval.

## Recommended implementation order

1. Commit the approved mock/outline baseline.
2. Persistent cinema sidecar and migrations.
3. Scene brief and validation.
4. Provider interfaces plus fixture mode.
5. Parallel research adapter.
6. Vertex structured planner.
7. Run lifecycle, prompt/cost compiler, and command proposal compiler.
8. Wire real results into the existing review UI and Project Outline.
9. Post-accept editing, persistence, backup, and exports.
10. Error states, accessibility, evaluations, and demo handoff.

The first live milestone should stop after a real Parallel result can be normalized and displayed against one selected scene. The second should stop after Vertex returns a validated proposal in fixture review mode. Only then should the full live end-to-end path be enabled.
