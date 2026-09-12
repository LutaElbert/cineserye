# Shared capability adoption — attempt 3

Final verdict: **NOT ACCEPTED, 8.96/10**, high confidence, fresh critic `capability_adoption_critic_3`. Correctness 9.2, simplicity 9.0, usability 8.8, safety 9.2, evidence 8.0 (30/20/20/20/10 weights). C1–C4 PASS for this bounded slice; C5 FAIL. Same C1–C5 scope as attempts 1/2. No full-phase acceptance. Attempt 1 NOT ACCEPTED, 8.02; attempt 2 NOT ACCEPTED, 8.91.

## Candidate change

Only two browser test files differ from attempt2. Application and unit-test code is unchanged.

- `e2e/layer-behavior.spec.ts`: after inspecting a locked scene, use the normal Fit View button before attempting the connector gesture. Previous WebKit trace shows the source handle under Properties. The locked editing/renaming assertions and unchanged edge-count assertion remain; no forced clicks or bypassed pointer hit tests.
- `e2e/manual-creation-recovery.spec.ts`: collect all three screen rectangles in one browser callback instead of three independently scheduled protocol calls during camera movement. All nodes must exist; the same <3px centering tolerance, 500px model row, narrative ordering, overlap, undo/redo and reload assertions remain. No timeout/threshold/fixture reduction.

All **18 repeated browser checks passed**, two cases × three engines × three repetitions, no retries/failures/skips/flakes: `artifacts/simplified-flow/capability-adoption-attempt-3/browser-18.json`. The earlier 153-check discovery/approval regression report remains in attempt 2; every source/test involved there is byte-identical, but full native is rerun for this candidate rather than inheriting a previous full green.

311-file digest `ffff870228ccae84e26f361c00b3da60990faa9da61cf0cb1f5f16764051bb65`; manifest under this attempt's artifacts. Root and credential-free `/private/tmp/cineserye-full-flow-3W6tpD` match. Build/typecheck/lint/boundary/full offline suite are rerunning before full native. Existing four Chromium-only stress skips remain unchanged. Keep all previous failures/traces.

Fresh build, typecheck, lint and client-boundary passed. Full offline suite **532 passed / 5 intentional paid/live skips / 0 failed**, `units.json`. Complete native: **552 total / 547 passed / 1 failed / 4 baseline skips / 0 interrupted or not run / 0 flaky**, 11.8m, `full-native-failed.json`. The sole Firefox failure in resize/undo/reload was an initial `page.goto` load-event timeout, before resize began; trace/screenshot show a rendered editor and 200 responses. This does not establish a resize regression and is not waived. Failure artifacts are retained in `full-native-failures/`. Final root/safe source hashes remained identical to the frozen digest.

Critic insight: capability identity now connects displayed availability to admission through asynchronous preparation; route authorization remains independent. Existing Fit View/atomic geometry test repairs preserve behavioral requirements. For the next candidate, DOMContentLoaded plus all explicit hydrated-editor, graph-count and pointer checks is justified; it does not establish why Firefox's load event was missing. Minor later polish: neutral Local only styling distinguishes storage location from Review required.

## Boundaries

All 58 criteria, complete document/operation ownership, remaining scoped-shot final-digest source/cancellation race, full feature-panel reason adoption, export/restore/walkthrough measurements, Worker concurrency, exact-SHA Actions/$0 and actual user approval remain open. Do not claim complete P1 or complete dispatch safety. No paid call, remote write, CI dispatch, merge or deployment. Existing 3040 preview unchanged.
