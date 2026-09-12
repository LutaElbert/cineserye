# P0 attempt 2 — runtime boundary repair, NOT ACCEPTED

2026-09-10. Active checkout `/Users/elbert/Documents/ChatGPT/Cineserye`, branch `feature/simplified-flow`, base HEAD `abfa0fab2fb26c775f639358521d9a29c3a6b640`. Changes remain uncommitted. P0 remains incomplete; P1–P7 have not begun.

## Frozen candidate

Candidate digest: `ce3144e6330be5dc1863f9635632bd5323b14a6ad422d86ad610f7a5cd815904`.
SHA-256 over sorted paths, each encoded as path + NUL + file bytes + NUL:

- `app/api/cinema/assemble/route.ts`
- `app/api/cinema/generate-storyboard/route.ts`
- `app/server/cinema/assembly.ts`
- `app/server/cinema/local-request.ts`
- `app/server/cinema/native-runtime.test.ts`
- `app/server/cinema/native-runtime.ts`
- `app/server/cinema/story-assistant.ts`
- `app/server/cinema/story-development.ts`
- `app/server/cinema/workflow-capabilities.ts`
- `docs/SIMPLIFIED_FLOW_IMPLEMENTATION_PLAN.md`
- `e2e-worker/runtime.spec.ts`
- `worker.ts`

The review packet and handoff are excluded from the source digest. Validation snapshot: `/private/tmp/cineserye-p0-runtime-vwfSoM`, copied tracked files plus the two new runtime modules, no `.env`/`.dev.vars` files. It shares the prior fresh-install dependency directory by symlink. No fresh-install claim for this attempt. The plan refinement lives in the active checkout, not the build snapshot.

## Scope and intended checks

This is a bounded fix attempt under P0.5/P0.7, not full phase acceptance:

| Check | Required result | Implementer verdict |
| --- | --- | --- |
| R1 | Shared runtime guard blocks aggregate story/shot/image readiness and native mutation/render admission on Worker | Unit and serial built evidence PASS; concurrent acceptance FAIL |
| R2 | Built native Node remains usable | Startup identity and 3 Chromium Story smoke tests PASS; full native matrix NOT VERIFIED |
| R3 | Host/runtime headers cannot grant native access; story/assistant/image reject before reading body | Unit body-read spies PASS; final forged-header concurrent Worker run FAIL |
| R4 | No regression in offline/static/build/high-severity audit checks | Executed checks PASS; 5 intentional paid/live unit skips and 14 moderate audit entries retained |
| R5 | Concurrent Worker negatives pass repeatedly without retries | FAIL; no reduction of configured workers or broader timeout accepted as remediation |
| D1 | Three workspaces preserve the existing 58 criteria and actual-screen approval gates | Plan revision 3 records Story / Shots / Edit grouping; critic to verify |

## Changes and rationale

- One shared server-only native-runtime boundary replaces four separate process-API predicates. Worker fetch disables native access before route execution unless the trusted vinext context marks native Node; HTTP headers and environment values cannot enable it. The latch is one-way: an invocation lacking native context disables native access for that process until restart. This is intentionally fail-closed and an availability trade-off.
- The installed vinext production server supplies `hostRuntime: 'node'` in `node_modules/vinext/dist/server/prod-server.js` (createNodeExecutionContext). Both native start and Worker use the same built entry, so a first draft disabling at module import was wrong; built native discovery caught it and the revised candidate uses fetch context.
- Story, assistant and storyboard mutations now reject unsupported runtime before reading creative/reference payloads. Existing local request and render origin/host/token semantics are retained.
- Individual older quote GETs and saved-operation GETs are NOT consolidated by this fix. Their readiness/storage behavior remains a P1 integration gap; do not describe all diagnostics as fixed.
- Plan revision 3 implements the user's approved three-workspace grouping while retaining five journey states, all acceptance criteria, phase prerequisites and actual UI/walkthrough approval. Story vertical slice comes first within P3, not before P0–P2 acceptance.

## Verification and retained failures

All evidence paths below are relative to the validation snapshot unless stated otherwise.

| Command / experiment | Result | Evidence |
| --- | --- | --- |
| Full offline suite with `CINESERYE_REQUIRE_RENDERER_TESTS=true` and all four paid smoke opt-ins `0` | 487 total: **482 passed, 0 failed, 5 intentional paid/live skips** | `artifacts/simplified-flow/runtime-unit.json`; rerun after added pre-parse body-read spies |
| `npm run typecheck`, `lint`, `check`, `check:client-boundary`, fixture `build` | PASS in isolated snapshot | Build retains known >500kB chunk and unclassified route warnings; no renderer/live-provider readiness inferred |
| `npm audit --audit-level=high` | Exit 0; 14 moderate affected entries, high/critical clear | Existing dependency risk inventory still applies; no dependency changes in this batch |
| Built Node, Story tests matching `fixture\|cancel`, Chromium | **3 passed** | `artifacts/simplified-flow/node-fixture.json` |
| Initial built Worker test (before fetch-context correction) | 23 passed / 1 failed; initial native startup incorrectly blocked | Historical console; not acceptance evidence |
| Repeated Worker, 3 test workers | 15 passed / 57 failed after local server exited | `artifacts/simplified-flow/worker-repeat-failed.json` |
| Isolated repeated Worker, 3 test workers, stop after 2 failures | 31 passed / 2 failed / 2 interrupted / 37 not run | `artifacts/simplified-flow/worker-isolated-repeat-failed.json` |
| Serial diagnostic, 1 test worker × 3 repeats, before stronger forged-header/body test | **72 passed** | `artifacts/simplified-flow/worker-serial-diagnostic.json`; diagnostic only, not concurrency acceptance |
| Final forged-header/malformed-body Worker tests, 3 workers × 3 repeats, stop after 2 failures | **39 passed / 2 failed / 2 interrupted / 29 not run** | `artifacts/simplified-flow/worker.json`; `test-results/worker/` traces and `test-results/worker-server.log` |

The concurrent failure is reproducible: a native-only POST sometimes returns 500 rather than the expected 400, followed by localhost connection refusal. Wrangler prints an empty error. Serial success suggests concurrency sensitivity, not a proven root cause. Do not call it merely test flakiness or silently serialize CI. No provider dispatch was observed; broader guarantees await passing verification.

A command also accidentally built in the original checkout, whose build reported loading `.env.local`. No values were printed and live execution was explicitly disabled. That build is NOT acceptance evidence and its output must not be published. All browser acceptance experiments used the separate snapshot above.

## Independent review and insights

Fresh critic `p0_runtime_critic_2` independently verified the exact frozen digest, all 58 unchanged acceptance criteria, the raw unit/browser reports, and reran runtime/local-request tests (5/5 passed). Final verdict: **NOT ACCEPTED**. Confidence is high in the failed acceptance verdict and medium in production robustness. No previous planning score is reused.

| Category | Weight | Critic score |
| --- | --- | --- |
| Correctness/coverage | 30% | 7.0/10 |
| Simplicity/maintainability | 20% | 8.7/10 |
| Usability/accessibility | 20% | 8.0/10 |
| Data/security/cost safety | 20% | 8.5/10 |
| Evidence/reproducibility | 10% | 9.0/10 |
| **Weighted overall** | **100%** | **8.08/10** |

Critic criterion verdicts: R1 NOT VERIFIED under concurrency; R2 PASS for bounded native smoke; R3 NOT VERIFIED as an integrated gate; R4 PASS for executed scope; R5 FAIL; D1 PASS. These scores apply only to this attempted runtime repair, not completed P0 or the simplified app.

Parent dispositions: concurrent Worker failure is an unresolved blocker (not waived by the serial diagnostic); the two manual-panel findings below are retained high P0 blockers requiring a separate frozen repair and fresh critic; older quote/status GET inconsistency remains explicit medium-priority P1 follow-up. No finding has been disproved or represented as fixed without evidence. The final Worker trace's 500 body reports `Network connection lost` in Miniflare's core proxy entry, followed by connection refusal; this does not establish the root cause.

Preliminary independent findings retained as P0 blockers:

1. Restored full manual Story panel and hidden planning panel own separate controllers. There is no evidence of automatic duplicate dispatch, but alternate-entry cancellation/unknown recovery guards are inconsistent. Add Back/reopen/reload and no-new-generation coverage for unresolved outcomes.
2. Full-panel proposal acceptance/reordering/rejection/discard do not share the compact path's premise-lock guard; the underlying change/accept commands also lack that guard. Opening while unlocked is insufficient if the lock changes while the panel remains open. Fix and test at the mutation boundary, not only entry buttons.
3. Older feature-specific quote endpoints remain separate from aggregate readiness. Completing the shared capability contract must include these callers.

Practical simplification insights: separate runtime identity from capability availability; test positive native behavior alongside negative Worker behavior; keep one operation owner behind multiple views; enforce edit locks at the mutation boundary; preserve five task states without requiring five top-level tabs.

## Open gates and next action

No P0 acceptance. The prior Firefox/WebKit video metadata failures, full native/Worker matrices, baseline task measurements, and new manual-panel findings remain open. Investigate the concurrent local Worker failure with a minimal reproduction before any dependency upgrade or broader runtime changes. Do not remove concurrency assertions to make the packet pass.

No commit/push/merge, GitHub Actions dispatch, public change, deployment, credential update or paid provider call. GitHub Actions stays enabled; its $0 control must still be reverified before any triggering remote action.
