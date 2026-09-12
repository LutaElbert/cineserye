# P7 integrated repaired candidate — attempt 2

Status: **NOT ACCEPTED — SUPERSEDED BY DOCUMENTATION-ONLY ATTEMPT 3**.

Frozen September 11, 2026 from base `abfa0fab2fb26c775f639358521d9a29c3a6b640`. The implementation digest is `9344602b414cacbe9d3eba8356bc3de7e693a81e42ef93bebeb7ad2152f7f231` across 429 inputs. The digest is SHA-256 over the sorted `shasum -a 256` manifest of every tracked or untracked candidate file except generated `artifacts/`, `videos/`, mutable `CINESERYE_HANDOFF.md`, and reviewer-facing records under `docs/simplified-flow-reviews/`; canonical `docs/SIMPLIFIED_FLOW_IMPLEMENTATION_PLAN.md` remains included. The worktree and credential-free validation snapshot `/private/tmp/cineserye-recovery5-3vGppB` produce identical manifests and digests.

This packet does not authorize a commit, remote write, CI dispatch, provider call, deployment, merge, or public-submission change.

## Exact repaired-candidate verdict

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
| `npm run test:built:node` | 618 total; 614 passed; 4 documented historical Firefox/WebKit skips for the two Chromium-only large-canvas stress cases; 0 failed, flaky, interrupted or not run. Retries disabled; three workers. |
| Native renderer report assertion | `expected=3, executed=3, passed=3, failed=0, skipped=0` for `final-cut-export.spec.ts`. |
| `npm run test:built:worker` | 129 total; 129 passed; 0 failed, skipped, flaky, interrupted or not run. Retries disabled; one Worker-isolate-safe worker. |
| P0 focused final-digest repetition | Three consecutive repetitions of 8 cases × Chromium/Firefox/WebKit: 72 expected, 72 passed, 0 skipped/unexpected/flaky. |
| Fixed candidate measurements | 5 expected, 5 passed on one credential-free built Node production runtime; 0 skipped/unexpected/flaky. |
| Refreshed visual capture | 4 expected, 4 passed on the built Node artifact; eight final PNG states produced. |
| `git diff --check` | Passed after the evidence-only freeze. |

Durable raw reports are:

- `artifacts/simplified-flow/final/node-fixture-full.json`
- `artifacts/simplified-flow/final/worker-full.json`
- `artifacts/simplified-flow/final/p0-focused-three-runs.json`
- `artifacts/simplified-flow/final/candidate-measurements-built.json`
- `artifacts/simplified-flow/final/visual-captures.json`

All executions were credential-free fixtures. The built runner removes provider/cloud credential variables, disables live smoke switches and cloud telemetry, and identifies its runtime before browser execution. No paid or live provider endpoint was called.

## Attempt-1 finding dispositions

`simplified_flow_critic_6` permanently rejected attempt 1 at 8.5/10. This attempt addresses each finding:

- **Mutable packet:** attempt 1 remains rejected at its own digest. This new attempt has a new manifest, digest, packet and fresh critic.
- **Five peer tabs:** the application now exposes exactly three top-level filmmaking workspaces: Story, Shots and Edit. Their nested stages are Idea/Plan, References/Video and Final Cut. The exact three-button contract is asserted in the built three-engine suite.
- **P0.4 final-digest repetition:** the focused set passed 72/72 across all three engines and three consecutive repetitions with retries disabled.
- **P0.8 renderer overclaim:** `scripts/assert-renderer-report.mjs` counts exact renderer executions and asserts expected=executed=passed. Local proof is green and CI is configured to invoke it. The tracker now leaves P0.8 `PENDING EXTERNAL` until that workflow executes for an authorized exact SHA.
- **P3.9 mixed runtime:** all five final candidate tasks ran serially against one built Node production artifact. The earlier development HTTP 413 attempt is retained but excluded.
- **P7.6 traceability:** all 58 criteria have exact commands, test IDs or artifacts in `P7-traceability-matrix.md`; P4.5 now names the journal cases, summary implementation and GET-only/no-redispatch browser cases.

## Journey and visual evidence

The fixed candidate harness removes one navigation-only click and one panel change from task 1 (2→1 and 3→2). No task adds navigation, hides a required selection, exposes a competing primary action, or changes provider POST count. Task 5 completes fixture preview, local native assembly, full MP4 decode and download without a provider POST. `P3-candidate-task-measurements.md` records the comparison and the human limitation.

Eight refreshed screenshots cover Idea, Plan, References, Video, Final Cut, empty Idea, blocked References and partial Video under `artifacts/simplified-flow/visual-direction/`. These are review evidence, not Elbert's approval.

## Retained failed or invalid runs

- The first hierarchy-focused run failed 12 cases: nine history assertions included redundant same-stage clicks and three engines found 4.42:1 inactive-stage contrast. Navigation history and contrast were repaired; the exact corrected targeted run passed 42/42.
- The first post-hierarchy full Node run passed 613 and failed one Firefox `document-controller` load because `DOMContentLoaded` remained pending while the hydrated UI was already actionable. The runner now waits for committed navigation then asserts the real hydrated/actionable application boundary. The exact failed case passed 20/20 before the clean 614-runnable full matrix.
- A later full rerun was invalidated by a system turn interruption: the still-alive process starved three Chromium visual cases to 15 minutes. It was stopped and contributes no acceptance evidence.
- An earlier mixed-runtime task measurement hit development middleware HTTP 413 on the 18-clip assembly request. The final 5/5 report uses one production artifact for every task and supersedes it.
- Earlier Worker native-import, camera `NaN`, scoped ownership, quote freshness, undo/save, operation recovery, reference safety and video-lifecycle failures remain in their original attempt records. Only exact repaired-candidate reruns count here.

## Fresh critic verdict

`simplified_flow_critic_7` review: **NOT ACCEPTED**, weighted score **9.36/10**, confidence **0.97** (50 PASS, 1 FAIL, 7 NOT VERIFIED). Category scores were correctness/coverage 9.6, simplicity/maintainability 9.1, usability/accessibility 9.4, data/security/cost safety 9.7 and evidence/reproducibility 8.4.

The critic found no blocker, high product-safety finding or additional low finding. One medium evidence defect failed mandatory P7.6: the traceability matrix pointed P1.5 to `simplified-flow.spec.ts:33` rather than the exact test at `:271`, pointed P1.6 to `:243` rather than `:257`, and the preservation final-index introduction linked aggregate evidence to attempt 1 rather than the repaired packet. The critic independently confirmed that these were the only mismatches among 90 checked browser `file:line` references, that all attempt-1 product/evidence repairs otherwise held, and that the 429-input implementation digest remained stable in both locations throughout review.

This verdict is permanent. The three documentation defects are repaired only in attempt 3; no application, test, configuration or script input changed.

## Seven gates that remain open

At freeze, this packet claimed local evidence for 51 of 58 criteria. Critic 7 ultimately verified 50, failed P7.6 on the stale references recorded above, and left the same seven human/external gates open. The P7.6 documentation-only correction is evaluated in attempt 3.

- P0.8 (`PENDING EXTERNAL`): execute the configured renderer report assertion for an authorized exact candidate SHA in CI.
- P3.6 (`PENDING USER`): Elbert explicitly approves or rejects the eight-screen visual direction.
- P3.9 (`PENDING USER`): Elbert performs the actual five-stage walkthrough and identifies each next action or blocking reason.
- P7.1 (`PENDING USER`): with explicit authority, create one private exact-candidate commit and record its SHA.
- P7.3 (`PENDING EXTERNAL`): for that SHA, verify a fresh $0 GitHub Actions cap and Stop control, then run required CI only with explicit authority.
- P7.4 (`PENDING USER`): combine a passing fresh critic, user visual approval and exact-SHA CI.
- P7.5 (`PENDING USER`): record the private commit SHA, CI links, rollback boundary, screenshots and limitations in the final handoff.

Current limitations are deliberate and visible: fixture generation is not provider-readiness evidence; local assembly is a silent 720p/24fps MP4 limited to 24 clips/120 seconds; clips/cuts require separate downloads and are not embedded in portable project backups; Worker mode blocks native planning/assembly while preserving local project editing. No hosted-auth or live-provider claim is made.
