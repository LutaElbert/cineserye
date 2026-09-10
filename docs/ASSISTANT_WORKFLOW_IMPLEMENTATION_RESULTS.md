# Persistent Assistant — implementation checkpoint

Date: 2026-09-08 (Asia/Manila). Branch: `feature/premise-to-production`, based on `a102074` plus existing and current uncommitted changes. No commit or push was made. This is a local implementation checkpoint, **not full live/release acceptance**.

**Later completion pass:** the user approved this visual checkpoint and continuation. The [completion-pass results](./ASSISTANT_COMPLETION_PASS.md) supersede the open implementation items and approval status below. This document is retained as the earlier checkpoint, including its exact run counts and limitations.

References: [approved plan and 32 criteria](./ASSISTANT_WORKFLOW_IMPLEMENTATION_PLAN.md), [baseline audit](./ASSISTANT_WORKFLOW_AUDIT.md), [evidence index](../artifacts/assistant-workflow-implementation-2026-09-08/README.md).

## Delivered

- Topbar planning is replaced by the persistent Assistant entry. Story, Assistant, Scene and Shot editing remain actual canvas nodes, with header dragging, inline controls and existing graph connections.
- Compact structured questions, understood-context summary, real lifecycle progress, scene proposal rows, selected totals, inline scoped revisions and explicit acceptance. No generated markup or workflow popup.
- Scene planning takes an explicit reviewed list of 1–10 scene IDs, independent of canvas selection. Newly accepted scenes become the default scope. The server persists a serial parent manifest and per-scene checkpoints before dispatch, binds results to source/run/scene/aspect/duration, and does not silently retry uncertain calls.
- Successful plans stay proposals until accepted. Acceptance revalidates sources, preserves other scenes and creates one history entry per accepted batch. Media is reached through the existing Shot node, not an anonymous replacement graph.
- Real Gemini production schemas, contextual questions and scoped outline revision adapters; existing research/Vertex ADK shot planning behind the scoped coordinator. AG-UI reports actual operation steps. Fixtures and unknown provenance are visibly distinguished from live output.
- Correct whole-story versus new-material accounting, manual allocations, incremental current-session acceptance and reference/version safeguards.
- Durable locally owned video handles, cancellation/restart safety, same-origin native-local request guards, honest fixture metadata and full bounded decoding of live-returned MP4 bytes before acceptance.

The Google agent workflow/code/evaluation skill guidance informed production-schema validation, explicit spend gates and the separation of deterministic interaction tests from live semantic evaluation. The existing TypeScript architecture was retained.

## Verification performed

| Check | Actual result |
| --- | --- |
| Full unit/integration suite | **414 passed, 5 opt-in tests skipped**; 73 passing files, 4 skipped files; `npm test -- --maxWorkers=1` |
| Late-cancellation UI guard after test refinement | 3/3 passed; original cancellation response explicitly resolved after operation replacement |
| Typecheck | Passed |
| ESLint | Exit 0; one existing unused-variable warning in `artifacts/assistant-workflow-audit/audit.mjs` |
| Client/server boundary | Passed |
| Production build | Passed; >500 kB chunk warning and vinext static route-classification warning remain |
| Diff whitespace | `git diff --check` passed |
| Four affected browser suites, 3 engines | Initial final run **50/51 passed**. Sole WebKit reference-reload test assumed an offscreen Shot was directly clickable. Corrected to use real Outline navigation and pointer hit testing; both Scene/Shot cases then **6/6 passed** across Chromium, Firefox and WebKit. All 51 affected cases have passing evidence across these runs; not a single 51/51 clean run. |
| Additional Assistant/stress migrations | 10 Chromium cases passed across initial/rerun sets, including 500-node stress, cancellation/reload, reference scope, fixture image/video approval and downloads, and blocked-capability/no-paid-POST behavior |
| Assistant accessibility | Zero Axe violations in the reviewed Assistant state after darkening suggested-text contrast |
| Media bytes | Real local **synthetic** 4s, 720×1280 MP4 fully decoded; deterministic video tests passed. This is not paid-provider media evidence. |

The full repository Playwright suite was **not** established green. Older `premise-production-critic.spec.ts` and parts of `story-development.spec.ts` still encode superseded UI/provider selectors and require migration with their assertions preserved.

### Failures retained, not hidden

- Earlier browser runs found selected-flag source-digest rejection on selective revision, lost revision errors, mobile toolbar/Shot focus races and reload Assistant initial-fit competition. These received code fixes and focused regression.
- Initial compact layouts scored 7.9–8.1 and failed visibility/friction gates. Critic screenshots and later passing reruns are retained separately.
- Concurrent unit/browser load caused two performance-budget tests to fail (222ms vs 100ms and 198ms vs 150ms). The budgets were **not relaxed**. The complete unit suite passed with one worker after browser workloads settled.
- One critic attempt was contaminated by development HMR while other agents edited files. It is retained as invalidated evidence, not counted as acceptance.
- Reloading the ordinary overview may expose an initial React Flow auto-fit timing race. Explicit Outline navigation works. The repaired reference-persistence test does not prove this independent overview race fixed.

## Independent critic / approval checkpoint

Scope: fixture idea → Assistant → scene review/acceptance → scoped shot review/acceptance → actual Shot/media editor handoff.

| Viewport | Overall score |
| --- | --- |
| 1440×900 | **8.7/10** |
| 1366×768 | **8.6/10** |
| 390×844 | **8.6/10** |

All four critic rubric categories scored at least 8.5, with no remaining blocker in this scope. Final mobile Chromium and Firefox handoff had 16px toolbar clearance. These are expert heuristic ratings, not user-study results. **User visual approval is pending**, as requested. The scores do not approve live AI quality or media production.

## Acceptance matrix — actual status

“Local evidence” below refers to deterministic contracts and/or fixture browser behavior, never a claim of live semantic success.

| ID | Status and limitation |
| --- | --- |
| AC01 | Local evidence: same Assistant identity/placement, hide/reopen/reload and no provider POST on opening/typing. |
| AC02 | Partial: production schema and detailed fixture flow pass; real-model fidelity and redundant-question quality untested. |
| AC03 | Partial: bounded typed questions/custom answers and sparse fixture flow pass; live contextual usefulness untested. |
| AC04 | Partial: selected-only revision, rejection/retry and sibling preservation pass. The revision instruction is sent but not stored in a persisted conversation/turn history. |
| AC05 | Local reference alias/version/bridge tests and browser reference ownership pass; no live image-transfer evidence. |
| AC06 | Deterministic approval/source invalidation covered; actual in-flight external reference revocation behavior is not live-proven. |
| AC07 | Local capability/provenance tests pass; read-only localhost:3000 capability response confirms actual blocked stages. No fixture fallback was enabled. |
| AC08 | Production JSON schemas, invalid-output/scope/allocation contract tests pass; live production-schema evaluation remains opt-in. |
| AC09 | Strict AG-UI lifecycle/stream validation covered; no invented percentage or arbitrary generated UI. |
| AC10 | Persisted idempotency/checkpoint and typed-resume contracts covered; no real-provider replay test. |
| AC11 | Three-engine fixture evidence: accepted scenes lead to scoped Plan shots, not the initial analysis form. |
| AC12 | Local selected-count/allocation/partial-acceptance checks; no stretching to conceal runtime shortfalls. |
| AC13 | Whole-story accounting tests pass for existing/new totals. |
| AC14 | Partial: Continue insertion and additional-duration accounting pass, but an Assistant context chip still says “Xs total” instead of “Xs new material.” |
| AC15 | Partial: current-session acceptance/undo/stable IDs and retained unselected drafts pass. Older sessions remain stored but do not yet have a history/reopen selector. |
| AC16 | Three-engine scoped workflow passes without canvas-selection prerequisites. |
| AC17 | Local eligibility/source/lock/tampered-result validation covered. |
| AC18 | Partial: successes survive sibling failure, but a dedicated failed/unstarted-only retry manifest/action is not implemented. Generic new scope is not equivalent. |
| AC19 | Partial: durable server checkpoint, cancel and unknown-no-redispatch contracts covered; full real-provider restart/reconciliation UI proof remains open. |
| AC20 | Bound quotes/model/scope/attempt validation covered; real cost and provider billing remain unknown. |
| AC21 | Three-engine canvas typing/header-drag/modified-wheel/plain-scroll checks pass. Physical trackpad/pinch remains unverified. |
| AC22 | Three viewport critic gate passes for intentional Assistant/Shot navigation and accepted-node reveal. Ordinary overview hydration auto-fit is a separate open issue. |
| AC23 | Partial: reviewed keyboard/narrow layout/Axe checks pass; native 200% browser zoom was not verified. |
| AC24 | Partial: affected gestures, locked-layer inspection, persistence and several legacy journeys pass; full legacy E2E migration/regression remains open. |
| AC25 | Partial: shared story context and reviewed continuity IDs reach planning; final entity reuse still matches normalized title/category, not a deterministic identity contract. Live cross-scene continuity is unproven. |
| AC26 | Partial: same-Shot fixture media flow, approval gates and byte-validation tests pass; actual provider image→video run remains blocked/unverified. |
| AC27 | Partial: fixture downloads and local synthetic decoding tested; approved real-provider takes→browser-export decoded evidence missing. Local renderer is silent 720p/24fps, bounded to 24 clips/120s. |
| AC28 | Explicitly not claimed: native-local loopback/same-origin guard is not hosted authentication or tenant isolation. Hosted deployment remains blocked. |
| AC29 | Not run: real production-schema and semantic evaluation requires agreed inputs, attempt counts and budget. |
| AC30 | Scoped critic ≥8.5 at all three viewports; user approval pending. |
| AC31 | Deterministic late-result/project replacement/undo/source safety covered; no actual paid race/restart proof. |
| AC32 | Allocation edge cases and later partial acceptance covered. Unknown allocation fails safely but its resolution still requires manual editing or scope change instead of an inline Assistant question. |

## Remaining implementation, in order

1. Persist revision/conversation lineage and provide safe read/reopen of older unaccepted drafts; correct Continue context labeling and improve unknown-allocation correction inline.
2. Add a reviewed failed/unstarted-only retry operation that retains earlier successful proposals, excludes uncertain jobs until reconciled, and binds a fresh quote/source manifest.
3. Replace normalized-title continuity merging with explicit stable entity identity/bindings and cross-scene ambiguity tests. Shared context alone is not enough.
4. Close ordinary-overview hydration fit, migrate remaining affected legacy tests and perform native 200%/physical-trackpad checks. Preserve existing positions and never auto-fit on typing.
5. After visual approval, review concrete live inputs, reference permissions, attempt count and estimate. Enable only the authorized features and run real analysis→outline→shot-plan semantic tests. Then separately authorize actual image/video/export proof if desired.

## Current live configuration — observed, not modified

Read-only GET of `http://localhost:3000/api/cinema/workflow-capabilities` on 2026-09-08 reports live mode and `configuration-only` proof:

- Analysis/story: Gemini configured, but integrated-workflow enablement and a positive bounded story estimate are missing.
- Shots: configured research/Vertex ADK adapter, but a positive per-scene planning estimate is missing.
- Images: pricing and positive per-request spend limit need review.
- Video: explicit enablement/verification gates remain closed.

No paid calls, environment changes, credential changes, deployments or pushes were made. Merely approving the UI does not authorize provider spend.

## Cleanup

Task-owned fixture server/browser cleanup and preserved artifact locations are recorded in the evidence index. User localhost:3000 data, its server, existing dirty changes and pre-existing video assets are outside cleanup scope.
