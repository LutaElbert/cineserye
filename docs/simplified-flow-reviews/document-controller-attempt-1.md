# Initial document history/save extraction — attempt 1

Bounded review **PASS, 9.10/10**; not full P2 acceptance. HEAD `abfa0fa` plus dirty work on `feature/simplified-flow`. Scope: extracted history stacks and serial save state, existing writer admission/media roots, failed-load write barrier, browser Zod CSP configuration, and Advanced-tools assertion preservation. It does not claim one complete document commit controller or durable client operation journal.

Frozen ten-file digest (sorted path/NUL/bytes/NUL): `1902ada3d71defa4abc21f32b751e834eba1de8e0ff00b9846929a1f14f9b42d`:

```
app/editor/Editor.tsx
app/editor/document-history.test.ts
app/editor/document-history.ts
app/editor/document-save-queue.test.ts
app/editor/document-save-queue.ts
app/editor/story-history-safety.test.ts
app/editor/story-history-safety.ts
app/layout.tsx
e2e/document-controller.spec.ts
e2e/story-assistant.spec.ts
```

Application files stayed frozen during review; recovery browser coverage was extended and one newly written exact-message typo corrected. Earlier ten-file digest before that test-only addition: `47df267cd14dd44ccf3365c7f7a5f31e4657037ba9ba721954b358f3e55d939d`. Separate hierarchy-index optimization is outside this review and not in the controller browser build.

Acceptance scope:

- H: reversible stacks preserve graph/domain batches, bounded memory, both undo/redo media roots and unresolved Story guard; rejected restore leaves both stacks intact.
- S: writes are serial; late success/failure cannot label newer edits Saved; awaited errors propagate; queued content is captured; writer admission stays in the integration.
- R: unreadable/future-version local storage is not overwritten by autosave, editing or save shortcuts. Only explicit confirmed replacement may reopen writes. Invalid/cancelled backup must retain original bytes.
- C: browser validation does not attempt eval under the existing CSP; no `unsafe-eval` allowance and no suppressed browser errors.
- U: advanced manual controls remain present but closed and noncompeting by default.

Evidence in credential-free `/private/tmp/cineserye-full-flow-3W6tpD`:

- Typecheck, lint, client boundary and fixture production build passed.
- 21 focused characterization tests passed; fresh critic independently reran all 21.
- `browser-72.json`: eight scenarios × three engines × three repetitions, **72 passed**, zero failures/retries/skips/flakes. Includes original-ID recovery, known-result undo/redo, layer actions, backup/export/reload, rich text with zero console/page errors, hierarchy reordering, second tab and edited failed-load recovery.
- Recovery addendum initially had **8 pass / 3 fail / 2 interrupted / 23 not run** because the test expected the wrong exact validation-message text. Actual product message includes “supported.” No application code or assertion strength was changed; failed evidence retained in `recovery-addendum-selector-failure.json`. Final addendum **36/36 passed**, three engines × three repetitions, no retries/skips/flakes; `recovery-addendum-36.json`. It covers edited New, untouched New, invalid/cancelled/confirmed backup recovery and the complete detailed Assistant direction flow.
- Full offline run: **522 pass / 1 fail / 5 intentional paid/live skips**. Sole failure: unchanged 501-node outline timing **171.48 ms > 150 ms**. `units-first.json` retained. This is not a full-suite pass. Redundant per-edge node-index construction is being addressed separately; no threshold change.

Critic: fresh `document_controller_critic_1`; **PASS H/S/R/C/U, 9.10/10**. Scores correctness 9.1, simplicity 9.2, usability 9.0, safety 9.1, evidence 9.1; weights 30/20/20/20/10. Independently verified 21 tests, ten-file snapshot identity/digest and both passing browser reports. No confirmed new regression. Its initial suspected untouched-reset Saving bug was **retracted**, because shallow field equality detects the new cloned node objects and schedules autosave; added browser coverage directly disproves it. Broader pre-hydration admission, asynchronous project replacement, ErrorBoundary persistence reset and complete creative commit/ref ownership remain open P2 work, not accepted by this slice. Main insight: two extracted owners reduce duplication but are not the complete document controller.

No paid/provider calls, push, merge, CI dispatch, deployment, billing change or old-preview replacement. Full native/Worker gates, exact-SHA GitHub Actions, measured journey comparison and actual user visual/walkthrough approval remain mandatory.
