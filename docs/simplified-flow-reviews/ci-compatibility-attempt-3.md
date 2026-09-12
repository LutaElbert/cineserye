# Native CI compatibility repair — attempt 3

Status: **ACCEPTED BY FRESH CRITIC FOR THE FIVE-FILE SOURCE/TEST REPAIR; REMOTE RELEASE GATES REMAIN OPEN**.

Frozen September 12, 2026 from private release head `0739587da0482e85724398445dd65617cd315523`. The 429-input implementation digest is `f11fc9d6497275c0c9b231702ce0e3131cec449a266d4571063b91c0906968a5`, computed as SHA-256 over `artifacts/simplified-flow/ci-compatibility-attempt-3/source-manifest.txt`. The mutable worktree and credential-free snapshot `/private/tmp/cineserye-ci-fullfix3-PED8ys` are byte-identical for all 429 inputs at freeze. Generated artifacts, videos, review records, and handoff records remain outside the digest.

The candidate differs from the private release head in exactly five implementation/test files:

- `app/editor/Editor.tsx`
- `app/editor/useDocumentWriter.ts`
- `app/features/assembly/SequenceReview.tsx`
- `app/globals.css`
- `e2e/final-cut-export.spec.ts`

## Preserved CI repair scope

The four original CI failure families and their repairs remain unchanged from attempt 2:

1. The short-height Assistant stage reserves 124 pre-transform CSS pixels, preserving the existing 100-physical-pixel contract after React Flow scaling.
2. Sequence preview distinguishes no approved clip, approved media with a local usability issue, and approved media still loading; incomplete states continue to block render.
3. The unchanged 4200ms restore-toast lifetime begins after two animation frames so heavy document replacement cannot batch insertion and removal before a paint.
4. Web Lock acquisition uses four non-blocking attempts over a bounded 500ms handoff window so same-tab reload can recover writer access while a genuine second editor still becomes read-only.

No assertion, retry count, skip condition, duration threshold, writer-lock boundary, production gate, cost ceiling, or paid/live provider boundary was weakened.

## Attempt history and the critic-14 repair

Attempt 1's immutable two-file digest `8969ecd6…` was accepted by critic 13 at 9.5/10. Attempt 2's immutable four-file digest `5ebaf3e1…` was rejected by critic 14 at 8.6/10 because corrupt approved MP4 bytes produced a decode issue and disabled Render but still selected a broken `<video>` instead of the unusable-media fallback.

Attempt 3 gates the player specifically on decoded-media usability: a loaded clip must have no decode error and a non-null decoded duration. It deliberately does **not** gate on every active issue, because a valid decoded short clip with an overlong trim remains previewable while Render is disabled. The existing Final Cut short-footage case now continues past its valid-trim proof, replaces the approved media with a six-byte invalid MP4, and asserts the generic unusable preview, exact decode warning, absence of the broken preview player, and disabled Render.

The parent turn was interrupted immediately after this regression test was first patched. On manager-directed resume, the partial state was inspected and preserved; a missing required width/height test-fixture field was corrected after the first typecheck caught it. No interrupted build, browser run, source mutation, or acceptance result was counted as proof.

## Credential-free proof

All proof ran from `/private/tmp/cineserye-ci-fullfix3-PED8ys` in fixture mode with live mode disabled and provider credentials absent.

| Check | Result |
| --- | --- |
| Compatibility check | PASS, 100% supported |
| TypeScript | PASS |
| ESLint | PASS |
| Full offline unit suite | 679 PASS, 5 intentional paid/live skips, 0 failures |
| Production build | PASS; existing chunk-size advisory only |
| Post-build client-boundary scan | PASS |
| `npm audit --audit-level=high` | PASS; 0 high/critical, 14 existing moderate advisories |
| Exact five-spec Chromium/Firefox/WebKit suite | 47 PASS, 4 intentional non-Chromium stress skips, 0 failures, 0 flakes |
| Repeated lifecycle suite (`--repeat-each=3`) | 24 PASS, 12 intentional non-Chromium stress skips, 0 failures, 0 flakes |
| Final Cut Chromium shard | 2/2 PASS, including corrupt-media fallback |
| Final Cut Firefox shard | 2/2 PASS, including corrupt-media fallback |
| Final Cut WebKit shard | 2/2 PASS, including corrupt-media fallback |
| Source manifest identity | 429/429 byte-identical between worktree and snapshot at freeze |
| `git diff --check` | PASS |

Raw fixture reports are stored under `artifacts/simplified-flow/ci-compatibility-attempt-3/`: `focused-three-engine.json`, `repeated-lifecycle.json`, and one `final-cut-*-shard.json` per browser.

## Renderer-concurrency diagnostic

One earlier all-browser Final Cut execution completed 6/6, but no clean combined runtime is claimed as final proof. A later all-browser diagnostic using the current single-server/three-worker topology completed 5/6: Firefox's real renderer test received HTTP 409 while Chromium and WebKit rendered concurrently, then timed out waiting for output. Before later Playwright runs cleaned the transient trace directory, direct inspection of its network stream recorded `POST http://localhost:60532/api/cinema/assemble` at `2026-09-12T04:12:15.008Z`, a 382721-byte request, and `409 Conflict` after 2.153ms. The route has exactly one 409 path: its intentional process-wide `busy` guard returns `Another local render is already running. Wait for it to finish.` The failed raw report is preserved as `final-cut-all-engine-concurrency-failure.json`; the trace zip itself is not claimed as a retained artifact. The failure is not hidden, retried, or counted as acceptance.

The first execution of the proposed per-browser topology then passed 2/2 independently for Chromium, Firefox, and WebKit without Playwright retries. Each isolated browser shard has only one test that invokes the renderer, so it preserves the server's safety guard rather than weakening it or teaching product code to allow concurrent local FFmpeg work.

## CI execution recommendation

The current workflow serializes static/security checks, build, 621 native browser executions, a six-renderer assertion, and 129 Worker executions in one 30-minute job. The cancelled CI run `34664281006` spent roughly 22 minutes inside native tests without completing them; the local 409 diagnostic additionally shows that sharing one native server across renderer cases can race the deliberate single-render guard.

Preserve all tests and assertions while splitting the workflow into parallel jobs:

1. Static/security/unit/build/client-boundary checks.
2. A three-browser native matrix, one isolated browser per job, each running `test:built:node -- --project=<browser>` and asserting exactly two Final Cut executions in its own report.
3. The existing Worker compatibility matrix in a separate job.

This reduces wall-clock timeout risk and isolates each browser's single real renderer invocation without adding retries or skips. It repeats installation/build work and may consume more aggregate included minutes, so the manager must perform a fresh cost-cap/Stop-control check and explicitly authorize any workflow change or dispatch.

## Fresh critic requirements

The new critic must independently verify digest and five-file scope; reproduce short-height geometry and missing/loading/unusable preview truthfulness; prove valid decoded short footage remains visible; prove corrupt approved bytes show the fallback and decode warning with no broken preview video and disabled Render; verify same-tab writer recovery, genuine second-editor read-only behavior, and painted heavy-restore status; inspect the raw clean and deliberately preserved failed renderer reports; and assess the per-browser sharding recommendation separately from exact source acceptance.

## Fresh critic verdict

Critic 15 **accepted** exact digest `f11fc9d6…` at **9.4/10** with **0.93 confidence**. It independently rehashed 429/429 inputs, confirmed snapshot/worktree identity and the exact five-file scope, passed typecheck and ESLint, reran the focused suite at 47 PASS / 4 intentional skips, reran genuine second-editor behavior at 3/3, and obtained 2/2 Final Cut passes in each isolated browser shard. It also confirmed the preview predicate preserves valid decoded short footage while routing corrupt approved bytes to the unusable fallback with the decode warning, zero preview video elements, and disabled Render.

The verdict deliberately does **not** accept the current one-server/all-browser CI topology or claim a clean combined native run. Its high release-execution finding requires the authorized workflow shard and a clean exact-SHA CI run; this is an external gate, not a source rejection. Its low findings are that the transient loading branch is source-inspected rather than pinned by a dedicated browser assertion, and that later Playwright runs cleaned the failed trace archive even though the JSON failure, observed 409 details, route's unique 409 branch, overlapping Chromium timing, and all isolated passes strongly corroborate the same-server busy-guard diagnosis.

Any workflow implementation changes the frozen digest and requires a new freeze and appropriate review. The manager owns that release step.

No commit, push, workflow edit, CI dispatch, merge, deployment, public-source change, paid/live provider call, or interaction with preview port 3059 occurred in this attempt.
