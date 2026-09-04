# Mixed-Direction Hierarchy Repair Implementation Plan

Status: Complete

Baseline: `dfbeeb8120f817c5f14e0f72b4ab9684406f6a04`

## Problem

A saved Story can contain a mixture of right-to-left and bottom-to-top Scene connectors. The current organizer infers the entire Story layout from the first raw outgoing edge and skips all node movement when that edge happens to be vertical. This makes the sparkle action report no useful change and prevents the shared Story → Scene spine from applying consistently.

## Goal

Treat the first narrative Scene connection as the canonical axis for its sibling group, normalize every eligible Story → Scene connector to that axis, and reorganize the corresponding draft nodes in one undoable sparkle action.

## Implementation

1. Derive the Story's canonical direction from its first narrative Scene, not arbitrary raw edge-array order.
2. Extend the cinema workspace plan with explicit connector-direction repairs alongside node positions.
3. For a horizontal canonical connection, clear legacy bottom/top handles on sibling Scene edges so they use Story-right → Scene-left.
4. For a vertical canonical connection, preserve that legacy axis and normalize eligible sibling edges to bottom → top without rotating its nodes.
5. Apply connector and node repairs together from the sparkle action as one history transaction.
6. Propagate the same repair plan through typed Scene insertion so adding a Scene cannot preserve a mixed-direction sibling group.
7. Add exact mixed five-Scene unit/browser regressions and rerun all Fixture-mode gates.

## Acceptance criteria

- [x] AC-MD-01: The first narrative Scene connection determines the Story sibling group's canonical axis.
- [x] AC-MD-02: A horizontal canonical group clears bottom/top handles from every eligible direct Story → Scene edge.
- [x] AC-MD-03: A vertical canonical group retains bottom/top routing and is not silently rotated.
- [x] AC-MD-04: Horizontal normalization aligns Scenes in one ordered lane and centers a movable Story against them.
- [x] AC-MD-05: Connector normalization and node movement form one undoable/redoable sparkle action.
- [x] AC-MD-06: Adding a new Scene applies the same normalization automatically in its creation transaction.
- [x] AC-MD-07: Locked and accepted/provider-owned nodes and their protected connectors remain unchanged.
- [x] AC-MD-08: Reference, sequence, attachment, Scene → child, and unrelated freeform edges remain unchanged.
- [x] AC-MD-09: Reload preserves normalized connector handles and reconstructs the shared hierarchy spine.
- [x] AC-MD-10: The full Fixture validation matrix passes without Google Cloud, live-provider, deployment, or paid calls.

## Test cases

- Unit: mixed five-Scene handles with Scene 01 horizontal; arbitrary raw edge order; vertical canonical preservation; protected endpoints; unrelated relationship isolation; deterministic/idempotent repair.
- Command boundary: safely clear source/target handles with explicit `null` while retaining strict handle validation.
- Browser: reproduce the scattered five-Scene result, click sparkle, verify one Scene lane plus one shared Story spine, Undo, Redo, save, and reload.
- Regression: automatic Scene creation, accepted plans, connector selection/reconnection/deletion, Project Outline, accessibility, and stress behavior across Chromium, Firefox, and WebKit.

No Google Cloud mutation, live research, live planning, storyboard generation, video generation, deployment, or paid-provider request is authorized by this plan.

## Acceptance evidence

- Canonical direction now follows the first narrative Scene, independent of raw edge-array order. The five-Scene regression intentionally places Scene 02's vertical edge first and still selects Scene 01's horizontal connection.
- Horizontal groups clear legacy handles; vertical groups normalize to bottom/top without rotating the layout. Explicit `null` handle updates are validated at the command boundary.
- Sparkle applies connector repairs and ordered Scene positions in one history transaction. Browser coverage proves Undo restores the scattered mixed layout and Redo restores the normalized layout.
- Typed Scene creation consumes the same repair plan, so adding a Scene also repairs existing eligible sibling connectors atomically.
- Locked/protected endpoints and unrelated relationships are excluded by unit coverage.
- Reload coverage proves normalized handles persist and the derived Story → Scene shared spine is reconstructed.
- Visual Fixture verification reproduced the user's saved five-Scene canvas and confirmed one centered Story, one numerically ordered Scene lane, and one shared branching spine.
- TypeScript, ESLint, client/server provider-boundary validation, Vinext compatibility (`100%`, 9 supported, 0 issues), production build, and `git diff --check` passed.
- Unit/integration: 222 passed; 3 live-provider tests intentionally skipped.
- Playwright: 211 passed across Chromium, Firefox, and WebKit; 2 intended non-Chromium stress skips.
- All runtime verification used Fixture mode. No Google Cloud mutation, live-provider request, deployment, or paid call occurred.
