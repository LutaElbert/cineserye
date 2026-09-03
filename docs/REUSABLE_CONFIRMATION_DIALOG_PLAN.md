# Reusable Confirmation Dialog Implementation Plan

Status: Complete

Baseline: `306eb287c10a5c6b299a0b798de59e189297b38f`

Branch: `codex/reusable-confirmation-dialog`

## Outcome

Replace browser-native `window.confirm` prompts with one branded, reusable, accessible Cineserye confirmation dialog. Preserve the current operation boundaries, undo/recovery guarantees, and local-first behavior while making consequences and action labels explicit.

## Inventory and scope

The reusable dialog will cover all seven current confirmation flows:

1. Delete the entire canvas.
2. Start a new local document.
3. Restore a prior plan revision as a new revision.
4. Restore a local checkpoint.
5. Replace the current canvas from a `.cineserye` backup.
6. Delete unused local media.
7. Reset the saved local project from the fatal-error boundary.

Simple undoable single-item deletion remains immediate. Proposal acceptance/rejection keeps its existing dedicated review UI. File selection and operating-system permission prompts remain native.

## Product and safety rules

- The component uses the native HTML `<dialog>` modal primitive under Cineserye styling.
- Cancel receives initial focus for destructive or replacement actions.
- Every confirm label states the action, such as `Delete 11 layers` or `Restore checkpoint`—never `OK`.
- Danger, warning, and default variants change presentation only; they never weaken the underlying command/storage validation.
- Escape and backdrop selection cancel. Focus remains trapped by the modal and returns to the invoking control.
- A request resolves exactly once. A second request safely cancels the older pending request.
- Async work begins only after confirmation; double activation cannot run it twice.
- Descriptions distinguish recoverable operations from irreversible local-data deletion.

## Use-case scenarios

### UC-RCD-01 — Empty the canvas safely

The creator selects every unlocked layer and chooses delete. A danger dialog reports the exact layer count, connected cinema-data impact, and recovery guarantee. Cancel leaves the document unchanged. Confirm saves the last-non-empty recovery document before deletion.

### UC-RCD-02 — Start over intentionally

The creator chooses New. A warning dialog explains that the current local canvas will be replaced by the clean Story Premise → Scene 01 → Shot 01 foundation. Cancel preserves the current project; confirmation performs the existing reset and announces success.

### UC-RCD-03 — Restore trusted local work

Checkpoint and portable-backup restoration show the source title and replacement impact before any current document state is replaced. Backup media is parsed and validated before confirmation but stored only after acceptance.

### UC-RCD-04 — Recover a previous plan

Revision history requests a restore. The dialog names the source and new revision numbers and explains that the current revision remains in history. Confirm continues through the validated proposal/revision boundary.

### UC-RCD-05 — Perform irreversible maintenance

Unused-media cleanup and fatal-error reset use danger messaging that clearly identifies irreversible local deletion. The primary action is never focused by default.

## Work packages

### WP1 — Reusable component and request boundary

- Implement a controlled `ConfirmationDialog` plus a promise-based `useConfirmationDialog` hook.
- Support default/warning/danger tone, eyebrow, title, description, impact, reassurance, dynamic labels, busy state, and safe one-time settlement.
- Add responsive styles consistent with existing dialogs.

### WP2 — Editor migration

- Replace all six Editor `window.confirm` calls with explicit confirmation requests.
- Keep validation, history, recovery, media storage, and announcements in their existing functions.
- Render one dialog instance at the editor root.

### WP3 — Fatal-error migration

- Replace the ErrorBoundary native prompt with the same component in controlled class state.
- Keep irreversible reset wording and fix the temporary error-screen brand mark to `C`.

### WP4 — Verification and regression

- Update native-dialog Playwright helpers to interact with the branded alert dialog.
- Test cancel/confirm, exact counts, Escape, focus restoration, dynamic labels, restore flows, mobile layout, and Axe accessibility.
- Run the full compatibility, TypeScript, lint, unit, build, client-boundary, dependency-audit, and cross-browser Playwright gates.

## Acceptance criteria

- [x] AC-RCD-01: No application code calls `window.confirm`, `window.alert`, or `window.prompt`.
- [x] AC-RCD-02: One reusable component serves all current confirmation flows.
- [x] AC-RCD-03: Entire-canvas deletion shows the exact layer count and recovery explanation.
- [x] AC-RCD-04: Cancel, Escape, and backdrop dismissal cause no operation or document mutation.
- [x] AC-RCD-05: Confirm labels describe the actual action and never use generic `OK`.
- [x] AC-RCD-06: Cancel receives initial focus and focus returns to the invoking control.
- [x] AC-RCD-07: Rapid/double activation resolves a request once and cannot repeat the destructive operation.
- [x] AC-RCD-08: New-document, revision, checkpoint, backup, media cleanup, and fatal reset retain their existing safety boundaries.
- [x] AC-RCD-09: The dialog exposes alertdialog semantics, labelled title/description, keyboard operation, visible focus, and sufficient contrast.
- [x] AC-RCD-10: The dialog remains usable at 390px and with enlarged text/reduced motion.
- [x] AC-RCD-11: Existing undo, recovery, backup, revision, and persistence tests continue to pass.
- [x] AC-RCD-12: Fixture-only regression passes without external provider calls, Google Cloud changes, credit use, or deployment.

## Test matrix

| ID | Level | Case | Expected result |
| --- | --- | --- | --- |
| UT-RCD-01 | Static | Native confirmation scan | No native app prompts remain |
| E2E-RCD-01 | Browser | Delete all → Cancel | Dialog closes and all layers remain |
| E2E-RCD-02 | Browser | Delete all → Confirm | Recovery is saved and canvas empties |
| E2E-RCD-03 | Browser | Delete dialog → Escape | No deletion; focus returns to delete control |
| E2E-RCD-04 | Browser | New document | Explicit warning and reset only after confirmation |
| E2E-RCD-05 | Browser | Restore revision | Named source/new revision and one restore |
| E2E-RCD-06 | Browser | Restore checkpoint | Current work remains until confirmation |
| E2E-RCD-07 | Browser | Restore backup with media | Validated backup applies only after confirmation |
| E2E-RCD-08 | Browser | Mobile + Axe | No serious accessibility violation or clipped action |
| REG-RCD-01 | Regression | Full editor workflows | Existing behavior remains green in three engines |

## Verification commands

```sh
rg -n "window\.(confirm|alert|prompt)" app
git diff --check
npm run check
npm run typecheck
npm run lint
npm test
npm run build
npm run check:client-boundary
npm audit --audit-level=high
npm run test:e2e
```

No deployment or provider operation is part of this increment.

## Completion evidence

- Native prompt scan: zero application or Playwright native-dialog handlers.
- Vinext compatibility: 100%, 9 supported, 0 partial, 0 issues.
- TypeScript, ESLint, build, and client/server provider-boundary checks: passed.
- Unit/integration: 197 passed; three opt-in live-provider tests intentionally skipped.
- Playwright: 196 passed across Chromium, Firefox, and WebKit; two non-Chromium stress runs intentionally skipped.
- Accessibility: Axe reports no serious or critical issue while the confirmation is open; Cancel, Escape, backdrop, focus return, and 390px containment pass in all three engines.
- Dependency audit: no high or critical finding; 13 moderate transitive ADK/OpenTelemetry and gaxios findings remain.
- Execution mode: fixture only. No external provider call, Google Cloud change, credit use, or deployment.
