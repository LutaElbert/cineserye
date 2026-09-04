# Hierarchy Reorganization Implementation Plan

Status: Complete

Baseline: `1ac0983b377f1aabd04433f8f272cb45138afd07`

## Goal

Use one cinema-aware layout policy for automatic layer creation and the sparkle toolbar action. Story, Scene, Shot, and production layers must remain readable in narrative order without letting generic graph coordinates override their semantic hierarchy.

## Implementation

1. Add a reusable workspace reorganization planner for Story → Scene → production-child bands.
2. Order accepted scenes by `cinema.sceneOrder`; order manual draft scenes by their scene number with stable coordinate and ID fallbacks.
3. Anchor the scene lane and connection direction to the first Scene relationship.
4. Place later scenes after the preceding complete scene band, center movable draft Scenes against their direct children, and center a movable draft Story against its direct Scene cards.
5. Run the same reorganization planner after typed cinema insertion and from the sparkle toolbar action.
6. Preserve locked, accepted/provider-owned, hidden, unrelated freeform, reference-linked, and sequence-linked content.
7. Apply every automatic reorganization as one undoable state transition and fit the result into view only for the explicit toolbar action.

## Use cases

- Adding Scene 05 places it after Scene 04 in the established Scene lane even if the canvas was previously disorganized.
- Adding three shots to Scene 02 centers Scene 02 against those shots while later scene bands remain below it.
- Adding or reorganizing several scenes centers Story Premise against the direct Scene card group, not against every descendant.
- Clicking the sparkle action repairs draft hierarchy spacing using the same result automatic creation would produce.
- A mixed accepted plan plus manual draft additions leaves the accepted plan fixed while organizing only eligible draft nodes.

## Acceptance criteria

- [x] AC-HR-01: Direct Scenes are ordered by canonical narrative order and occupy the lane established by Scene 01.
- [x] AC-HR-02: A new Scene is placed after the preceding complete scene band without overlap.
- [x] AC-HR-03: Movable draft Scenes are centered against their visible direct production children.
- [x] AC-HR-04: A movable draft Story is centered against its visible direct Scene cards and keeps level clearance from the Scene lane.
- [x] AC-HR-05: Automatic typed insertion and the sparkle reorganization action use the same workspace planner.
- [x] AC-HR-06: Locked and accepted/provider-owned nodes remain fixed.
- [x] AC-HR-07: Hidden nodes, reference/sequence relationships, and unrelated freeform branches do not influence cinema hierarchy placement.
- [x] AC-HR-08: Explicit reorganization is deterministic, idempotent, undoable, and fits the organized result into view.
- [x] AC-HR-09: Explicit vertical legacy hierarchy routing remains supported without being converted to horizontal routing.
- [x] AC-HR-10: Project Outline order, persistence, recovery, accessibility, stress behavior, and three-browser regressions pass in Fixture mode.

## Test cases

- Unit: disordered five-scene repair; canonical `sceneOrder`; Story midpoint; three-shot Scene midpoint; complete-band spacing; accepted/locked stability; reference/sequence isolation; vertical-route preservation; deterministic/idempotent output.
- Browser: create multiple Scenes and Shots, deliberately move them, invoke Reorganize project, verify order and centers, then verify Undo, Redo, and reload.
- Regression: initial draft, accepted fixture plan with manual additions, Project Outline/Layers, image/freeform graphs, hidden nodes, and the 500-layer/800-connector stress case across Chromium, Firefox, and WebKit.

No Google Cloud mutation, live research, live planning, storyboard generation, video generation, deployment, or paid-provider request is authorized by this plan.

## Acceptance evidence

- Automatic typed insertion and the accessible `Reorganize project layout` toolbar action both call `planCinemaWorkspaceReorganization`.
- Narrative order uses `cinema.sceneOrder` for production records and stable hierarchy-edge order for renamed manual drafts; display names are only a fallback.
- The planner recognizes current `hierarchy`/`attachment` relationships and legacy semantic connectors without relationship metadata.
- Unit coverage verifies five-scene disorder repair, Story and Scene midpoint behavior, complete scene bands, deterministic/idempotent output, accepted/locked stability, reference/sequence isolation, and vertical legacy preservation.
- Browser coverage deliberately disorders Scene 02 and Scene 03, reorganizes them, and proves exact ordering, shared lanes, Story centering, collision freedom, Undo, Redo, and reload persistence.
- Visual Fixture inspection confirmed the renamed sparkle action and a stable top-to-bottom Scene 01–05 lane on an existing saved canvas.
- Vinext compatibility: 100% (9 supported, 0 partial, 0 issues).
- TypeScript, ESLint, client/server provider boundary, production build, and diff validation: passed.
- Unit/integration: 215 passed, 3 intentionally skipped live-provider tests.
- Playwright: 205 passed across Chromium, Firefox, and WebKit; 2 intended non-Chromium stress skips. The 500-layer/800-connector stress case passed in Chromium.
- Provider mode: Fixture. Vertex, Parallel, storyboard, video, managed evaluation, Google Cloud mutation, deployment, and paid calls: none.
