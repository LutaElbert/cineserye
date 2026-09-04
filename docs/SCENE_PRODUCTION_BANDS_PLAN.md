# Scene Production Bands Implementation Plan

Status: Complete

Baseline: `7eddbae8323d487a6f4acd4c1eb7c33e412bd193`

## Goal

Make each draft scene and its typed children read as one local production band. A scene with multiple shots is vertically centered against its shot/production-child group; its connector stays short and horizontal; later draft scenes move down when that band expands.

## Implementation

1. Extend the parent-aware planner to return atomic position updates for the new node and any affected draft scene-band hosts.
2. Place a new Scene below the complete preceding scene subtree rather than below only the preceding scene card.
3. When a child is added to a draft Scene, center the Scene against the complete direct-child group.
4. Shift only later draft scene subtrees downward when the expanded band needs space.
5. Keep accepted, locked, hidden, reference-linked, sequence-linked, and unrelated freeform nodes fixed.
6. Preserve semantic parents, inherited connector handles, Project Outline ordering, undo/redo, persistence, and recovery.

## Use cases

- Scene 02 with Shot 07, Shot 08, and Shot 09 displays Scene 02 at the vertical midpoint of the three-shot lane.
- Adding Shot 09 expands only Scene 02's draft band and moves later draft scenes down without changing Scene 01's accepted plan.
- Adding Scene 03 after a populated Scene 02 places it below Scene 02's full subtree.
- A locked or accepted Scene remains fixed when a manual child is added.

## Acceptance criteria

- [x] AC-SPB-01: A draft Scene with one to three shots is vertically centered against its complete direct-child group.
- [x] AC-SPB-02: Shots remain in one collision-free vertical lane to the right of their Scene.
- [x] AC-SPB-03: Adding a Scene positions it below preceding scene subtrees, not inside another scene's production band.
- [x] AC-SPB-04: Later draft Scene subtrees shift down atomically when an earlier band expands.
- [x] AC-SPB-05: Accepted and locked nodes never move automatically.
- [x] AC-SPB-06: Story → Scene and Scene → child semantic parentage and inherited connector direction remain correct.
- [x] AC-SPB-07: Character, Location, Prop, Visual Element, and Note children participate in the same scene band.
- [x] AC-SPB-08: Reference/sequence links and generic image/freeform branches remain unchanged.
- [x] AC-SPB-09: Undo, redo, autosave reload, backup recovery, and Project Outline grouping remain correct.
- [x] AC-SPB-10: TypeScript, lint, unit/integration, build, client-boundary, compatibility, accessibility, stress, and three-browser regressions pass in Fixture mode.

## Test cases

- Unit: three-shot centering, complete-subtree Scene insertion, later-sibling translation, accepted/locked stability, all typed child roles, and reference/sequence isolation.
- Browser: build three scenes; add three shots to Scene 02; assert lane alignment, midpoint centering, Scene 03 displacement, semantic connectors, undo/redo, and reload stability.
- Regression: accepted fixture plan plus manual scene/shot additions; Project Outline and Layers; image branches; 500-node stress case; Chromium, Firefox, and WebKit.

No Google Cloud mutation, live research, live planning, storyboard generation, video generation, deployment, or paid-provider request is authorized by this plan.

## Acceptance evidence

- The planner returns one atomic position map containing the new node, its movable draft Scene host, and only later movable draft scene subtrees that need clearance.
- Unit coverage verifies exact three-shot midpoint centering, complete-subtree scene insertion, later-scene displacement, accepted/locked stability, all typed roles, inherited routing, and reference/sequence isolation.
- Browser coverage creates Scene 02 and Scene 03, adds Shot 02–04 to Scene 02, verifies exact model coordinates and semantic connectors, then proves Undo, Redo, reload, Project Outline, and non-overlap behavior.
- Visual Fixture inspection confirmed Scene 02 centered beside Shot 07–09 with Scene 03 below the expanded band.
- Vinext compatibility: 100% (9 supported, 0 partial, 0 issues).
- TypeScript, ESLint, client/server provider boundary, and production build: passed.
- Unit/integration: 211 passed, 3 intentionally skipped live-provider tests.
- Playwright: 202 passed across Chromium, Firefox, and WebKit; 2 intended non-Chromium stress skips. The 500-layer/800-connector stress case passed in Chromium.
- Provider mode: Fixture. Vertex, Parallel, storyboard, video, managed evaluation, Google Cloud mutation, and paid calls: none.
