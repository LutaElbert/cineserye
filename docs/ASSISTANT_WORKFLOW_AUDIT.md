# Persistent Assistant workflow — code and visual audit

Date: 2026-09-07. Branch: `feature/premise-to-production`.
Scope: audit and implementation planning only. No application source, provider configuration, model selection, deployment or user project data changed in this audit.

## Verdict

The existing canvas, validated command boundary, reference permissions and real provider adapters are reusable. The approved persistent, conversational Assistant experience is **not implemented end to end**. This is a workflow/state-machine upgrade, not just restyling the existing forms.

Real AI code exists. However, the running Story Assistant and story-generation features are currently blocked from live execution, and their UI defaults to fixture mode independently of the general Live badge. No paid call was made during this audit; live response quality is unverified.

The independent critic scores current full-workflow parity at **5.9 desktop / 5.6 short / 5.3 narrow**. Earlier higher scores covered narrower changes, not the complete newly proposed experience.

## Evidence method

- Root inspected the current dirty working tree, domain/contracts, server provider boundaries, AG-UI transport and feature-status endpoints.
- Independent frontend/domain and backend/provider auditors inspected current code read-only.
- A separate critic exercised three fresh isolated fixture flows: Story → missing-detail questions → scene proposals → acceptance → scene shot-plan setup. It captured 16 states at each of 1440×900, 1366×768 and 390×844.
- Fixture browser evidence establishes interactions, not live AI intelligence, billing, actual media fidelity or deployment readiness.
- Primary-source product/protocol research informed the plan; no signed-in Miro/Higgsfield/Flow account was operated.

## Live AI truth table

| Stage | Current implementation | Evidence / limitation |
| --- | --- | --- |
| Understand premise/images | Real Vertex Gemini call through `GoogleGenAI`, with `responseJsonSchema` and application validation | `app/server/cinema/story-assistant.ts:88`; not an ADK agent invocation |
| Ask/confirm details | Application-generated question templates from extracted facts; deterministic resume | `app/domain/cinema/story-assistant.ts:59`, `:93`; not a conversational model turn |
| Generate scene outline | Real Vertex Gemini call, JSON MIME and prompt-specified structure, then Zod | `app/server/cinema/story-development.ts:40`; provider-side JSON schema is missing |
| Plan one scene's shots | Parallel research followed by a Vertex ADK `LlmAgent` | `app/server/cinema/live-workflow.ts:15`; `vertex-adk-shot-planner.ts:107` |
| Stream Assistant activity | Actual AG-UI lifecycle/checkpoint/interrupt transport | `story-assistant.ts:159`; currently start + final snapshot, not granular progress or conversational messages |
| Generate video | Live adapter exists, but the route explicitly blocks paid dispatch | `app/api/cinema/generate-video/route.ts:118`; durable provider-handle ownership/recovery is missing |

Read-only runtime observations from the user's port-3000 server:

| Endpoint | Observed response |
| --- | --- |
| `/api/cinema/provider-status` | `mode: live`; Parallel configured; Vertex Gemini model `gemini-3.7-flash`; general preflight ready; operator ceiling USD 1 |
| `/api/cinema/story-assistant?mode=live` | `ready: false`; feature enablement/review gate and missing positive bounded estimate; displayed cost 0 is **not** a free live request |
| `/api/cinema/develop-story?mode=live` | Same feature-specific blockers |

These endpoints report configuration, not successful authentication/model execution. No model or environment values were changed. Raw credentials were not inspected or printed.

## Prioritized findings

P1 means blocking the proposed workflow or a relevant live-release claim; P2 means a material incomplete behavior. This is not an assertion that every finding is a security exploit.

### A01 — P1: provider mode and saved provenance disagree

`StoryAssistantLayer.tsx:22` and `StoryDevelopmentPanel.tsx:43` each initialize `fixture`; `Editor.tsx:3405` uses global mode for shot setup. One journey can move from fixture story output to live shot planning, although live consent still protects dispatch. The general Live badge also obscures the feature-specific blockers observed above.

Saved Assistant schemas (`app/domain/cinema/story-assistant.ts:37–51`) do not retain provider/model/quote metadata. Story session `mode` denotes surprise/expand/continue, not fixture/live. Reopening therefore cannot reliably label a historical result from its true provenance.

Required: one capability read model, explicit fixture labeling/testing boundary, per-operation provider provenance, and no silent fallback or provider switch.

### A02 — P1: no conversational refinement contract

Assistant commands support only `analyze` and `resume` (`assistant-contracts.ts:17`). The server rejects supplied conversation messages (`server/cinema/story-assistant.ts:125`) and emits an empty messages snapshot (`:165`). “Regenerate selected” submits selected proposal snapshots but no revision instruction (`StoryDevelopmentPanel.tsx:195`, `:339`).

Manual edits work. “Make Scene 02 more tense, keep all four alive, leave other scenes unchanged” is not an implemented AI conversation. Fixed suggestions and eight fact fields cannot stand in for semantic follow-up behavior.

### A03 — P1: direct, scoped multi-scene shot planning is absent

Assistant offers only `Open scene workbench` (`StoryAssistantLayer.tsx:123–125`), wired to `openLayerEditor(id)` (`Editor.tsx:3472`). The planner still derives its target from exactly one selected node (`Editor.tsx:1105–1113`). There is no reviewed scene-ID manifest, aggregate approval, durable child-job queue, partial-failure recovery or Assistant-contained shot review.

The existing ADK planner receives one scene brief plus research (`vertex-adk-shot-planner.ts:51–62`), not a shared cross-scene continuity model. Reuse it behind explicit scope-aware orchestration rather than looping its UI button.

### A04 — P1: whole-story runtime is incorrectly reconciled for additive expansion

Expand creates a `whole-story` brief (`useStoryAssistant.ts:103`), but acceptance compares only selected new proposal durations against that target (`story-development-commands.ts:90–93`) and then appends them to existing scenes (`:111–114`). By code inspection, an existing 20s allocation plus a new 60s allocation can pass a 60s whole-story target. This specific numerical case was not separately executed in the browser audit.

Required: separate whole-story target, existing allocation, proposed new allocation, resulting allocation and actual approved-shot/clip runtime. Continue uses new-material timing. Never silently stretch or rewrite existing work to meet a target.

### A05 — P1: acceptance can expose both initial and completed states

Fresh captured DOM contains both “Understand my story” and “Scenes accepted” after acceptance. `assistantSourceIdentity` includes scene context (`useStoryAssistant.ts:18–21`); accepted insertion changes that context. `StoryAssistantLayer.tsx:94` permits the initial form whenever stale, even when accepted is true (`:45`). This supports the observed competing-state diagnosis.

Required: distinguish changes caused by this run's accepted output from external edits, and use one authoritative presentation state. Preserve the original analysis snapshot and derive the next production context separately; do not bypass all stale checks.

### A06 — P1: canvas visibility/placement fails the proposed flow

The Assistant opens partly behind Properties on desktop and entirely outside the narrow viewport. The critic measured x=991, width=460 on desktop (usable canvas right edge 1100), and x=536, width=358 on a 390px viewport. A separate Focus action is needed.

After acceptance, Fit View screenshots do not visually expose the three scene cards even though they exist in the outline. The Scene editor also overlaps the expanded Assistant during handoff. Node/helper collision geometry needs a focused regression before assigning every overlap to one cause. Assistant is intentionally excluded from canonical layout (`story-assistant-projection.ts:5`); acceptance placement operates on canonical nodes (`story-development-commands.ts:102`), so view-only collision reservations are a likely integration seam.

Required: reveal the active node on intentional navigation, reserve view-only editing space for newly inserted nodes, retain canonical hierarchy and existing positions, and never auto-fit on typing or streamed updates.

### A07 — P2: dense review forms and non-persistent actions

Current question controls follow a tall facts list; Continue initially falls below the visible card. Proposal review shows roughly 1–1.5 cards with older generation controls still above it. Buttons and totals are not a persistent compact review footer. Manual field editors remain valuable, but should be secondary inline expansions.

`StoryDevelopmentPanel.tsx:327–340` already computes selected allocation; preserve that, add selected count, and use the proposed concise rows + inline revision composer + one Add N scenes action. The multi-choice renderer also uses constraints-oriented copy for genre answers (`StructuredQuestions.tsx:30`); specialize by field.

### A08 — P2: progress cannot yet support the proposed checklist

Server streams emit start and terminal output (`story-assistant.ts:162–167`, `story-event-stream.ts:12–16`); clients reject unsupported events (`assistant-client.ts:30`, `story-stream-client.ts:26`). Adding decorative steps only in the UI would be false progress. Both server and client must evolve together.

Expose actual preparation/model/validation events and public status summaries, not hidden reasoning. “Reference permissions verified” is not “image analyzed”; only show each after the corresponding work actually completes.

### A09 — P2: unselected proposals lose a usable review path

Accepting a subset marks the entire session accepted and hides the proposal review (`story-development-commands.ts:88`, `:117–118`; `StoryDevelopmentPanel.tsx:327`). The data remains but remaining proposals cannot be accepted later from that session. The new contract must explicitly retain unselected proposals as drafts, recheck staleness on later acceptance and prevent duplicates.

### A10 — P1 for fully live end-to-end claims: output capabilities are not aligned

Story permits 86,400s overall and 3,600s per proposed scene; shot setup supports 6–180s per scene and the planner outputs 3–8 shots. Video settings currently support 4/6/8s and 9:16/16:9. A generated shot is not automatically renderable at its proposed duration or every Story aspect ratio.

Local assembly is explicitly bounded to 24 clips, 120s, 720p/24fps, silent output (`features/assembly/sequence-manifest.ts:5–17`). Live video remains blocked pending durable operation recovery. The 50–60 minute scenario is not an end-to-end capability today.

Required: capability-aware planning/subdivision and disclosure, no silent aspect conversion/stretching, and an actual approved-media assembly journey before claiming the complete video workflow.

### A11 — P1 for public deployment: local storage/identity/budget are not hosted production controls

Operation recovery uses native `node:sqlite` (`operation-repository.ts:18–24`); the configured hosted target is Workers. There is no deployed storage adapter or authenticated tenant ownership boundary for these client-supplied project/run IDs. Trusted local-operator use must not be described as secure multi-user hosted operation.

Operator estimates and consent ceilings are not guaranteed provider billing caps (`story-development.ts:15`; `live-preflight.ts:47`). Multi-scene work needs server-side aggregate reservations/reconciliation and explicit unresolved-outcome handling. Keep public paid endpoints disabled until hosted identity, authorization, storage and abuse controls are proven.

## What should be preserved

- Actual expanded canvas nodes, header drag handles, input isolation and view-only sizing.
- One persisted Assistant ID/position with a dotted contextual association. Semantic scenes belong to Story, never to the Assistant.
- Stable image aliases, versioned references, rights/use scopes, transfer limits and provenance checks.
- Local-only editing, exact source/quote fingerprints, no automatic fallback after provider failure, no unapproved model calls.
- Validated additive acceptance, graph IDs/edges, locks, undo/redo, manual Scene entry and local persistence/backup.
- Existing provider adapters; a direct GenAI call is real AI without being ADK. Do not rewrite it merely to add framework branding.

## Fresh verification

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed |
| Client/server boundary | Passed |
| Unit/integration | 367 passed; 3 opt-in live smoke tests skipped |
| Critic browser flows | 3 completed; 48 screenshots; no page errors |
| Requests observed in critic flows | 3 fixture POSTs each: analysis, deterministic resume, scene generation; no live/media POSTs |
| Story Generate opening | Zero generation POSTs |
| Main audited editing path | All inspected regions within actual canvas nodes; zero open HTML dialogs |
| Production build | Not rerun in this audit |
| Live Assistant/story model evaluation | Not executed; not proven by existing mocks or general status |

The critic stopped at scene shot-plan setup, not generated shot results or media. Advanced branches, gestures and live generation were not newly browser-retested here. Existing unit coverage does not replace those browser/live gates.

## Independent critic

| Viewport | Visual parity | Low friction | Canvas continuity | Trust | Overall |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1440×900 | 6.0 | 5.5 | 5.5 | 6.5 | 5.9 |
| 1366×768 | 5.8 | 5.0 | 5.2 | 6.5 | 5.6 |
| 390×844 | 5.5 | 4.5 | 4.5 | 6.5 | 5.3 |

Scores are subjective judgment against the full approved concept, not percentages of implementation. Trust includes root's separately verified live-status mismatch. **None reaches the 8.5 user-review threshold.**

Representative fresh screenshots:

- [Assistant before extra focus](../artifacts/assistant-workflow-audit/desktop-02-assistant-before-focus.png)
- [Current long proposal review](../artifacts/assistant-workflow-audit/desktop-09-proposals-review.png)
- [Accepted state](../artifacts/assistant-workflow-audit/desktop-11-accepted-immediate.png)
- [Accepted canvas visibility](../artifacts/assistant-workflow-audit/desktop-13-accepted-canvas-overview.png)
- [Scene/Assistant overlap](../artifacts/assistant-workflow-audit/desktop-14-scene-workbench-immediate.png)
- [Narrow next steps](../artifacts/assistant-workflow-audit/narrow-12-accepted-next-steps.png)
- [Capture metadata](../artifacts/assistant-workflow-audit/results.json) and [reproduction script](../artifacts/assistant-workflow-audit/audit.mjs). Metadata paths record the original temporary capture location; files now reside beside this evidence JSON under their unchanged basenames.

## Research-informed direction

- Miro consolidates creation around one Sidekick, retained context, follow-up questions and in-conversation iteration. Adopt those interaction principles, **not** its panel/modal placement. [Miro documentation](https://help.miro.com/hc/en-us/articles/33881743175954-Sidekicks-evolve-AI-creation-in-Miro)
- Higgsfield's reference-driven production and named image handles support keeping reusable characters/locations and compact prompt controls. This is workflow inspiration, not a guarantee of identity consistency in Cineserye. [Cinema Studio guide](https://higgsfield.ai/blog/cinema-studio-3.0)
- Flow's prompt references and separate generation preferences support contextual assets with optional technical controls. Actual support must come from our configured provider, not a competitor's feature list. [Flow reference workflow](https://support.google.com/flow/answer/16353334?hl=en)
- AG-UI provides lifecycle, step, state, message and interrupt events; it is the communication protocol, not the model. Use typed supported events to drive native React components. [Events](https://docs.ag-ui.com/concepts/events), [interrupts](https://docs.ag-ui.com/concepts/interrupts)
- Gemini structured output constrains response shape but still requires application validation of meaning and references. [Structured output documentation](https://ai.google.dev/gemini-api/docs/structured-output)

The Google agent workflow/ADK/evaluation skills informed separation of live behavior from contract tests. The previously retained official approval recipe reinforces typed pause/resume and deterministic approval enforcement; its in-memory session/deployment stack is not adopted. Existing TypeScript architecture and model configuration remain authoritative.

## Cleanup and handoff

The task-owned port-3040 server and browser contexts are closed. Test output was captured outside the watched project, then moved to `artifacts/assistant-workflow-audit` after shutdown to avoid Vite reload interference. The user's port-3000 server, storage, source changes and pre-existing media were preserved. No new prototype, paid generation, commit, push or deployment.

Next: [implementation plan and acceptance criteria](./ASSISTANT_WORKFLOW_IMPLEMENTATION_PLAN.md).
