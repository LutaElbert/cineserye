# Native toolbar activation during framing — attempt 1

Verdict: **PASS A1–A5, 9.35/10**, fresh independent critic `actionbar_activation_critic_1`. No blocking findings. This is a bounded manual-creation reliability repair, not full simplification acceptance.

## Criteria

- A1: A primary press on the scene actionbar retains its screen position during scheduled Outline camera framing; releasing inside activates once.
- A2: No action fires on pointerdown. Releasing outside cancels normally. Secondary pointer events do not release another active press; matching cancellation, window blur and unmount clean up the hold/listeners.
- A3: Creation remains one undoable step, redo and saved reload preserve the result. The original five-scene outlier-layout regression keeps all existing assertions.
- A4: Normal Outline selection schedules one framing operation with its existing intended padding/zoom; other selection framing remains intact. Keyboard, toolbar containment and lock behavior remain covered by the broader suite.
- A5: Focused units, typecheck/lint/client boundary/build, repeated three-engine browser cases and the complete native fixture suite pass on the same source digest, with exact counts and baseline skips recorded. No paid/provider calls, remote writes or CI dispatch.

## Candidate and diagnosis

Branch `feature/simplified-flow`, base HEAD `abfa0fab2fb26c775f639358521d9a29c3a6b640`. 313-file manifest at `artifacts/simplified-flow/actionbar-activation-attempt-1/source-manifest.json`, final digest `cd0bf80cc988310d4aaa8502de35fbb16021a0d807650cda8ef484566c37188f`. Root and credential-free `/private/tmp/cineserye-scoped-dispatch-7dEslE` match. Four files differ from scoped-dispatch attempt 1: `CanvasBoundActionbar.tsx`, its new test, `Editor.tsx`, and new `e2e/actionbar-motion.spec.ts`.

Earlier capability-attempt-4 native run failed when Add next scene did not create Scene 05. Natural rapid/delayed/raw-pointer/exact/throttled diagnostic repetitions did not reproduce that rare failure. A deterministic camera-frame gate then reproduced the mechanism: actual native pointerdown targeted the Add next scene BUTTON, but pointerup and click targeted a DIV after framing moved the toolbar. Scene 02 was absent. This matches the earlier lost-activation symptom, but its original trace did not contain pointer-target instrumentation, so the precise identity of those failures is not proven.

Evidence retained in `artifacts/simplified-flow/actionbar-diagnostics/`: natural repetition JSON reports; `motion-before.json` and `motion-before/` trace/screenshot; rejected `viewport-stop-insufficient.json`. Stopping only the current viewport transition failed because a queued fitView could begin afterward. The rejected approach was removed.

The current actionbar locally holds its screen position from primary pointerdown until the browser delivers pointerup/click, still constrained to the canvas. It neither captures the pointer nor invokes an action early. Camera/document state is not frozen or rewritten. Outline selection also no longer schedules duplicate competing fitView calls. Four lifecycle unit tests cover follow/release, pointer identity/cancel, blur/secondary touch, and cleanup. Native regressions use a camera RAF gate plus real mouse input, not synthetic/forced clicks; they exercise inside/outside release, no early mutation, undo/redo/reload.

## Verification

Four focused lifecycle unit tests, typecheck, lint and client-boundary pass. Initial screen-hold browser experiment: 12/12 passes (two cases × three engines × two repetitions), `held-bar-initial-12.json`; this predates the final pointer-identity refinement and is diagnostic evidence only. A first unit run exposed a test rectangle mock that omitted its CSS Y translation; correcting that mock fixed three failures without changing production logic or tolerances.

Initial candidate `53d4f5b268ea833e6d9e4d2f7aacb67636dd845de5625a01faeb9ee991c4b760`: 548 offline passed / 5 intentional paid/live skips, 54 repeated browsers passed with zero retries/skips/flakes (`browser-initial-54.json`). Fresh critic suggested explicitly proving the camera moved and exactly one scene was created. Both assertions were added to the browser test, changing only that test and the final digest; no production changes. Final-candidate checks rerun below before any acceptance.

Final candidate: typecheck, lint, client-boundary and fixture build pass. `final-units.json`: **548 passed / 5 intentional paid/live skips / 0 failed**. `browser-54.json`: **54/54 passed**, six cases × three engines × three repetitions, no retries/skips/flakes, 1.2 minutes. Command: `npm run test:built:node -- e2e/actionbar-motion.spec.ts e2e/manual-creation-recovery.spec.ts e2e/accessibility.spec.ts e2e/layer-behavior.spec.ts --grep 'toolbar press stays|sparkle restores outlier|supports keyboard entry|locked layers remain selectable|top-left resizing' --repeat-each=3 --max-failures=3`. Native environment and required ffmpeg/ffprobe versions retained in `environment.txt`. The complete native run below used no grep or maximum-failure cutoff.

Additional read-only checks: `npm run check` passed (static compatibility scanner, not Worker-runtime proof), output `compatibility-check.txt`. `npm audit --audit-level=high --json` exited 0, high/critical 0, 14 moderate entries remaining; `dependency-audit.json`. No dependency upgrade or gate change was made. The previously documented moderate-risk obligations remain open.

Complete final-candidate native suite: `npm run test:built:node`, **561 total / 557 passed / 4 baseline skips / 0 failed / 0 interrupted / 0 not run / 0 flaky / 0 retries**, 12.2 minutes. Report `full-native.json`. The four original skips are Firefox/WebKit exclusions of the two Chromium-only 500-node/layer, 800-edge stress cases; those Chromium cases executed and passed. The original manual-creation suite was not edited for this repair. All owned verification runners have stopped. Full native is green for this digest; Worker and CI remain separate, unpassed gates.

## Independent review

Fresh critic independently rehashed both 313-file copies and inspected all three final reports, baseline skip names, zero retries and the unchanged manual-creation regression. Scores: correctness **9.4**, simplicity **9.2**, usability **9.3**, safety **9.5**, evidence **9.3**; weights 30/20/20/20/10, total **9.35/10**. A1–A5 pass for this native fixture candidate.

Insights: holding the actual pressed target is more reliable than stopping an animation that may still be queued. Camera-movement and exact scene-count assertions prevent vacuous regression passes. The original rare failure's precise cause remains uncertain; this repair demonstrates and fixes a consistent native lost-activation mechanism. No physical touch-device or live-provider proof is claimed. Requested documentation cleanup of obsolete running/pending sentences is complete.

## Boundaries

The preceding scoped-dispatch slice remains separately accepted at 9.15/10 for its own digest. Capability attempt 4 remains historical NOT ACCEPTED 8.94/10. Do not retroactively change either verdict. Worker concurrency, complete capability-panel adoption, document/operation ownership, all 58 criteria, exact-SHA Actions with verified $0 controls, export/restore walkthrough and actual user approval remain separate open obligations. Public submitted release and old 3040 preview unchanged.
