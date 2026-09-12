# Exact-head native CI compatibility repair — attempt 4

Status: **ACCEPTED BY FRESH CRITIC FOR THE SIX-FAMILY FOCUSED REPAIR; COMPLETE NATIVE ACCEPTANCE IS NOT ESTABLISHED**.

Frozen September 12, 2026 from exact pushed head `be3f07656bbf984c4c932fb3faefa706961dd2ad` plus the seven app/test changes below. After the first fresh critic's barrier correction, the final 429-input implementation digest is `e7f6192720c9fc4b80e1ac40edd4a382b78a0467f44e5330a8e0a05dce32111d`, computed as SHA-256 over `artifacts/simplified-flow/ci-compatibility-attempt-4/source-manifest.txt`. The mutable worktree and credential-free validation snapshot `/private/tmp/cineserye-ci-compat4b-TwiEWL` are byte-identical for all 429 inputs. Generated artifacts, videos, handoff records, and reviewer-facing records under this directory remain outside the digest.

The candidate differs from the exact pushed head in seven app/test files:

- `app/globals.css`
- `e2e/helpers.ts`
- `e2e/premise-compact.spec.ts`
- `e2e/scoped-shot-assistant.spec.ts`
- `e2e/story-assistant-stress.spec.ts`
- `e2e/story-assistant.spec.ts`
- `e2e/visual-preproduction.spec.ts`

## Exact CI failure and root-cause dispositions

GitHub Actions run `34673187791` at the exact base head completed with 608 passed, 9 failed, and 4 historical skips across 621 native executions. Static/security passed; Worker was correctly skipped by the fail-closed aggregate. The raw remote evidence and six failure families are preserved in `ci-run-34673187791-failure.md`.

1. The short-height Assistant's nominal 124px stage could not enlarge the physical interval clipped between its header and absolute footer. At the Linux-observed scale of about 0.795, the fixed chrome left about 92.87px. The compact-only header changes from 36px plus 2px vertical padding to 30px with zero vertical padding, while its close control remains 30px; footer padding changes from 4px to 1px while the primary action remains 40px. This reclaims 12 CSS pixels, approximately 9.5 physical pixels at the failed scale, for a predicted useful interval near 102.4px without changing the retained 100px assertion.
2. Chromium's premise reload stayed writable. Its failure screenshot showed Note 01 actively edited, proving the premise double-click was dispatched while React Flow's scheduled initial fit was moving and landed on a different node. `waitForCanvasSettled` requires three consecutive stable viewport-transform samples before that post-reload pointer action.
3. The 500-node stress test reloaded and immediately queried Assistant content without first waiting for document hydration. It now waits explicitly for `main[data-ready=true]` after reload with the same existing 20-second large-document readiness budget used elsewhere; the Assistant content assertion itself remains unchanged.
4. Firefox observed a transient React Flow transform immediately after selected plans were accepted. The test now polls the exact transforms of only the original host IDs. It does not include newly created plan nodes and still requires deep equality with every captured host position.
5. Firefox could click Stop while second-analysis reference preparation was still running, before the POST entered the route, making the expected two-call invariant nondeterministic. Each held request now exposes response-ready, release, and fulfillment-complete promises. Cancellation occurs only after the intercepted POST has entered and its fixture response has completed server handling; assertions proceed only after the cancelled browser request's late fulfillment attempt completes. Late response application, no duplication, saved-draft recovery, and exact call-count assertions remain.
6. Firefox/WebKit's storyboard fixture completed before Cancel could act. The first POST is now fetched through the fixture server and its response is held until after Cancel. The explicit retry bypasses interception and follows the native browser response path, with exactly two POSTs and three retry frames still required.

No product API, persistence model, production gate, cost ceiling, paid/live boundary, Playwright retry count, skip condition, or asserted product threshold was weakened.

## Credential-free proof

All counted proof used fixture mode, no provider credentials, no live/paid request, and retries disabled.

| Check | Result |
| --- | --- |
| TypeScript | PASS |
| ESLint | PASS |
| Full offline unit suite | 679 PASS, 5 intentional paid/live skips, 0 failures |
| Production build | PASS; existing chunk-size advisory only |
| Residual two-family, three-engine matrix after harness correction | 6 PASS, 0 failures/skips/flakes |
| Critic-driven analysis-cancellation barrier, all three engines | 3 PASS, 0 failures/skips/flakes |
| Final-digest consolidated six-family Chromium/Firefox/WebKit matrix | 16 PASS, 2 historical non-Chromium stress skips, 0 failures/flakes/not-run |
| Source manifest identity at freeze | 429/429 byte-identical between worktree and validation snapshot |
| `git diff --check` | PASS |

The final-digest consolidated JSON is preserved at `artifacts/simplified-flow/ci-compatibility-attempt-4/focused-three-engine.json`. Its configuration records three workers, `retries: 0`, 16 expected passes, two skips, zero unexpected/flaky, and 20.0 seconds duration. The earlier pre-critic focused pass remains separately preserved as `focused-pre-critic-three-engine.json`; it is not final-digest evidence.

Two setup mistakes are explicitly excluded from product evidence. A Vitest invocation used the unsupported Jest-only `--runInBand` option and exited before collecting tests. A later root-worktree typecheck/lint invocation lacked `node_modules` and exited with `tsc`/`eslint` not found; the same checks had already passed in the validation snapshot and passed there again after the final test changes.

An initial focused diagnostic after the first test patch produced four failures: all three scoped-shot executions because its new aggregate locator accidentally included 36 intentionally added plan nodes, plus Firefox storyboard retry because the interception copied compressed response headers on the retry. Both harness defects were corrected before the final digest and final consolidated report. They are not product failures and are not counted as passing evidence.

## Interrupted complete-native diagnostic

A complete 621-case native run was attempted from the earlier snapshot `/private/tmp/cineserye-ci-compat4-fO1xyJ` with retries disabled. Its command was `npm run test:built:node`: one `vinext start` server served all three browser projects with three workers. This topology is invalid for concurrent Final Cut coverage because the renderer has a process-wide busy guard. The turn was explicitly interrupted around test 348 before the runner completed; there is no final count or completed verdict. The old snapshot, partial report, server logs, and traces were unavailable after the interruption. Their disappearance cannot be attributed to a verified cleanup mechanism.

The retained conversation had partial runner observations naming scoped-shot, 500-node stress, inline Scene editing, media response recovery, retained-clip recovery, simplified workspace navigation, geometry/pointer cases, and Firefox Final Cut. These are unclassified observations from an interrupted, saturated run, not independently reproduced product findings. Final Cut is topology-tainted; without its trace, the exact HTTP 409 explanation is not established. No unchanged full 621-case rerun followed.

Before the repairs, only the original Chromium premise-compact failure was independently reproduced in the local baseline focused matrix (15 passed, one failed, two historical skips). The other original failure cases passed locally before amendment and are grounded in the completed exact-SHA CI evidence. The scoped-shot CI failure recorded DOM transforms only; it did not capture in-memory or IndexedDB canonical positions. `acceptScopedShotPlans` preserves original node objects, and its existing unit test asserts that preservation. Renderer convergence is therefore a supported inference, not a fact proven by the lost broad run or original failed trace. The separately authorized attempt 5 diagnostic reads canonical positions from IndexedDB and exact original-ID DOM transforms before/after acceptance and after saved reload.

Consequently, attempt 4 establishes a clean focused repair only. It does **not** establish a clean complete native matrix, Worker compatibility, exact-candidate commit, exact-SHA CI, merge, or deployment. Another unchanged full local run is not justified by this packet. The manager owns any later workflow, commit, remote, or release action.

## Fresh critic history

The first fresh critic independently matched the pre-correction 429-input digest `17cd09cf…`, exact seven-file scope, and focused JSON. It accepted five repair families but rejected the combined focused packet at 8.74/10 because the analysis-cancellation gate resolved before `route.fetch()` completed and assertions did not await the released fulfillment. The final barrier described above directly addresses that medium finding. TypeScript, ESLint, production build, the three-engine cancellation case, and the consolidated 18-case matrix all passed after the change. This changed the digest and requires the critic's fresh final-digest disposition below; the earlier verdict is preserved rather than rewritten.

## Fresh critic requirements

The critic must independently verify the 429-input digest and seven-file scope; inspect the compact geometry arithmetic against the 92.87px CI measurement; ensure viewport stabilization does not replace the pointer assertion; verify the 500-node wait is hydration-only; confirm host polling retains exact equality; confirm both cancellation tests enter and hold a real POST and continue to reject late output or duplicate/retry dispatch; inspect the focused JSON; and treat the interrupted full-native diagnostic as an open acceptance gate rather than waiving it.

## Fresh final-digest critic verdict

The fresh critic **accepted the six-family bounded repair only** at exact digest `e7f61927…`, scoring **9.18/10** with **0.98 confidence**. Category scores were correctness 9.2, simplicity 9.1, usability 8.9, safety 9.7, and evidence 9.0. It independently rehashed all 429 inputs, confirmed root/snapshot byte identity and exact seven-file scope, inspected the response-ready/hold/fulfillment-complete barriers, and verified the final focused JSON's 16 passes, two historical skips, zero failures/flakes/not-run, three workers, and zero retries per project.

There are no blocker, high, or medium findings inside the focused scope. Two low observations remain: the viewport helper proves a short quiet transform interval and can count a null inline style as stable; and the predicted compact-height headroom is modest at approximately 102.4px against the retained 100px requirement. The critic accepted both narrowly because the real pointer assertion remains, all three focused engines pass, the geometry arithmetic is sound, and the 40px primary action is retained.

The verdict explicitly does not accept the interrupted complete native matrix or waive its unresolved observations. Worker compatibility, a clean complete native run, exact-candidate commit, exact-SHA CI, merge, deployment, and release remain open.

No commit, push, workflow edit, CI dispatch, merge, deployment, public-source change, paid/live provider call, or interaction with preview port 3059 occurred in this attempt.

## Subsequent manager evidence review

The manager's independent evidence critic later scored this packet 8.7/10, conditional, with one medium gap: storyboard cancellation released its held response but did not await the fulfillment attempt before checking zero frames and starting the indistinguishable three-frame retry. Canonical runtime position proof was also pending, and the 30 CSS-pixel close control was estimated near 23.9 rendered pixels at the earlier Linux scale. The 9.18 bounded verdict above remains historical; it does not erase this subsequent finding. Attempt 5 permits one narrow amendment in `e2e/visual-preproduction.spec.ts`, adding a fulfillment-complete promise and waiting for it before the retained cancellation/zero-frame assertions and retry. Its new digest, diagnostic measurements, isolated browser repetitions, and fresh verdict are recorded separately in `ci-compatibility-attempt-5.md`.
