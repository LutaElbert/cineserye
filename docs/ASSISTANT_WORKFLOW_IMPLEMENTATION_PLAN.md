# Persistent live Assistant — implementation plan and acceptance criteria

Date: 2026-09-07; implementation checkpoint: 2026-09-08. Status: **core local implementation and fixture UI validation completed; full acceptance remains open**.
Source: [current-code and screenshot audit](./ASSISTANT_WORKFLOW_AUDIT.md).

See [implementation results and remaining acceptance gates](./ASSISTANT_WORKFLOW_IMPLEMENTATION_RESULTS.md) for actual evidence, failures/reruns, unfinished functionality and live-provider gates. The requirements below are not a claim that every sprint or acceptance criterion passed.

## Product contract

One idea → one persistent canvas Assistant → only consequential questions → reviewable scenes → scoped shot plans → approved images/clips → sequence/export.

Keep the approved visual direction: compact Story card, a purple-accented Assistant with concise status/context chips, compact editable proposal rows, a revision composer and one primary next-step action. The Assistant is an actual draggable canvas node, never a popup. Generated scenes remain semantic children of Story. Existing work and controls remain usable.

Visual reference: `/Users/elbert/.codex/generated_images/01a05805-0c91-73b1-8578-37b9bf153853/exec-3d7edb36-7290-4cd0-8236-2f6dd5185546.png`.

“Exact behavior” means the state/interaction contract below and screenshot-backed visual parity, not hardcoded generated titles or simulated progress. Model wording may vary; user constraints, scope, counts, totals, approvals and mutations may not.

## Architecture decision

Retain React/TypeScript/vinext, React Flow, Zod, the existing Vertex Gemini and ADK provider adapters, and AG-UI. Use one persisted application coordinator to expose the Assistant conversation and orchestrate bounded specialist operations. Native React question/review components render validated data; no arbitrary generated markup or A2UI dependency is required.

Alternatives considered:

1. Restyle existing independent forms: smallest change, but retains separate mode/state, no conversational revisions and selection-dependent planning. Insufficient.
2. **Recommended: one conversation coordinator around existing providers and validated commands.** Adds the necessary state/contracts without replacing working media/editor code.
3. Fully autonomous general-purpose agent with direct canvas/media tools: broader than needed, makes approval, retry and scope guarantees harder. Not selected.

A direct Gemini call is still real AI. ADK is already used for shot planning; move additional work into ADK only where orchestration benefits justify it. Do not add a Python runtime, change model IDs, deploy infrastructure or enable paid calls incidentally.

## Intended state and interaction sequence

| State | Visible card content | Primary action / transition |
| --- | --- | --- |
| Story edit | Idea; optional stable `@image` references; whole-video duration; aspect; multiple genres; three creative goals | Generate opens/reveals the same Assistant. Editing/upload/opening never dispatches a model request |
| Ready / approval required | Short context summary, actual feature/model availability, included references and scoped estimate | One inline Approve and continue when external execution needs approval; no provider-selection form or additional “Understand my story” gate |
| Understanding | Current real operation status; Stop/cancellation explanation | Automatically presents validated questions or proceeds to the next covered step; never fabricates a percentage |
| Needs input | 0–3 meaningful questions at a time, suggested answers/custom text, concise understood-context chips | Continue resolves this checkpoint. If the next paid stage needs fresh approval, its scope/cost is disclosed here rather than in another popup |
| Drafting outline | Real completed/in-progress steps; prior content remains available | Transitions to proposal review only after schema and semantic validation |
| Scene review | Compact rows, checkbox, title, one-line summary, duration; persistent selected count/runtime; inline edit and revision input | Add N scenes. Revision submission generates a new scoped proposal version, never modifies accepted scenes |
| Scenes added | Success count, collapsed direction/conversation history, selected scene scope | Plan shots, with newly accepted eligible scene IDs preselected and a Change action |
| Shot-plan approval / running | Explicit scenes, inherited direction/references, total estimated exposure, per-scene queue state | Approve scoped planning; no canvas selection required. Review successful results inside the same Assistant |
| Shot review | Scene-grouped shot proposals and impacts on existing plans/media | Accept reviewed plans; each accepted batch is one undoable validated change |
| Media | Next eligible shots, selected approved frames/takes, provider capability and cost | Explicit generation/review. Media enriches the same Shot nodes; no anonymous replacement graph |
| Sequence | Available approved clips, ordered runtime and unsupported/missing items | Review and export within actual supported limits |

Terminal/error states: cancelled, failed, stale, blocked and outcome-unknown have distinct guidance. A closed/hidden node does not mean a provider cancelled. Reload/recovery reads the existing operation, never silently purchases another.

## Approval and friction rules

- Exactly one primary action per current step; collapse completed setup and remove superseded Generate buttons.
- Do not repeat fields already explicit in the prompt or confirmed context. Ask about a contradiction even if both values were supplied.
- Questions concern creative ambiguity; provider mode and technical switches belong to capability/configuration UI, not the creative questionnaire.
- A user can delegate creative choices; suggested values stay labeled until confirmed. Creative delegation never grants spend or reference-sharing permission.
- Allow one approval to cover a disclosed bounded set of stages only when the server contract binds those stages, allowed inputs and total estimate. If inputs, references, model, scope or spend change, invalidate it and show the new approval inline.
- No automatic reference fetch, external research, image generation or video generation merely because the user submits an idea. Explicitly disclose which of these an approved operation includes.
- Preserve accepted work on revision. Unselected proposals remain saved drafts, not silently deleted or subsequently auto-added.

## Sequenced sprints

### Sprint 1 — provider truth, scope foundation and persisted lifecycle

Addresses A01, A04, A05, A09, A11 foundations.

- Expand the existing agent specification with this approved contract before implementation; keep the current TypeScript architecture and model settings.
- Create a server-derived capability response for analysis, scene development, shot planning, image generation, video and assembly. Distinguish configured, enabled, available, blocked and unverified. Replace independent default-fixture selectors on the normal path.
- Keep fixtures explicit and developer/test-only in production-facing flows; never fall back to fixtures after a real error. Preserve compatibility with isolated tests through explicit configuration.
- Version Assistant state: conversation ID/turns, confirmed decisions, proposal versions, accepted mappings, pending interrupts, operation provenance, source fingerprints and current presentation stage. Migrate old drafts without labeling their unknown provenance as live.
- Separate input provenance from outputs accepted by that run; acceptance moves to `scenes-added`, not stale-analysis plus success. A later external edit still invalidates the affected context.
- Add stable per-scene allocation records and distinguish target total/existing/new/resulting totals. For Expand with existing 20s and target 60s, propose 40s of new material or ask to increase the target; never append 60s silently. Continue 60s means +60s.
- Existing manual scenes with unknown allocation remain unknown, not zero: ask for allocation or explicitly switch to a new-material target before claiming a whole-story total. If existing allocation meets/exceeds the target, offer a target change or a separately reviewed revision; do not generate zero/negative-duration scenes. Recompute remaining allocation when saved proposals are accepted later.
- Retain unselected proposal drafts with per-proposal acceptance metadata, stale checks and deduplication.

Primary seams: `provider-config.ts`, feature status/routes, `story-assistant.ts` domain schema, `story-workflow.ts`, persistence/document-file migration, `useStoryAssistant.ts`, `story-development-commands.ts`.

Exit: mode/provenance and acceptance-transition tests pass; old projects load without mutation or provider requests; accounting tests reconcile existing/new/whole-video totals.

### Sprint 2 — real contextual conversation and validated structured output

Addresses A02 and real-AI gaps.

- Add bounded understand/answer/revise-outline intents to the server conversation contract, with explicit target IDs/versions, user message and relevant confirmed history.
- Use the existing live Gemini provider for semantic understanding and revisions. The model proposes missing consequential questions; deterministic policy validates field types, conflicts, scope, limits and safety. Keep typed UI rendering and local answer validation.
- Return a provider-compatible JSON schema for the actual production analysis/question/outline contracts, including `responseJsonSchema` for story generation. Do not prove compatibility with a toy schema alone.
- Validate counts, unique IDs, allowed enums, reference provenance, preserved unselected IDs/content, exact requested allocation and explicitly retained constraints before exposing a ready result.
- Default to one short question round; allow at most two automatic rounds with at most 3 questions each. Further unresolved conflicts remain editable and require an intentional user continuation, not an automatic question loop.
- Detailed prompts can yield zero questions. Support English/Taglish inputs, numeric phrases and image observations without falsely treating inferred details as user-confirmed.
- Preserve exact all-survive/no-dialogue/etc. requirements across turns. Use a constraint ledger with source provenance; semantic evaluation verifies adherence beyond structural checks.
- Record provider/model/run identity, call status and usage when available. Absent usage must remain unknown; never invent actual cost.

Primary seams: `assistant-contracts.ts`, `contracts.ts`, server `story-assistant.ts` / `story-development.ts`, `StructuredQuestions.tsx`, conversation state/controller.

Exit: production-schema contract tests, selective-revision safety tests and opt-in live test harness exist. Actual live semantic validation remains a separate budget-approved gate, not a mocked-test claim.

### Sprint 3 — visual parity and truthful canvas-native progress

Addresses A05–A08.

- Replace nested default forms with dedicated compact Assistant states from the visual reference. Keep advanced manual fields as inline disclosures.
- Implement a stable header (identity/status), concise context chips, scrollable body and persistent action/footer area with selected count/runtime and Add N scenes.
- Keep reference permissions distinct from actual image interpretation. Implement real step events for preparation, model dispatch/response and validation. Emit no unsupported progress claim and no raw reasoning.
- Update both AG-UI emitters and strict stream readers to accept validated step/message/state events, with bounded frames and correct run/interrupt correlation. Persist meaningful checkpoints before awaiting user input.
- Reveal a newly opened Assistant inside the usable canvas, accounting for Properties/Outline/toolbars. Preserve zoom if practical; move viewport only on an intentional open/focus/navigation action, never during typing, streaming or background completion.
- Retain Assistant ID and drag position; do not jump it to the left simply because the illustrative board shows it there. Use a view-only reserved editing rectangle for collision avoidance. Newly accepted scene cards must be visible and connected; preserve existing canonical node positions.
- After acceptance, collapse finished content to a summary and show scoped Plan shots immediately. Avoid showing the initial Analyze form simultaneously. Keep close/hide/reopen accessible.

Primary seams: `StoryAssistantLayer.tsx`, `StoryDevelopmentPanel.tsx`, `StoryComposer.tsx`, `story-assistant-projection.ts`, `Editor.tsx`, `CanvasZoomGestures.tsx`, `globals.css`, both stream clients.

Exit: screenshot state matrix at all 3 viewports; no competing primary states, hidden CTA, off-screen opening or accepted-node occlusion; canvas interaction regression passes.

### Sprint 4 — Assistant-driven multi-scene shot planning

Addresses A03 and cross-scene continuity.

- Extract a scope-aware planning entry taking explicit scene IDs; manual Scene entry becomes a single-ID wrapper. Do not infer targets from canvas selection.
- Preselect newly accepted eligible scenes; support 1–10 scenes per reviewed planning request initially. Show ineligible/locked/stale scenes with reasons rather than silently dropping them. Unknown or excessive scope requires a decision before a call.
- Build a normalized story/scene context packet with approved direction, allocations, recurring character/location/prop IDs and scoped reference summaries. Preserve exact image permissions; sending actual image bytes needs provider support and the reviewed transfer manifest.
- Introduce durable parent manifest + per-scene jobs with stable IDs, source versions, approved attempts, aggregate estimated exposure, reservations, status and result pointers. Start with serial dispatch for clear spending/recovery semantics.
- Reuse the existing research + Vertex ADK planner behind this coordinator. Only disclose research claims backed by actual sources; do not run research outside approved scope.
- Keep results in proposal state until accepted. Review by scene inside the Assistant, with selective acceptance and explicit impacts for replacing an existing plan. Shared assets need deterministic identity resolution, not string-title merging.
- Failure of Scene 02 preserves Scene 01's successful proposal. Cancel stops unstarted jobs; in-flight requests are best-effort cancellation with honest outcome/billing disclosure. Retry targets only approved failed/unstarted work with fresh approval where necessary. Unknown work is reconciled, not resent.
- Reconcile aggregate estimated vs actual usage where available. No promise of a hard upstream billing cap from an application estimate alone.

Primary seams: `Editor.tsx` planning/acceptance callbacks, `plan-scene/route.ts`, `workflow.ts`, `provider-contracts.ts`, `vertex-adk-shot-planner.ts`, `operation-repository.ts`, new scope/job contracts and Assistant shot review.

Exit: nothing selected, unrelated selection and multi-selection all produce the exact reviewed scope; partial failure/restart does not duplicate dispatch; acceptance preserves graph/locks/undo and sibling plans.

### Sprint 5 — production capability and real-media completion gates

Required to call the entire proposal→video flow fully working, not just planning UI complete.

- Validate scene/shot allocations against actual provider clip lengths and aspect support. Propose split/trim plans for approval; never silently change Story aspect or stretch short clips. For a 5s shot with 6s generation, distinguish generated length from 5s edit trim.
- Preserve existing image/video approval UI and same-Shot identity. Use a capability summary to explain why a stage is unavailable before the user invests in incompatible settings.
- Implement owner-scoped durable video handles, polling, outcome reconciliation and recovery before removing the existing paid-video block. Validate actual returned bytes/metadata, not requested labels.
- Keep media batch generation unavailable until it has its own reviewed per-shot manifest/aggregate accounting; shot-planning scope is not media-spend approval.
- Prove selected approved takes → ordered trims → local silent 720p/24fps MP4 within 24 clips/120s, with no dropped shots or automatic stretching. Preserve accurate individual image/video download MIME/bytes and missing-media recovery.
- Hosted release requires an explicit architecture decision: native Node service for SQLite/FFmpeg, or Workers with durable storage plus a separate renderer. Add authentication/project ownership, authorization, Origin/CSRF protections as applicable, rate limits and tenant-isolation tests before exposing paid endpoints. No infrastructure deployment is included in this plan execution without separate approval.

Exit: authorized real-media smoke and decoded browser-export evidence; hosted claims stay blocked until hosted contracts pass. Long-form 50–60 minute rendering, audio/captions and advanced editing remain outside the current bounded renderer.

### Sprint 6 — regression, live evaluation and independent acceptance

- Run all unit/integration tests, typecheck, lint, client boundary and production build on the final candidate.
- Run the affected browser suite in Chromium, plus critical composer/questions/review/gesture journeys in Firefox/WebKit. Add desktop, short, narrow and 200% browser-zoom evidence.
- Introduce separate live Assistant/scene-development evaluation using actual production schemas. Start with 2 approved live cases, then expand to 8 development cases plus 4 held-out cases. Run each completed set 3 times within a separately approved test budget; keep hard contracts deterministic and creative-quality judgments rubric-based.
- Required live metadata: timestamp, code revision, model/provider, run IDs, redacted event sequence, selected scope/reference versions, call count, usage when supplied and per-case scores. No raw user secrets/reference payloads in default telemetry.
- Independent critic screenshots each completed UI sprint and the final end-to-end candidate. Score visual parity, friction, canvas continuity and trust from 0–10. Any blocking finding fails the gate even if a numeric average is high.
- Record failures and reruns; do not erase failing evidence or substitute generated mockups for app screenshots. At least 8.5 overall at each required viewport, no blocking findings, then present to the user for approval.

Exit: acceptance matrix below completed with links; live quality and fixture interaction proof reported separately; cleanup verified. No claim of completion while a required live/runtime gate remains untested or blocked.

## Acceptance and regression matrix

All rows are **requirements to verify**, not passed checkboxes. Existing behavior is reused but must be rerun after changes.

| ID | Scenario | Pass condition / evidence |
| --- | --- | --- |
| AC01 | Story Generate; reopen/hide/reload | Same Assistant ID and saved position; visible on intentional open; no model request merely from opening, typing or upload |
| AC02 | Full detailed idea | Correct runtime/aspect/genres/cast/ending preserved; zero redundant questions; true provider run verified in live evaluation |
| AC03 | Sparse or contradictory idea | Only consequential gaps/conflicts, max 3 questions per round; custom answer/creative delegation; no automatic endless loop |
| AC04 | User types “Make Scene 02 more tense; everyone survives” | New scoped proposal version; exact instruction retained; other proposals unchanged; no canonical mutation before acceptance |
| AC05 | Reference mention/remove/replace | Stable alias→ID/version mapping; removing image1 never rebinds image2; unavailable/unauthorized mentions visibly blocked or excluded by explicit choice |
| AC06 | Reference permission revoked during preparation/run | Revocation before dispatch blocks transfer. Already-sent content cannot be recalled; stop subsequent transfers, invalidate approval and prevent automatic application of incompatible late results |
| AC07 | Live badge/feature blocked/reload | Header and feature show consistent capability; blocked operation cannot run; saved fixture/live/unknown provenance remains accurate; no silent fallback |
| AC08 | Malformed/unsupported model output | Invalid JSON/schema, duplicate IDs, unsafe references and semantic allocation failures never become ready/accepted output; retry only within approved policy |
| AC09 | Progress and stream faults | Real steps only; no premature green checks; duplicate/out-of-order/wrong-run/truncated/oversized frames fail safely; no arbitrary patches or code rendered |
| AC10 | Answers/interrupt replay | Typed answer validation; identical operation ID/payload retry returns the saved result without dispatch; a new operation attempting to consume an already-resolved interrupt is rejected, as are stale/wrong-project resumes |
| AC11 | Acceptance transition | Exactly one success/next-step state; no simultaneous Analyze form; scope auto-populates from actually accepted scene IDs |
| AC12 | Three scene proposals: 15/25/20s | Shows 3 selected/60s; deselect 25s updates 2 selected/35s and Add 2 scenes immediately; explicit shortfall choice required, no stretching |
| AC13 | Existing 20s + Expand whole target 60s | Resulting allocation reconciles to 60s or explicit target-change/partial approval; cannot silently accept 80s as 60s |
| AC14 | Continue 60s after chosen anchor | Existing story untouched; +60s new allocation at exact chronological insertion point; new-material label throughout |
| AC15 | Selective acceptance and undo | One validated history entry; IDs/edges/locks and existing positions retained; undo/redo exact; unselected drafts remain reviewable and cannot duplicate accepted scenes |
| AC16 | No selected node / unrelated node selected | Assistant Plan shots uses the explicit reviewed scene IDs only; no “select exactly one scene” prerequisite |
| AC17 | Scoped planning with locked/deleted/changed scene | Exclusions and reasons visible before approval; source versions rechecked before dispatch/accept; no silent substitution or mutation |
| AC18 | Three-scene planning with Scene 02 failure | Scene 01 ready result retained; per-scene status accurate; retry only scoped failed work; no duplicate successful calls; acceptance remains explicit |
| AC19 | Cancel, disconnect, browser/server restart | Queued work stops; in-flight outcome honestly shown; GET/checkpoint recovery rather than new POST; cancelled results only restored by explicit safe review policy |
| AC20 | Cost/model/reference/scope changes | Approval invalidated; aggregate estimate/allowed attempts disclosed; no unapproved retries or automatic paid media generation |
| AC21 | Open/expand/drag/type/scroll/zoom | Actual node ancestor, no workflow dialog; header drag one undo; inputs select text; modified-wheel/pinch canvas zoom works over inputs; plain scroll scrolls fields; typing 100 characters changes viewport and sibling coordinates by at most 1 CSS px |
| AC22 | Nodes and viewport at all 3 sizes | Active card/footer within usable canvas after intentional navigation; no toolbar/sidebar occlusion; inserted Scene cards distinct and hit-testable; no need to press extra Focus just to reach Continue |
| AC23 | Keyboard/accessibility/200% zoom | Correct labels/focus order/IME/Enter behavior; no serious/critical axe findings; focus/CTA not clipped; reduced-motion respected; narrow primary touch targets at least 44 CSS px |
| AC24 | Existing editor regression | Locks selectable/unlockable but immutable; Properties toggle, notes/images/connectors, manual scenes, layout/centering, pan/zoom, outline selection, undo/redo, backup/import/persistence remain correct |
| AC25 | Planning across scenes | Confirmed cast/location/props and all-survive/no-dialogue constraints survive cross-scene context; sources real and resolvable; unselected scenes untouched |
| AC26 | Shot→image→video | Same Shot ID/edges; approved frame required where provider needs it; explicit reference/settings/count/cost approval; actual media metadata verified; unsupported capabilities explained |
| AC27 | Downloads and sequence | Correct image/video bytes/MIME; exactly selected current approved takes in story order; decoded export runtime within 1 frame and matching aspect; silent/export limits explicit |
| AC28 | Public hosted generation, if claimed | Authenticated owner checks, cross-project denial, durable multi-instance recovery, rate/budget controls, secrets/privacy boundary and hosted renderer demonstrated; otherwise feature remains explicitly local/blocked |
| AC29 | Live behavior proof | Actual production schemas, no mocks/fallback; all accepted results satisfy hard contracts; every critical user constraint respected in the agreed eval set; creative usefulness/follow-up relevance average≥8.5 with no case<8.0 |
| AC30 | Independent visual approval | Fresh real screenshots for states and viewports; each viewport overall≥8.5, no blocking findings; scores and evidence sent to user; user approval is still required |
| AC31 | Undo/redo, project replacement or premise deletion while running | Late results cannot resurrect obsolete state or mutate another project; redo never redispatches or restores stale spend approval; recovery uses the original operation and current source checks |
| AC32 | Unknown/manual allocation, target already met/exceeded, later draft acceptance | Unknown is not zero; no zero/negative new duration; explicit target/allocation decision before claiming totals; later acceptance recalculates current remaining allocation and rechecks staleness |

## Canonical live evaluation scenarios

1. **Detailed happy path:** “Four friends play a cursed snakes-and-ladders game in one room. Horror + Mystery, 60 seconds total, 9:16, no dialogue. All four survive. Use @image1 for the room.” No redundant question; 3 proposed scenes preserve hard constraints; review before creation.
2. **Sparse idea:** “A board game becomes real.” Ask the minimum meaningful scope questions; do not hallucinate that runtime/ending was provided.
3. **Selective revision:** “Make Scene 02 more tense, keep Scene 01 and 03 unchanged.” Preserve IDs, allocations and unselected content; show difference before acceptance.
4. **Conflicting settings:** Prompt says 60 seconds/vertical but controls say 90 seconds/landscape. Ask rather than silently choose.
5. **Additive existing story:** 20 seconds already accepted; whole target 60 seconds. Correct remaining allocation and existing-work preservation.
6. **Continue:** Existing mixed manual/generated scenes; add 30 seconds after Scene 02. Preserve later siblings and continue from exact context.
7. **Reference safety:** Two image aliases; one revoked/replaced; instruction-like text embedded in an image. No identity remapping, prohibited transfer or instruction execution.
8. **Capability conflict:** Request a long scene, unsupported aspect or clip length. Explain planning vs rendering support and propose a reviewable split/trim, not false media readiness.

Held-out variations should change genre, language, timing phrasing and cast/ending constraints—not merely story names. Safety/transport/restart cases use deterministic fault injection; semantic tests use real model outputs and reviewer rationale. The Google evaluation skill separates these two evidence types; do not treat a process exit code or a toy schema smoke as a quality score.

## Definition of done and authorization gates

- **Planning UX complete:** Sprints 1–4 and relevant Sprint 6 criteria pass with screenshot-backed user approval and authorized live Assistant/story/shot-planning proof.
- **Full local video workflow complete:** additionally Sprint 5 and real approved-media→browser export evidence pass within disclosed limits.
- **Hosted live-ready:** hosted architecture, authentication/storage/rendering and deployment verification must also pass. Not implied by local success.
- **Submission-ready:** assess the actual submission requirements separately and describe only the demonstrated scope. A local-only submission must say so; any claim of hosted paid generation requires the hosted gate above. No submission readiness is asserted by this audit.
- This plan does not authorize paid provider evaluation, environment enablement, deployment, push or submission. Review the implementation plan first; before live tests, approve the concrete inputs/references, call/attempt counts and total test budget. Never disable a guard just to make a screenshot appear live.

## Evidence and cleanup protocol

Use a separate fixture server and fresh browser storage; never clear the user's localhost:3000 data. Write Playwright output to a validated `mktemp` directory outside the watched repository. Close browsers, stop only the owned server, then move evidence into a named `artifacts/` directory. Retain scores/failures/reruns; remove only task-owned prototypes or temporary data recoverably. Preserve all unrelated dirty files and pre-existing `videos/` assets.
