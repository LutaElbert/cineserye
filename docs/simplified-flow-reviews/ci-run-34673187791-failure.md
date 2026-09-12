# Exact-head CI failure — run 34673187791

Head: `be3f07656bbf984c4c932fb3faefa706961dd2ad`. Run: https://github.com/LutaElbert/cineserye/actions/runs/34673187791. Final conclusion: **FAILURE**, not cancelled. Native selection finished with 621 cases: 608 passed, 9 failed, 4 historical non-Chromium stress skips; no interrupted, not-run or flaky cases. Static/security and GitGuardian passed. Worker was skipped after native failure; final `verify` failed as designed. Per-browser Final Cut assertion steps did not execute because their preceding full suite steps failed; do not claim six asserted renderer passes.

| Browser | Passed | Failed | Historical skips | Test duration |
| --- | ---: | ---: | ---: | --- |
| Chromium | 204 | 3 | 0 | 11.4 minutes |
| Firefox | 201 | 4 | 2 | 13.8 minutes |
| WebKit | 203 | 2 | 2 | 21.1 minutes |

## Six failure families requiring diagnosis

1. `assistant-short-height.spec.ts:64`, all three browsers: required 100 physical pixels of useful stage body, measured approximately 92.87. Previous 124-CSS-pixel minimum did not resolve this exact Linux run. Investigate visible clipping/footer/transform geometry, not only nominal minimum height.
2. `premise-compact.spec.ts:69`, Chromium: after reload and premise double-click, `Focus story editor` not found before the 60-second test deadline.
3. `story-assistant-stress.spec.ts:42`, Chromium: saved/reloaded 500-node document did not show `Ready to shape your scenes` within the existing 5-second expectation.
4. `scoped-shot-assistant.spec.ts:49`, Firefox: existing host transform changed from `translate(809px, 954px)` to `translate(1190px, 210px)` after planning/reload/acceptance. Determine canonical-position mutation versus observation/measurement timing; preserve the position invariant.
5. `story-assistant.spec.ts:201`, Firefox: cancellation scenario observed one request instead of two. Inspect whether Stop occurred during preparation before the second request reached the handler. If test synchronization is deficient, explicitly enter/hold the request while preserving cancellation and late-output protection assertions.
6. `visual-preproduction.spec.ts:150`, Firefox and WebKit: Cancel became detached before the click completed; Firefox also reported root HTML interception. Determine whether fast fixture completion and layout animation race the intended pending-operation scenario. Do not force-click or remove assertions.

Completed GitHub check annotations and logs are the remote evidence. Checks: Chromium `103498706155`, Firefox `103498706161`, WebKit `103498706169`, static `103498296222`, final verify `103501394184`, skipped Worker `103501394467`.

The user authorized fixing CI issues after reviewing this failure. Existing implementation worker was resumed for bounded app/test repairs and fresh critic review; the manager owns CI/release changes. No unchanged rerun, weakened test thresholds, new skips/retries, merge, deployment or paid provider call is authorized. Account Actions controls were freshly rechecked shortly before this request: $0 budget, Stop usage Yes, reported $0 spent. Preserve this failed result even if later candidates pass.
