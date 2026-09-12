# Shared capability adoption — attempt 4

Final verdict: **NOT ACCEPTED, 8.94/10**, fresh critic `capability_adoption_critic_4`. Correctness 9.1, simplicity 9.0, usability 8.7, safety 9.2, evidence 8.3; weights 30/20/20/20/10. High confidence in bounded source/results, unresolved root cause below. C1–C4 PASS; C5 FAIL. Same bounded C1–C5 criteria as attempt 1; no complete phase acceptance. Attempts 1–3 remain separate retained failures.

## Exact candidate

Branch `feature/simplified-flow`, base HEAD `abfa0fab2fb26c775f639358521d9a29c3a6b640`, 311-file digest `a780a90ad612bbbcbb49e78da34b4559a5b6a9c7889752ca13366c22a5c1e69a`. Root and credential-free `/private/tmp/cineserye-full-flow-3W6tpD` match. Manifest: `artifacts/simplified-flow/capability-adoption-attempt-4/source-manifest.json`.

Only `e2e/helpers.ts` differs from attempt 3: `openEditor` waits for DOMContentLoaded rather than the page load event. It still requires hydrated `main[data-ready]`, completes the chooser, asserts exactly three nodes/two edges, and waits for ordinary pointer actionability on the first node. All resize/undo/reload, lock and geometry assertions remain intact; no retries, timeouts or thresholds changed. Application/build/unit sources are unchanged from attempt 3.

Attempt 3 completed **552 total / 547 passed / 1 failed / 4 baseline skips / 0 interrupted or not run / 0 flaky** (11.8m). The sole Firefox failure occurred inside initial `page.goto`, waiting for `load`, before any resize gesture. Trace shows rendered editor and 200 responses for page/assets/discovery. The missing Firefox load event is unexplained, not claimed fixed. This helper's acceptance contract is a hydrated usable editor, not all-resource load completion. Failure report, screenshot and trace remain under attempt 3's artifacts.

## Verification

`npm run test:built:node -- --grep 'resized layer dimensions|locked layers reject canvas editing|sparkle restores outlier' --repeat-each=3 --max-failures=3`: **27/27 passes**. Typecheck/lint passed. Attempt 3 build/client-boundary and 532 offline passes / 5 intentional paid/live skips apply to byte-identical application/unit/build sources.

Complete native run: **552 total / 547 passed / 1 failed / 4 baseline skips / 0 interrupted, not run, retried or flaky**, 12.0m. `artifacts/simplified-flow/capability-adoption-attempt-4/full-native-failed.json`, trace/screenshot under `full-native-failures/`. Safe source remained at the exact digest above; newer root scoped-dispatch edits were not part of this run or review.

Failure: Chromium's outlier Scene layout test failed before geometry assertions. The fourth Add next scene click retried unstable position three times, then logged a completed real click. Scene 05 never appeared; Finish editing remained absent. No console/page error was seen. This is a failure to observe creation, not proven to be a stale selector. Root cause remains unproven; inspect moving-actionbar pointer activation and creation handling. Do not relax geometry assertions or skip editor dismissal to hide it.

Critic insight: one discovery identity now governs displayed availability and pending dispatch admission; keep document/operation identity separate. Nonblocking copy issue remains: WorkspaceStatus's error header says Checking this workspace while the body reports unknown. These findings do not change the failed mandatory regression verdict.

## Boundaries

No complete P1 or P0–P7 acceptance. All 58 criteria remain tracked separately. Remaining scoped-shot final-digest source/cancellation race, complete document/operation ownership, feature-panel reasons, export/restore/walkthrough evidence, Worker concurrency, exact-SHA Actions/$0 controls and actual user approval remain open. No paid requests, remote writes, CI dispatch, merge or deployment. Existing 3040 preview is unchanged.
