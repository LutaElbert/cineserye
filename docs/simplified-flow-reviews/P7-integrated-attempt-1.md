# P7 integrated candidate — attempt 1

Status: **NOT ACCEPTED — SUPERSEDED BY A REPAIRED CANDIDATE**.

Frozen September 11, 2026 from base `abfa0fab2fb26c775f639358521d9a29c3a6b640`. The implementation digest is `75e679fbadebc85c79daf6771b4cf2797b16a4bd00e7fbf4be709c701fc17aec` across 428 inputs. Its scope is every tracked or untracked candidate file except generated `artifacts/`, `videos/`, mutable `CINESERYE_HANDOFF.md`, and reviewer-facing records under `docs/simplified-flow-reviews/`; the canonical `docs/SIMPLIFIED_FLOW_IMPLEMENTATION_PLAN.md` remains included. The worktree and credential-free validation snapshot `/private/tmp/cineserye-recovery5-3vGppB` are byte-identical for that scope.

This packet does not authorize a commit, remote write, CI dispatch, provider call, deployment, merge, or public-submission change.

## Exact local verdict

| Gate | Result |
| --- | --- |
| `npm run check` | Passed, compatibility 100%. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed. |
| `npm run check:client-boundary` | Passed. |
| `npm test` | 103 files passed / 4 live-only files skipped; 677 tests passed / 5 intentional paid/live skips. |
| `npm run build` | Passed. |
| `npm audit --audit-level=high` | Exit 0; 0 high/critical and 14 documented moderate affected entries. |
| `npm run check:test-environment` | Passed: Node 22.23.2, npm 10.9.8, ffmpeg/ffprobe 8.1.2, lock hash `3346da40af4bbddd85b7400b09780c1d9f013a332bee90da18d07e96e0968fdf`, Playwright 1.62.1, Chromium 151, Firefox 153, WebKit 26.5. |
| `npm run test:built:node` | 618 total; 614 passed; 4 documented historical Chromium-only stress skips on Firefox/WebKit; 0 failed, flaky, interrupted, or not run. Retries disabled; three workers. |
| `npm run test:built:worker` | 129 total; 129 passed; 0 failed, skipped, flaky, interrupted, or not run. Retries disabled; one Worker-isolate-safe worker. |
| Focused Story reload regression | Source fixture 20/20 pairs and built Worker 40/40 tests passed. |
| `git diff --check` | Passed after the evidence-only freeze. |

All local runs were credential-free fixtures. The runner removes provider/cloud credential variables, disables live smoke switches and cloud telemetry, and identifies the runtime before browser execution. The Node matrix exercises the production native artifact. The Worker matrix proves unsupported native work is guarded before lazy imports and keeps local editing available.

## Journey and visual evidence

The fixed five-task candidate harness passed 5/5 with retries disabled. Task 1 removes one navigation-only click and one panel change (2→1 and 3→2); no task adds a navigation step, hides a required selection, exposes competing primary actions, or changes provider POST count. The local-cut task completes fixture preview, local native assembly, full MP4 decode and download without a provider POST. Raw results are under `artifacts/simplified-flow/candidate-task-measurements/`; the comparison is in `P3-candidate-task-measurements.md`. Durable final matrix reports are `artifacts/simplified-flow/final/node-fixture-full.json` and `artifacts/simplified-flow/final/worker-full.json`.

Eight current screenshots cover Idea, Plan, References, Video, Final Cut, empty Idea, blocked References, and partial Video under `artifacts/simplified-flow/visual-direction/`. They are evidence for review, not a substitute for Elbert's explicit visual approval or actual walkthrough.

## Retained failure evidence and closure

- Early Worker runs crashed when planning/assembly routes imported native modules before checking runtime capability. Both routes now guard first and lazy-import native dependencies; the exact built Worker matrix is 129/129.
- The first built Worker Story reload repetition missed a double-click while the ReactFlow fit animation moved the card. The regression now waits for the card's stable hover target without weakening the editor assertions; 40/40 exact built Worker tests passed.
- The first complete native run passed 613 tests and hit one Firefox page-load-event timeout although the ready UI was present. The measurement navigation now waits for `domcontentloaded`, matching the application's readiness signal. That exact test passed 20/20 in parallel Firefox, then the complete native matrix passed 614/614 runnable tests.
- Running the 18-clip synthetic assembly measurement against development middleware returned HTTP 413 before the application route. The candidate production artifact has the intended multipart limit and completed the same full-decode/download task in 6.5 seconds. Final task-5 evidence therefore comes from the built Node artifact; this is recorded rather than treating the development server as production-equivalent.
- Earlier Worker native-import, camera `NaN`, scoped shot ownership, quote freshness, undo/save, operation recovery, reference safety, and video lifecycle failures remain documented in their attempt packets. Only exact repaired-candidate reruns count here.

## Fresh critic verdict

`simplified_flow_critic_6` review: **NOT ACCEPTED**, score **8.5/10**, confidence **0.94** (48 PASS, 1 FAIL, 9 NOT VERIFIED).

The review identified one process blocker and four evidence/product gaps:

- the packet changed during review, so its digest no longer identified the reviewed candidate;
- the UI exposed five peer top-level tabs rather than the revision-3 Story / Shots / Edit workspace contract;
- P0.4 lacked a final-digest, three-consecutive-run, cross-engine focused proof;
- P0.8 asserted renderer execution without an expected-versus-executed report assertion or exact-SHA CI result;
- P3.9 mixed source-development tasks 1–4 with a built-production task 5, and P7.6 initially lacked sufficiently exact traceability for some claims.

This verdict is permanent historical evidence. The implementation was subsequently repaired; those changes are not part of this attempt or its digest. They are evaluated only in `P7-integrated-attempt-2.md` by a different fresh critic.

## Gates that remain open

The attempted packet did not establish an accepted local candidate. In addition to its critic findings, full revision-3 acceptance still required these external or human gates:

- P3.6: Elbert explicitly approves or rejects the eight-screen visual direction.
- P3.9: Elbert performs the actual five-stage walkthrough and identifies each next action or blocking reason.
- P7.1: with explicit authorization, create a private exact-candidate commit and record its SHA.
- P7.3: for that exact SHA, verify a fresh $0 GitHub Actions cap and Stop control, then run required CI only with explicit authorization.
- P7.4: combine a passing fresh critic with user visual approval and exact-SHA CI.
- P7.5: record the private commit SHA, CI links, rollback boundary, screenshots and limitations in the final handoff.

Current limitations are deliberate and visible: fixture generation is not a provider-readiness claim; local assembly is a silent 720p/24fps MP4 limited to 24 clips/120 seconds; clips/cuts need separate downloads and are not embedded in portable project backups; Worker mode blocks native planning/assembly while preserving local project editing. No live provider behavior or hosted-auth boundary was tested.
