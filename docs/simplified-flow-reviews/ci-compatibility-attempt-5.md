# CI compatibility repair — attempt 5

Status: **ACCEPTED BY FRESH CRITIC FOR THE SIX-FAMILY BOUNDED REPAIR**, 9.26/10 with 0.98 confidence, at digest `d3ea4375…`. Complete native, Final Cut, Worker, CI, and release acceptance remain open.

## Candidate and amendment

The base remains `be3f07656bbf984c4c932fb3faefa706961dd2ad`. The 429-input candidate digest is `d3ea43758014870e7b34b82783ad02d3adee54dcd657c94f8af03ddbcf3f3da0`, SHA-256 of `artifacts/simplified-flow/ci-compatibility-attempt-5/source-manifest.txt`. All 429 inputs match the credential-free snapshot `/private/tmp/cineserye-ci-compat5-GcrvD1`.

Exactly the same seven tracked app/test files differ from the base as in attempt 4. Relative to attempt 4 digest `e7f6192720c9fc4b80e1ac40edd4a382b78a0467f44e5330a8e0a05dce32111d`, only `e2e/visual-preproduction.spec.ts` changed. It now resolves a fulfillment-complete promise in `finally` after the first held response's `route.fulfill` attempt. The test awaits this promise before the existing cancellation notice and zero-frame assertions and before issuing the explicit retry. The retry remains native, with exactly two POSTs and exactly three retry frames required. All other six files and all product behavior, thresholds, retries, and historical skip conditions remain unchanged.

This amendment addresses the manager evidence critic's medium finding. Its 8.7/10 conditional verdict and the earlier 9.18/10 bounded attempt 4 verdict both remain recorded; neither is substituted for fresh review of this digest. The manager also requested canonical runtime position proof and direct hit testing of the compact header/close target.

## Canonical position diagnostic

The temporary `e2e/approved-diagnostic.spec.ts` is preserved at `artifacts/simplified-flow/ci-compatibility-attempt-5/approved-diagnostic.spec.ts`; it is outside the 429 inputs and outside the root production test directory. It retains all assertions from the original scoped-shot case and adds read-only IndexedDB `cineserye-local` / `documents` / `current` observations and exact position comparisons. It does not inject app hooks, inspect private React state, or modify storage.

Command: `npm run test:built:node -- --project=firefox --workers=1 e2e/approved-diagnostic.spec.ts`. One fixture server, one browser project, one worker, zero retries; dynamic localhost port 50244. The two diagnostic cases passed.

All four original hosts preserved these saved positions before acceptance, after saved acceptance and DOM convergence, and after accepted saved reload:

| Original host | Position | Exact DOM transform |
| --- | --- | --- |
| Story premise | x=130, y=210 | `translate(130px, 210px)` |
| Proposal 1 | x=1190, y=210 | `translate(1190px, 210px)` |
| Proposal 2 | x=1190, y=414 | `translate(1190px, 414px)` |
| Proposal 3 | x=1190, y=618 | `translate(1190px, 618px)` |

The retained JSON includes exact generated IDs. Canonical node count grew from 4 to 40 and three accepted scene IDs persisted. The plan-scenes POST count remained exactly one through both reloads. The immediate-after-click sample happened to observe the saved 40-node document too, but it is an opportunistic IndexedDB sample, not an in-memory measurement or a required save barrier. The explicit saved and reloaded observations are the canonical persistence proof. No host movement appeared in this run; it does not reproduce or explain the original transient CI DOM mismatch by itself.

The Firefox run's stdout, JSON report with the five full probe attachments, test outputs, and server log were copied to `artifacts/simplified-flow/ci-compatibility-attempt-5/diagnostic-firefox/` immediately after completion.

## Compact target diagnostic

At viewport 735×389, all three engines measured a canvas scale of 0.795455. The close control's computed width/height/min-height were 30 CSS pixels. Its transformed viewport bounds measured 23.8636×23.8636 pixels in Chromium/WebKit and 23.8667×23.8667 in Firefox. Header height measured 24.6591 pixels in Chromium/WebKit and 24.6667 in Firefox. These are viewport CSS pixel measurements from `getBoundingClientRect`; the diagnostic JSON names this field `physical`, but it is not a device-pixel measurement. Chromium/Firefox had device pixel ratio 1; WebKit had device pixel ratio 2.

In all three engines, all five interior sample points (center and four 20%/80% points) hit the close button or its descendants. An ordinary header click retained the Assistant; an ordinary close click hid it; the existing focus control reopened it without a POST.

This is evidence of pointer access, not a claim that the rendered target meets a 24px, 44px, or touch-target standard. The small target remains a low limitation. No product resize or assertion threshold adjustment was made.

Chromium and WebKit each passed their one-case direct target diagnostic with one server and one worker. Together with the Firefox canonical and target cases, diagnostics total four passes, zero failures/skips/flakes. Exact observations are retained in `artifacts/simplified-flow/ci-compatibility-attempt-5/probes.json` and in each diagnostic run's stdout/report.

## Validation topology and retention

Typecheck, ESLint, and a fresh production build passed on the amended snapshot. Build emitted the existing chunk-size advisory. The prior 679-pass offline unit suite belongs to attempt 4; it was not rerun for this test-only amendment.

The six original family cases are selected by exact titles and files in `artifacts/simplified-flow/ci-compatibility-attempt-5/run-stability.mjs`. Each browser was invoked twice, sequentially. Every invocation started its own fixture server, used only one browser project with the existing three workers, and had retries disabled. Completion timestamps confirm that each invocation completed before the next began. Historical 500-node stress skips remain for Firefox/WebKit. The amended storyboard cancellation case passed in each of these six invocations.

| Browser | First pass | Second pass | Fixture ports |
| --- | --- | --- | --- |
| Chromium | 6 passed | 6 passed | 50323, 50367 |
| Firefox | 5 passed, 1 historical skip | 5 passed, 1 historical skip | 50417, 50460 |
| WebKit | 5 passed, 1 historical skip | 5 passed, 1 historical skip | 50502, 50548 |

The stability matrix totals 36 executions: **32 passed, 4 historical skips, 0 failed, 0 flaky, 0 interrupted, 0 not-run**. These are two requested fresh stability passes per browser, not Playwright retries. Each test result records retry 0. `artifacts/simplified-flow/ci-compatibility-attempt-5/summary.json` contains the per-run counts, worker/project identity, ports, and timestamps, derived from the retained reports and checked for overlap.

`run-retained.mjs` streams stdout directly to an explicit root artifact file, then copies the completed report and test results and writes command/time/exit metadata before another invocation starts. The script stops on any nonzero test exit. All existing artifacts and videos remain preserved.

After all checks, the freeze was reverified: 429/429 inputs still match root and snapshot, digest unchanged. `git diff --check` passes. No test server, Playwright runner, or ffmpeg process remained; the manager's existing caffeinate process was left running.

## Limits and prior interruption

The earlier full 621-case attempt used one server for all three browser projects with three workers. It was interrupted around case 348 with no completed runner verdict. Its old snapshot and partial reports/traces were unavailable afterward; their disappearance has no verified cause. Partial broad test names are unclassified runner observations, not independently reproduced product findings. Final Cut observations are tainted by the shared renderer's busy guard; absent the lost trace, a specific HTTP 409 cause is unproven.

Only Chromium premise-compact was independently reproduced before repair in the baseline focused matrix. The other original cases rely on the completed exact-SHA CI record. Source and unit evidence for canonical host preservation preceded this attempt; the successful saved-position diagnostic adds direct browser persistence evidence without reclassifying lost observations.

No full 621-case rerun, Final Cut run, Worker check, commit, push, workflow edit, CI dispatch, merge, deployment, paid/live provider request, or interaction with port 3059 occurred in this attempt. Final Cut two passes per browser and later release gates remain manager-owned work.

## Fresh review

The fresh critic `/root/attempt5_evidence_critic` **accepted the six-family bounded repair at the full digest above**, scoring **9.26/10** with **0.98 confidence**. It found no blocker, high, or medium issue.

The critic independently confirmed all 429 inputs against root and snapshot; the seven-file base diff and one-file amendment from attempt 4; the fulfillment barrier closing the manager's medium finding with cancellation/zero-frame/two-POST/three-frame assertions retained; all six raw stability reports and nonoverlapping invocation metadata; all four diagnostics; static/build/diff checks; and the retained verdict/interruption history.

Three low observations remain: the close target measures about 23.86 transformed viewport CSS pixels, compact body headroom over the retained 100px assertion is modest, and the viewport helper proves a short quiet interval while permitting null inline style samples. The successful ordinary-pointer probes and unchanged product assertions support bounded acceptance; they do not remove those limitations.

This verdict does not cover full native, Final Cut, Worker, CI, or release acceptance. The exact final critic response is preserved in `artifacts/simplified-flow/ci-compatibility-attempt-5/final-critic.md`.
