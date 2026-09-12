# P7 final traceability matrix

Candidate implementation digest: `38eedca6efa36f575572269f5c5f8b05d9606016333150913f51dc4bab60ac38` across 429 inputs. Focused visual-alignment outcomes are in `visual-alignment-attempt-6.md`; accepted attempt 3 and its complete Node/Worker evidence remain the historical baseline in `P7-integrated-attempt-3.md`, with the detailed unchanged execution table in attempt 2. Browser references below are exact test IDs inside the credential-free `npm run test:built:node` report `artifacts/simplified-flow/final/node-fixture-full.json`, or the distinct `npm run test:built:worker` report `artifacts/simplified-flow/final/worker-full.json`; attempt 6 adds 48/48 focused built Node browser checks, 36/36 visual/interaction checks and 19 PNGs. Unit references are exact files/cases inside `npm test`. `VERIFIED` is local-candidate evidence only; where explicitly named, it includes delegated agent product judgment and does not imply Elbert personally performed the review.

| ID | Exact candidate command / test ID / artifact | Verdict |
| --- | --- | --- |
| P0.1 | Node report: `e2e/layer-behavior.spec.ts:553`, `:570`, `:614`; `e2e/manual-creation-recovery.spec.ts:34` | VERIFIED |
| P0.2 | Node report: `e2e/layer-behavior.spec.ts:189`, `:413`, `:721` | VERIFIED |
| P0.3 | Node report: `e2e/layer-editor.spec.ts:5`, `:44`, `:75`; focused source 20-pair and Worker 40-test reruns in integrated packet | VERIFIED |
| P0.4 | `artifacts/simplified-flow/final/p0-focused-three-runs.json`: `layer-behavior.spec.ts`, `layer-editor.spec.ts`, `manual-creation-recovery.spec.ts` × Chromium/Firefox/WebKit × 3 consecutive repeats = 72 expected/72 passed, 0 skipped/unexpected/flaky; retries `0` | VERIFIED |
| P0.5 | `npm run test:built:node`; `npm run test:built:worker`; both final JSON reports; `.github/workflows/ci.yml`; `scripts/test-built.mjs` | VERIFIED |
| P0.6 | `npm audit --audit-level=high`; `P0-dependency-audit.md` | VERIFIED |
| P0.7 | `npm run check`; `npm run typecheck`; `npm run lint`; `npm run check:client-boundary`; `npm test`; `npm run build`; high audit; both built commands | VERIFIED |
| P0.8 | `npm run check:test-environment`; `node scripts/assert-renderer-report.mjs artifacts/simplified-flow/final/node-fixture-full.json 3` outputs expected=3/executed=3/passed=3; `.github/workflows/ci.yml` invokes the assertion, but no authorized exact-SHA CI execution exists | PENDING EXTERNAL |
| P0.9 | `P0-preservation-inventory.md` final per-entry index; baseline/candidate measurement docs and five raw JSON logs | VERIFIED |
| P1.1 | `npm test`; `app/server/cinema/workflow-capabilities.test.ts`; Node report `e2e/media-workspace-capabilities.spec.ts` | VERIFIED |
| P1.2 | Same unit file; Node report `e2e/media-workspace-capabilities.spec.ts`, exact disabled/missing/unsupported/fixture/preflight cases | VERIFIED |
| P1.3 | `npm test`; `workflow-capabilities.test.ts` evidence identity/expiry cases; Node report `e2e/capability-dispatch.spec.ts:99` | VERIFIED |
| P1.4 | Node report `e2e/capability-dispatch.spec.ts:48`, `:76`; `e2e/story-development.spec.ts:231`, `:276` | VERIFIED |
| P1.5 | Node report `e2e/simplified-flow.spec.ts:271`; `e2e/media-workspace-capabilities.spec.ts`; shared labels in `app/server/cinema/workflow-capabilities.test.ts` | VERIFIED |
| P1.6 | Node report `e2e/simplified-flow.spec.ts:257`; `e2e/story-development.spec.ts:58`; workflow-capability malformed/offline units | VERIFIED |
| P1.7 | Node report `e2e/story-workflow-safety.spec.ts:6`; `e2e/story-development.spec.ts:327`; `e2e/capability-dispatch.spec.ts:76` | VERIFIED |
| P2.1 | `npm test`; `app/editor/document-controller.test.ts`, `document-history.test.ts`, `document-save-queue.test.ts`; Node report `e2e/document-controller.spec.ts:5` | VERIFIED |
| P2.2 | `npm test`; controller/history fingerprint cases; Node report `e2e/simplified-flow.spec.ts:130` | VERIFIED |
| P2.3 | Node report `e2e/story-data-foundation.spec.ts:12`; `e2e/document-replacement.spec.ts:13`; persistence/checkpoint/revision units | VERIFIED |
| P2.4 | Node report `e2e/document-controller.spec.ts:5`; `e2e/document-replacement.spec.ts:13`, `:34`, `:57`, `:81`; save-queue units | VERIFIED |
| P2.5 | Node report `e2e/story-data-foundation.spec.ts:56`; `e2e/story-development.spec.ts:380` | VERIFIED |
| P2.6 | `npm test`; exact controller/history/save-queue files; Node report retained editor and persistence cases | VERIFIED |
| P2.7 | Node report `e2e/final-cut-export.spec.ts:10`; `e2e/visual-preproduction.spec.ts:109`; `app/editor/story-workflow-persistence.test.ts` | VERIFIED |
| P2.8 | Node report `e2e/story-workflow-safety.spec.ts:49`, `:84`; media-reachability/lease units in `npm test` | VERIFIED |
| P3.1 | Node report `e2e/simplified-flow.spec.ts:44`, `:178` (exactly three top-level buttons Story/Shots/Edit); visual captures `01-idea.png`, `06-empty-idea.png`, `07-blocked-references.png`, `08-partial-video.png` | VERIFIED |
| P3.2 | Node report `e2e/simplified-flow.spec.ts:87`, `:130`; `app/features/simplified-flow/stage-projection.test.ts` | VERIFIED |
| P3.3 | Node report `e2e/scoped-shot-assistant.spec.ts:3`, `e2e/final-cut-export.spec.ts:10`; candidate measurement task 01/05 JSON | VERIFIED |
| P3.4 | Node report `e2e/story-workflow-safety.spec.ts:34`; `e2e/story-revision-history.spec.ts:51`; `e2e/layer-editor.spec.ts:75`, `:94` | VERIFIED |
| P3.5 | Node report `e2e/simplified-flow.spec.ts:44`, `:178`; `e2e/accessibility.spec.ts:5`, `:15`, `:111`, `:126` across three engines | VERIFIED |
| P3.6 | Nineteen PNGs under `artifacts/simplified-flow/visual-direction-attempt-6/`; fresh critic 12 directly reviewed/interacted at 786×559, 877×559 and 390×844 and accepted at 9.20/10. Delegated-agent acceptance; not an Elbert-personal-review claim | VERIFIED |
| P3.7 | Node report `e2e/story-revision-history.spec.ts:51`; `e2e/story-development.spec.ts:388`, `:404`; `e2e/assistant-compact-review.spec.ts:98` | VERIFIED |
| P3.8 | Node report `e2e/story-revision-history.spec.ts:115`, `:134`; `e2e/story-development.spec.ts:165`, `:549` | VERIFIED |
| P3.9 | `artifacts/simplified-flow/final/candidate-measurements-built.json`: 5 expected/5 passed; attempt-6 automated and fresh-critic walkthrough covered all proposal summaries, partial acceptance/consent, shot approval and short-clip recovery. Delegated-agent walkthrough; not an Elbert-performed walkthrough | VERIFIED |
| P4.1 | `npm test`; `app/features/simplified-flow/operation-journal.test.ts`, `app/features/video/video-operation-state.test.ts` | VERIFIED |
| P4.2 | `npm test`; `app/server/cinema/video-observation-race.test.ts`; Node report video polling/hook cases | VERIFIED |
| P4.3 | `npm test`; `app/features/video/video-operation-state.test.ts`, `recover-video-clip.test.ts`; Node report `e2e/video-preproduction.spec.ts:52` | VERIFIED |
| P4.4 | Node report `e2e/story-development.spec.ts:460`, `:501`; video retry/double-click/reload/freshness units | VERIFIED |
| P4.5 | `app/features/simplified-flow/operation-journal.test.ts:16` persists intent for a new reader and `:55` reconciles restored work without dispatch; `ProjectOperationSummary.tsx:24-26` exposes saved status/recovery and labels opening as non-generative; Node `e2e/story-development.spec.ts:460`, `:501` proves GET-only recovery and no redispatch | VERIFIED |
| P4.6 | `npm test`; `app/server/cinema/video-outcome.test.ts`, `video-retention-safety.test.ts`; retained recovery Node report cases | VERIFIED |
| P5.1 | Node report `e2e/visual-preproduction.spec.ts:38`, `:58`, `:109`; reference bridge/version/permission units | VERIFIED |
| P5.2 | Node report `e2e/video-preproduction.spec.ts:42`; `e2e/story-workflow-safety.spec.ts:6`; video preflight/consent units | VERIFIED |
| P5.3 | Node report `e2e/video-preproduction.spec.ts:23`; `e2e/retained-clip-recovery.spec.ts:4`; video response/recovery units | VERIFIED |
| P5.4 | `npm test`; `app/features/assembly/sequence-manifest.test.ts`; Node report `e2e/final-cut-export.spec.ts:10` | VERIFIED |
| P5.5 | Node report `e2e/final-cut-export.spec.ts:10` across Chromium/Firefox/WebKit; Worker report assembly block; full downloaded MP4 decode assertion | VERIFIED |
| P5.6 | Node report `e2e/final-cut-export.spec.ts:10`; export invalidation and empty-store units | VERIFIED |
| P5.7 | Node report `e2e/story-development.spec.ts:442`; `e2e/visual-preproduction.spec.ts:38`, `:158`; reference manifest/permission units | VERIFIED |
| P6.1 | `P0-preservation-inventory.md` 27-entry exact final index; Node report professional/export/legacy restore cases | VERIFIED |
| P6.2 | Node report `e2e/simplified-flow.spec.ts:233`; capability/consent/recovery tests above | VERIFIED |
| P6.3 | `npm test`; shared local-request validator and route origin/host/proxy/type negatives; Worker report route guards | VERIFIED |
| P6.4 | `npm run test:built:node`; complete Node report; `e2e/simplified-flow.spec.ts:130` listener/poll/request/warning assertions | VERIFIED |
| P6.5 | `npm test`; import/media/response/export negative suites; Node report `e2e/editor.spec.ts:109`, `e2e/visual-preproduction.spec.ts:158`, `e2e/media-response-safety.spec.ts` | VERIFIED |
| P6.6 | Node report `e2e/story-assistant-stress.spec.ts:5`, `e2e/stress.spec.ts:71` (Chromium-only historical scope); `app/editor/cinema-hierarchy.test.ts` unchanged budget | VERIFIED |
| P7.1 | Local exact digest/matrices exist, but no authorized candidate commit/SHA | PENDING USER |
| P7.2 | Complete Node report: new/restored/partial/blocked/save/two-tab/interruption/retry; `e2e/final-cut-export.spec.ts:10` decoded download | VERIFIED |
| P7.3 | `.github/workflows/ci.yml` defines gates; no authorized exact-SHA Actions run or fresh $0/Stop verification | PENDING EXTERNAL |
| P7.4 | Local tests/high audit green; `visual-alignment-attempt-6.md` records fresh critic 12's 9.20/10 acceptance and delegated P3.6/P3.9 closure; exact-SHA CI remains absent | PENDING EXTERNAL |
| P7.5 | `CINESERYE_HANDOFF.md`; commit SHA and CI links absent pending authority | PENDING USER |
| P7.6 | This 58-row matrix plus `P0-preservation-inventory.md` 27-entry final index; final reports for full Node, full Worker, focused repeat, renderer assertion, built measurements and visual capture; `git diff --check` | VERIFIED |

Explicitly excluded future capabilities remain in the plan's Coverage and explicit exclusions section; none is counted as an acceptance pass.
