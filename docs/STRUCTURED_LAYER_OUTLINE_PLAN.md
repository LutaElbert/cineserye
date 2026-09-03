# Structured Layer Outline Implementation Plan

Status: Complete

Baseline: `c204937751219c04747644ce56fa63ec6fd4eb35`

Branch: `codex/structured-layer-outline`

## Outcome

Make the left panel follow the same filmmaking hierarchy shown on the canvas. Manual creation should immediately produce an understandable Story → Scene → Shot/attachment outline, while the existing flat layer stack remains available for z-order work. This is a read-only presentation of validated document relationships; it does not move nodes, change production data, or create connections.

## Product rules

1. `Structure` is the default for an unplanned/manual canvas.
2. `Layers` preserves the existing reverse-z-order list and its move-forward/move-back behavior.
3. Accepted or proposed cinema plans continue to use the existing generated Project Outline.
4. Story → Scene and Scene → Shot use validated `hierarchy` connections.
5. Other items created as children use an explicit `attachment` relationship.
6. Legacy untyped connections to cinema attachments are inferred only when the target has one unambiguous parent.
7. Disconnected, cyclic, or multiply-parented items appear under `Unassigned`; ambiguous items show a warning and are never silently attached.
8. Search keeps every matching item visible with its ancestor context.
9. Collapse state affects only the sidebar. It never hides or moves canvas nodes.

## Use-case scenarios

### UC-SLO-01 — Build a microdrama from scratch

The creator starts with Story Premise, adds Scene 01, then adds Shot 01 and Shot 02. The Structure view immediately shows both shots nested beneath Scene 01 without requiring refresh, tidy, or manual sorting.

### UC-SLO-02 — Add a scene-level production note

The creator selects Scene 01 and adds a Note. The new edge is tagged as an attachment and the note appears beneath Scene 01 alongside its shots. Undo removes both the note and its outline entry; redo restores both.

### UC-SLO-03 — Find a shot in a larger project

The creator collapses Scene 02, searches for `Shot 06`, and still sees Story Premise → Scene 02 → Shot 06. Clearing the query restores the creator's prior collapsed state.

### UC-SLO-04 — Repair incomplete structure

An imported or manually edited node has no valid parent, a hierarchy cycle, or multiple candidate parents. It remains accessible beneath Unassigned with a warning instead of disappearing or being assigned arbitrarily.

### UC-SLO-05 — Perform a layer-stack operation

The creator switches to Layers, sees the unchanged flat z-order, and moves a layer forward or backward. Returning to Structure shows the same filmmaking hierarchy because presentation order is independent of z-order.

## Work packages

### WP1 — Deterministic structure projection

- Add a pure projection that resolves structural edges, validates one parent per item, detects cycles, sorts numbered scenes/shots naturally, and emits main/unassigned rows.
- Add ancestor-preserving search and collapse filtering.
- Unit-test valid hierarchy, attachments, legacy inference, disconnected items, multiple parents, cycles, search, deterministic sorting, and scale.

### WP2 — Explicit attachment contract

- Extend editor edge metadata and portable-project parsing with `attachment`.
- Tag new non-Scene/Shot child connections as attachments.
- Preserve legacy files and reject no previously valid backup.

### WP3 — Sidebar interaction

- Add an accessible `Structure | Layers` switch for manual canvases.
- Render a tree with indentation, disclosures, visibility/lock actions, selection, rename, and warning labels.
- Auto-expand new descendants by making expanded the default; remember explicit collapses locally for the session.
- Keep the current Project Outline for accepted/proposed plans.

### WP4 — Browser and regression coverage

- Verify automatic nesting after Add shot, Add next scene, and Add note.
- Verify collapse, search ancestor context, Unassigned fallback, Structure/Layers switching, visibility/lock, rename, undo/redo, persistence, and keyboard semantics.
- Run the complete compatibility, TypeScript, lint, unit, build, provider-boundary, dependency-audit, and Playwright gates.

## Acceptance criteria

- [x] AC-SLO-01: Manual canvases open in Structure view.
- [x] AC-SLO-02: Story, Scene, and Shot rows reflect validated parent connections immediately after creation.
- [x] AC-SLO-03: Scene/shot numbering sorts naturally (`02` before `10`) and remains deterministic after reload.
- [x] AC-SLO-04: Child production items and notes use a persisted attachment relationship.
- [x] AC-SLO-05: A child added to a collapsed branch becomes reachable without a reload.
- [x] AC-SLO-06: Search reveals matched rows and their ancestor path, then restores prior collapse state when cleared.
- [x] AC-SLO-07: Disconnected, cyclic, and multiply-parented nodes remain reachable under Unassigned; ambiguous rows expose a warning.
- [x] AC-SLO-08: Visibility, lock, selection, rename, and vector-path behavior do not regress.
- [x] AC-SLO-09: Layers view preserves the existing flat z-order list and layer movement behavior.
- [x] AC-SLO-10: Switching sidebar views never mutates nodes, edges, cinema data, history, or canvas positions.
- [x] AC-SLO-11: The structure uses tree/treeitem semantics, labelled disclosures, visible focus, and keyboard-operable controls.
- [x] AC-SLO-12: Accepted/proposed plans retain the existing Project Outline behavior.
- [x] AC-SLO-13: `.cineserye` backup/restore and IndexedDB round trips preserve attachment metadata.
- [x] AC-SLO-14: The complete fixture-only regression suite passes with no deployment or live provider call.

## Test matrix

| ID | Level | Case | Expected result |
| --- | --- | --- | --- |
| UT-SLO-01 | Unit | Story → Scene → Shot | Correct depths and parent IDs |
| UT-SLO-02 | Unit | Scene → Note attachment | Note nests beneath Scene |
| UT-SLO-03 | Unit | Legacy untyped attachment | Inferred only for one safe parent |
| UT-SLO-04 | Unit | Two structural parents | Item is Unassigned with `multiple-parents` warning |
| UT-SLO-05 | Unit | Cycle | Cycle members remain Unassigned with `cycle` warning |
| UT-SLO-06 | Unit | Search for nested shot | Match and ancestors remain visible |
| UT-SLO-07 | Unit | Scene/shot names 2 and 10 | Natural deterministic order |
| UT-SLO-08 | Unit | 500-node outline | Projection completes within 100ms on reference machine |
| INT-SLO-01 | Integration | Parse/serialize attachment | Relationship round-trips unchanged |
| E2E-SLO-01 | Browser | Add next scene and two shots | New rows appear under semantic parents |
| E2E-SLO-02 | Browser | Collapse then search | Search reveals path; clearing restores collapse |
| E2E-SLO-03 | Browser | Toggle Structure/Layers | Flat order and hierarchy remain independent |
| E2E-SLO-04 | Browser | Rename/hide/lock in Structure | Existing canvas behavior remains correct |
| E2E-SLO-05 | Browser | Reload | Structure and relationships reconstruct from persisted document |
| E2E-SLO-06 | Accessibility | Tree controls by keyboard | Focus, labels, state, and activation are usable |

## Regression gates

```sh
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

All browser tests must use the repository's deterministic fixture configuration. No Google Cloud, Parallel, Vertex, storyboard, video, managed evaluation, or deployment action is authorized by this increment.

## Completion evidence

- Vinext compatibility: 100%, 9 supported, 0 partial, 0 issues.
- TypeScript, ESLint, production build, client/server provider-boundary scan, and `git diff --check`: passed.
- Unit/integration: 197 passed; three opt-in live-provider tests intentionally skipped.
- Playwright: 193 passed across Chromium, Firefox, and WebKit; two intended non-Chromium stress cases skipped.
- Accessibility: no serious or critical Axe violations in the automatic Structure view.
- Visual inspection: desktop sidebar verified at the shipped panel width with Story → Scene → Shot indentation and readable controls.
- Dependency audit: no high or critical findings; 13 moderate transitive ADK/OpenTelemetry and `gaxios`/`uuid` findings remain. The complete offered remediation would force a breaking ADK downgrade.
- Provider safety: the successful regression run used deterministic fixtures. No Google Cloud state was read or changed, no live provider/API call was made, no credits were consumed, and nothing was deployed.
