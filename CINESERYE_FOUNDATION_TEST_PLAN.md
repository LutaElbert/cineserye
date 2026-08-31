# Cineserye foundation test plan

## Purpose

Protect Cineserye's generic editor integrity and make layer editing predictable across pointer, keyboard, persistence, and recovery workflows. These checks run locally and in CI; they do not deploy or modify Cloudflare resources.

## Behavior contract

- Double-clicking a concept on the canvas enters rich-text editing. Double-clicking a layer name in the layer panel enters rename mode; `F2` is the keyboard equivalent.
- Inline editing temporarily enlarges a small concept for usable controls, then restores its exact saved position and dimensions on finish, outside-click commit, or cancel.
- Concept titles and bodies support reversible bold, italic, underline, strikethrough, and safe-link formatting. Bodies additionally support reversible bullets, numbering, and checklists; title list controls remain unavailable.
- A single selected, unlocked concept or image layer exposes child and sibling actions. Children are compact editable concepts connected from the source bottom to the child top. Siblings reuse the selected layer's incoming parent and row; an unconnected root sibling is placed beside the source without inventing a connector.
- `Tab` creates a child and `Shift+Enter` creates a sibling when an unlocked concept or image node has canvas focus. Plain `Enter` starts rich-text editing only for concepts.
- `Enter` commits a layer rename, while `Escape` cancels without creating a history entry. Focus returns to the edited concept or layer control after cancellation and to the renamed layer after commit.
- Locked layers cannot be renamed, edited on the canvas, moved, resized, styled, deleted through a mixed bulk operation, or used as an endpoint for a new or reconnected connector.
- A connector requires two existing, distinct, unlocked endpoints. Duplicate directed connectors are rejected; reverse-direction connectors and cycles are supported.
- Reconnecting a connector is one undoable operation. Deleting a layer removes its incident connectors in the same undoable operation.
- Undo/redo, autosave/reload, backup/restore, collapse, tidy, search, visibility, ordering, and duplication preserve valid layer and connector references.
- Strict project import rejects malformed graphs. Local saved-state recovery preserves valid layers and drops invalid connectors instead of discarding the whole document.

## Automated coverage

| Area | Coverage |
| --- | --- |
| Double-click and keyboard editing | Canvas concept edit/cancel, layer-panel rename commit/cancel, `F2`, raster parity, clean history, focus restoration |
| Branch creation | Concept and image toolbar actions, `Tab`/`Shift+Enter`, mixed-size layout, bottom/top connectors, parent-aware siblings, locked images, undo/redo, and reload |
| Rich formatting toolbar | Title/body focus routing; bold, italic, underline, strikethrough, safe link apply/remove/cancel; bullets, numbering, checklists; toggle-off behavior; finish, outside-click, cancel, undo/redo, and reload |
| Connection rules | Missing endpoints, self-edge, duplicate direction, reverse cycle, locked endpoints, reconnection, duplicate reconnect rejection |
| Mutation safety | Keyboard and inspector deletion, cascade cleanup, mixed locked selection, ordering, duplicate-layer isolation, undo/redo |
| Persistence | Drag and resize autosave/reload, project backup/restore, malformed graph rejection and saved-state repair |
| Graph algorithms | Cyclic collapse and tidy termination, deterministic positioning, hidden descendants, integrity diagnostics |
| Copilot boundary | Atomic cloned proposals, runtime validation, graph enforcement, lock enforcement, and unsupported-command rejection |
| Cinema extensions | Planned `scene`, `shot`, `character`, `asset`, and `agent-run` kinds with versioned domain validators |
| Accessibility | Serious/critical axe scan, semantic selected/locked/hidden state, keyboard entry and cancellation, reduced motion, 200% text, mobile panels |
| Scale | 500 layers and 800 connectors restored, searched, tidied, autosaved, and reloaded without runtime errors |
| Browser regression | Production-built Worker in Chromium, Firefox, and WebKit |

## Release gate

Before review, all of the following must pass against the built local Worker:

```sh
npm run check
npm run typecheck
npm run lint
npm test
npm run build
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test
npm audit --audit-level=high
```

The local Worker must return the configured CSP, framing, MIME-sniffing, referrer, permissions, HSTS, and cross-origin headers. `git diff --check` must report no whitespace errors.

## Evidence recording

Record the exact compatibility score, unit count, browser count, build result, and audit result after each baseline verification. Keep generated reports and browser traces out of the committed source unless they explain a reproducible failure.

## Isolated baseline evidence — 2026-08-31

- Vinext compatibility: 100% (6 supported, 0 partial, 0 issues).
- TypeScript and ESLint: passed with no errors.
- Unit tests: 53/53 passed across 9 files.
- Production build: passed.
- Dependency audit: zero vulnerabilities at the high severity gate.
- Playwright against the local development server: 112 passed, with the Firefox and WebKit copies of the Chromium-only stress test intentionally skipped.
- Playwright against the locally built Cloudflare Worker: 112 passed with the same 2 intentional skips; no Worker was deployed.
- Whitespace validation: `git diff --check` passed.

## Manual acceptance still required

- Confirm the fresh local state visibly presents `Story Premise → Scene 01 → Shot 01`.
- Repeat pointer editing and drag/resize on at least one physical touch device.
- Review VoiceOver/Safari or another screen-reader/browser combination.
- Approve a separate release candidate before any preview or production deployment.
