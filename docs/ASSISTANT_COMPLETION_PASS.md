# Approved visual checkpoint — completion pass

Date: 2026-09-08. User approved the prior 8.6–8.7 visual checkpoint. That approval covers the visual direction and continuation of implementation, not paid provider use or deployment.

**Completion-pass status:** implemented locally and verified within the scope below. Updated visual evidence is ready for user review. Real-provider semantic/media and release gates remain open. [Screenshots and evidence index](../artifacts/assistant-completion-2026-09-08/README.md).

## Work and acceptance

1. **History:** save revision instructions, selected proposal IDs, source/result versions and outcome/provenance; reopen older drafts inside the same Assistant without reordering history, changing canonical scenes or dispatching requests. Stale drafts remain safely read-only until a new explicitly reviewed request.
2. **Retry:** explicit failed/unstarted-only retry scope, fresh quote and approval, durable one-consumer parent lineage, no ready-success redispatch, no unknown/in-flight retry, successful siblings retained through reload/partial acceptance.
3. **Identity:** explicit stable continuity bindings, never merge solely on matching display names. Validate category/identity/source scope, preserve existing user-owned hosts and media, reject forged/ambiguous bindings. Legacy projects must still load without data loss.
4. **Canvas:** initial overview framing waits for loaded-node measurement once; never competes with expanded Assistant/layer navigation or reacts to typing. Continue labels distinguish additional material from whole-video totals.
5. **Regression:** deterministic unit/contracts, affected Chromium/Firefox/WebKit journeys, independent screenshots of changed states; preserve failed evidence and clean only owned resources.

The real-provider semantic/media gates, native browser zoom, physical trackpad and hosted authentication/deployment are separately verified or disclosed below. No new SDK/framework/runtime or model selection was introduced. The Google agent workflow/code skills informed schema validation, explicit approval, durable recovery and the distinction between fixture tests and live semantic proof.

## Test isolation

Use task-owned fixture origin `http://127.0.0.1:3040` and temporary operation databases/output under `/tmp/cineserye-assistant-completion.Y0o8Ut`. Leave user localhost:3000 data and server unchanged. Do not enable paid feature flags or write credentials/environment configuration.

## Implemented behavior

- **Append-only revision history:** persisted instructions, proposal targets, operation/session ancestry, source/result versions, outcome and provenance. Older unaccepted drafts reopen locally in the same Assistant; stale sources are read-only. An explicit review-session selector avoids accidentally reordering history or remounting away a rejected revision instruction.
- **Safe scoped retry:** only server-confirmed, not-dispatched jobs can be retried. Ready, running, unknown and legacy-unmarked jobs are excluded. The user reviews a fresh subset estimate before dispatch. A durable one-consumer parent fence prevents concurrent successors and old queue replay. Ready/accepted siblings survive partial acceptance, reload and linked recovery. Recovery is GET-only and validates project, input, lineage and cycle limits.
- **Explicit continuity identity:** reviewed entity IDs and typed bindings replace display-name merging. Unknown, duplicate, wrong-category and stale bindings fail closed. Reused hosts retain their text, references and media; only scene membership and links are added. Independent new entities remain separate even when names match.
- **Inline duration correction:** missing allocations are corrected in the Assistant without provider calls or canvas movement. Source/lock checks are repeated at commit. Continue labels describe additional material, not a misleading whole-video total.
- **Stable canvas:** initial overview fit waits for measured loaded nodes once, and does not run while editing or respond to typing. Expanded layers remain real draggable canvas nodes. At very short heights, the Assistant uses one content scroller rather than stacking fixed metadata around a nearly invisible form.

## Acceptance delta against the original 32 criteria

| Criteria | Completion-pass evidence |
| --- | --- |
| AC04, AC15 | Persisted revision lineage, local history reopening, stale-read protection and unchanged accepted siblings. |
| AC14, AC32 | Additional-material labels and inline allocation correction, with no generation or graph motion during local correction. |
| AC18, AC19, AC20 | Durable failed/unstarted retry manifests, fresh approval, server-side no-dispatch proof, parent/successor fencing and identity-checked recovery. Actual provider restart/billing proof remains open. |
| AC22 | Three-engine initial-overview hydration regression; no fit on typing. |
| AC23 | Actual native Chrome 200% inspected through computer use; short-height cross-engine follow-up recorded below. Physical trackpad/pinch is not verified. |
| AC24 | Superseded editor/story/critic selectors migrated without removing their behavioral assertions. Full repository E2E green status is not claimed. |
| AC25 | Explicit stable identity binding and ambiguity/staleness tests replace title matching. Live visual continuity is not proven. |
| AC30 | Prior visual checkpoint approved by the user. New completion-pass critic evidence is a separate approval checkpoint, not spend authorization. |

Other criteria retain their earlier scope and live limitations. This pass does not claim hosted authentication, paid-provider fidelity, production video output or final submission acceptance.

## Native browser zoom check

Computer use selected only a task-owned Chrome tab on `http://localhost:3040/`. Chrome's native UI reported **200%** (CSS viewport 735×389, DPR 4), not merely a simulated device-pixel ratio.

- Story editing and Assistant initial, understood-context, outline review, revision typing and local history reopening were inspected.
- Before the fix, the Assistant's content area was only 28px high. The revised outer scroller measured 178px at a 218px node height, retaining the primary action.
- Typing a revision scrolled only the content: canvas transform remained exactly `translate(-458.9px, -93px) scale(0.8)` before and after. Reopening history also retained that transform.
- Chrome was restored to native **100%** (1470×779, DPR 2), verified in its native UI, and the owned tab was closed. No user tab was closed.
- Native screenshots are present in the computer-use tool record. Durable short-height screenshots use the equivalent CSS viewport and are labeled separately; they are not represented as native-browser screenshots.
- **Final-source native rerun:** a lower revision field exposed an additional `overflow:hidden` shell scroll (18.5px), which clipped the header despite an unchanged canvas transform. The shell now uses `overflow:clip`; the inner content stays `overflow:auto`. On the final native Chrome 200% rerun, shell scroll remained 0, header top139.8 stayed inside node top139, footer bottom314.2 stayed inside node bottom315, and revision typing retained the exact canvas transform. History and returning to current flow remained reachable. Native zoom was again restored to100% and the final owned tab closed.

## Verification record

Results are recorded per run; superseded failures remain in the evidence tree.

| Check | Observed result |
| --- | --- |
| Final-source full unit/integration rerun | **451 passed, 5 skipped**; 77 passing and 4 skipped files; one worker, 24.99s. Same full result also passed twice earlier in the pass. |
| Editor focus legacy migration | **21/21**, Chromium/Firefox/WebKit. |
| Story development legacy migration | **12/12**, Chromium. Includes fixture downloads, reload, undo/redo, references, continuation, cancellation and mocked approval races. Other engines not run for this suite in this pass. |
| Premise production critic legacy migration | **9/9**, Chromium. Geometry, no-popup behavior, drag/zoom, reference permissions and fixture media approval assertions retained. |
| First quiet final affected run, including new short-height cases | **49/51**, all 45 pre-existing affected cases passed across three engines. Two new WebKit short-height cases exposed a real sticky-footer geometry problem (73.65px visible content vs 100px minimum). Threshold not relaxed. |
| Short-height follow-up after WebKit fix | **9/9**, Chromium/Firefox/WebKit, 18.5s. Initial, understood, outline/history, sparse questions/typing and a synthetic live estimate USD12.75/ceiling USD25.5 all retain ≥100px visible content. The full disclosure and approval remain visible. All provider POSTs blocked; none attempted. Evidence: `short-assistant-verified/`. |
| Strengthened lower-field focus regression | **9/9**, Chromium/Firefox/WebKit, 17.7s. Adds a lower revision field click/fill, shell scroll0, header inside node, pinned footer and unchanged canvas. Evidence: `short-assistant-focus-clip/`. |
| Affected full-browser run before the final shell-only clipping correction | **54/54**, Chromium/Firefox/WebKit, 2.4m. |
| Final-source affected full-browser run | **53/54**, 2.4m. One Chromium target crashed while opening the sample Shot, before the approval assertions. No assertion failure was reported for that case; the target-crash cause was not established. All other final-source cases passed. |
| Unchanged approval test, isolated repeat | **6/6**, two repetitions per engine, 17s. The exact failed test was rerun without source/test changes. All 54 affected cases have final-source passing evidence across these runs; this is not represented as a single clean54/54 final-source run. |
| Typecheck / ESLint / diff whitespace | Passed. ESLint retains one existing unused-variable warning in `artifacts/assistant-workflow-audit/audit.mjs`. |
| Production build | Passed. Existing >500kB chunk warning and vinext static route-classification warning remain. |
| Client/server boundary | Passed after the production build; provider configuration/adapters remain server-only. |

### Independent visual review

| Viewport/scope | Score |
| --- | --- |
| 1440×900 completion states | 8.7/10 |
| 1366×768 completion states | 8.6/10 |
| 390×844 completion states | 8.6/10 |
| 735×389 final WebKit fixture + synthetic-cost screenshots | 8.6/10 |

These are independent heuristic judgments, not real-user study results. Retry screenshots use explicitly synthetic saved-checkpoint GET responses to represent mixed success/failure; they do not establish a real retry dispatch. Backend durability and retry fencing have separate automated contract tests.

The final short-height critic inspected the passing WebKit screenshots after the footer fix and retained an 8.6/10 verdict with no blocker in that bounded scope. The earlier verdict and failure chronology remain in the critic report. This is still a user-approval checkpoint, not automatic acceptance.

### Failures retained

- Revision UI remounted when a request created a session, losing an instruction after a known pre-dispatch rejection. Stable explicit review keys fixed this; rejection/retry regression retained.
- Outdated legacy selectors assumed removed forms or clicked hidden narrow-screen sidebar controls. Tests now use visible canvas/Assistant controls while preserving the original safety assertions.
- A loaded 44/45 run timed out at WebKit initial readiness before the storage test assertions. The quiet run subsequently passed that storage case and all original 45 cases.
- Native Chrome 200% revealed the cramped Assistant; equivalent cross-engine tests then found WebKit sticky-footer behavior. These are actual layout findings, not waived test failures.
- WebKit was fixed by anchoring the short-only footer to the node bottom and reserving its measured height using DOM-only observers. No React/document/viewport writes are involved. Full cost copy initially left 99px of body space; header spacing was tightened without removing copy or shrinking the 32px controls. The ≥100px requirement remains. A separate exact visibility ratio failed at 0.999999821; only that floating-point comparison now uses 0.9999, alongside unchanged geometry and no-text-overflow checks.
- The final native pass found focus scrolling the hidden shell, which previous viewport-transform assertions did not detect. The shell is now non-scrollable, and tests assert both inner scrolling and outer/header/footer geometry after lower-field focus. This failure is documented rather than represented as covered by the earlier54/54 run.
- A final-source Chromium target crashed before SAFE-02 approval assertions. Its trace/error context remain in `regression-final-source/`; the unchanged test passed twice per engine in `approval-crash-rerun/`. No test was skipped, weakened or silently retried to erase that run.
- One client-boundary invocation overlapped the build clearing `dist/client` and failed with ENOENT. The check was then sequenced after the completed build and passed. This was an orchestration ordering error, not a waived boundary violation.

## Remaining external acceptance gates

Read-only capability inspection of user localhost:3000 still reports `live` mode with `configuration-only` proof. Gemini analysis/story and research/Vertex ADK shot adapters are configured, but integrated workflow enablement and positive bounded estimates are missing. Image pricing/spend limits and video enablement/verification are also blocked. Assembly requires approved current clips and renderer preflight.

Next requires a concrete approved live test plan: inputs and reference permissions, stages, attempt counts and spend ceiling. Analysis/outline/shot semantic proof and actual image/video/export proof are separate gates. **No paid call, environment/model change, credential change, deployment, commit or push occurred in this pass.**

Intentional boundaries:

- Matching entity names do not authorize identity merging. New entities need explicit binding before reuse; this is safer but not automatic visual continuity.
- Replacing a reused reference's own source plan is blocked to preserve its provenance/media. Cross-scene reuse is supported.
- Local same-origin guards are not hosted authentication or tenant isolation.
- Native physical trackpad/pinch and the full repository's E2E matrix remain unverified.

## Cleanup and final checks

- Task-owned fixture Vite PID55511 on port3040 was stopped. A read-only listener check confirmed port3040 is no longer listening.
- User development server PID16013 was left running; `http://localhost:3000/` returned HTTP200. No user project storage was cleared.
- Owned native Chrome test tabs were closed after restoring native zoom to100%. Automated browser contexts/processes finished. Isolated-origin browser storage was not explicitly erased, so no claim of wiping all browser test state is made.
- The two task-owned SQLite databases were moved to **recoverable Trash** at `/Users/elbert/.Trash/cineserye-assistant-testdb.dbGSgu/`. Neither is included in the evidence archive. Nothing was permanently deleted.
- All screenshots, reports and failed traces were moved from the task temporary directory to [the evidence archive](../artifacts/assistant-completion-2026-09-08/README.md). The source temporary directory no longer exists. The archive is about185MB and remains uncommitted with the rest of the worktree.
- No deployment, commit, push, environment/model change, credential change or paid-provider call was made. Existing unrelated dirty changes and pre-existing media/prototypes were preserved; cleanup covered only resources created for this completion pass.

The current agent-workflow/code skill guidance specifically shaped the explicit approval, durable recovery and live-versus-fixture separation. It did not replace the existing TypeScript/AG-UI/Vertex ADK architecture.
