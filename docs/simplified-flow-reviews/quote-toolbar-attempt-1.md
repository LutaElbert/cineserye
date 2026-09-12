# Quote mode / actionbar repair — attempt 1

Fresh critic **PASS, 9.13/10**. Bounded repair, not a completed P0/P1/P2/P4 phase. HEAD `abfa0fa` plus dirty work on `feature/simplified-flow`.

The previous complete native run stopped at **519 expected / 313 passed / 3 failed / 1 pre-existing skip / 2 interrupted / 200 not run**, no retries. Retained under `artifacts/simplified-flow/native-current/`: `browser-313-pass.json`, source manifest, failed screenshots/traces, and current dependency audit (0 high/critical, 14 moderate). Its source digest `bcea091a553a1c4c08f1f67199720cf6cd5b74a1f2383b7f1aa4f9737a69e152` covers 303 files identical in the safe snapshot at that time; it predates this repair. September 11 evidence correction: **both** the Assistant stress case and the separate 500-layer/800-edge canvas case are already Chromium-only in HEAD. The earlier statement that the latter spans engines was incorrect. A complete three-engine run therefore retains four baseline stress skips; they are not Firefox/WebKit scale proof.

Failures and fixes:

1. “Add next shot” rendered beneath Properties. New `CanvasBoundActionbar` contains only the toolbar's presentation inside the React Flow canvas, never changes node/camera state, and cleans up resize/movement observers. Applies to concept, image and multi-selection toolbars. Pure geometry tests cover unclipped/right/left/top/small canvases. The existing centering test now checks every action's actual center hit-test before clicking; no force click or removed layout assertion.
2. A delayed fixture estimate could remain displayed after switching Live. Async direction approval may resume an old render's refresh callback after the mode change. Refresh now reads the committed mode, invalidates old request identities in the layout phase, validates responses with the existing schema, and exposes only a quote matching the current mode. The regression requires the active Live quote to arrive, so an indefinitely blank estimate cannot pass.
3. A test interceptor tried decoding browser-negotiated compressed bytes with Node's response parser. Its `route.fetch` now requests identity encoding before JSON parsing. Live-block/estimate/no-POST assertions are unchanged.

Frozen eight-file sorted path/NUL/bytes/NUL digest: `db0d7ad8ebc09b88801715f6a9d4dc5003eccf5eea139e66e0b34b6ea6153a80`:

```
app/editor/CanvasBoundActionbar.tsx
app/editor/Editor.tsx
app/editor/actionbar-bounds.test.ts
app/editor/actionbar-bounds.ts
app/features/story-development/StoryDevelopmentPanel.tsx
e2e/manual-creation-recovery.spec.ts
e2e/story-assistant.spec.ts
e2e/story-development.spec.ts
```

Credential-free `/private/tmp/cineserye-full-flow-3W6tpD`: typecheck, lint, 3 geometry tests and fixture production build passed. **54/54 browser checks passed**, six cases × three engines × three repetitions, zero retries/skips/flakes. Includes image/multi-selection actions and strict zero-console-error rich-text editing, in addition to the three repaired failures. Full offline rerun **527 passed / 0 failed / 5 intentional paid/live skips**. Reports: `artifacts/simplified-flow/quote-toolbar-attempt-1/browser-54.json` and `units.json`.

Fresh `quote_toolbar_critic_1`: **Q/T/L/E PASS, 9.13/10**; correctness 9.2, simplicity 9.3, usability 9.0, safety 9.0, evidence 9.0, weights 30/20/20/20/10. Independently verified eight-file identity/digest, 3 geometry tests and 54-browser report. No broad/full-phase acceptance. Main insight: shared view-only containment and current-mode refresh checks remove real failures without replacing canvas ownership.

Two broader findings are explicitly open for the next quote-safety slice: automatic same-mode malformed/error refresh may leave an older quote ready; `generate()` needs current mode/approval revalidation immediately before POST after asynchronous preparation/save. Existing server policy guards are independent safeguards, not grounds to omit these client checks. Schema validation alone is not comprehensive refresh fail-closed behavior.

No paid/provider execution, remote writes, CI dispatch, deployment or budget changes. The old 3040 preview is unchanged. Shared capability adoption, complete document/operation ownership, full native/Worker/CI gates, measured navigation and actual user approval remain open.
