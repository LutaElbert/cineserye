# Connection-Aware Hierarchy Edge Routing Implementation Plan

Status: Complete

Baseline: `e8ed46e35680801a73457d381b23b8df9a3375b4`

## Goal

Make direct Story → Scene relationships read as one hierarchy even when several Scenes share the same parent. Preserve the existing semantic graph while replacing ambiguous independently routed connectors with a deterministic shared spine and one short branch into each Scene.

## Implementation

1. Add a pure routing planner that recognizes visible, horizontal Story → Scene hierarchy siblings.
2. Compute one safe shared spine between the Story card and the Scene lane without moving nodes or changing persisted connector records.
3. Render eligible connectors through a reusable custom React Flow edge; keep single-child, vertical, reference, sequence, attachment, and freeform connectors on their existing routes.
4. Derive routing metadata from the current visible canvas so adding, removing, moving, collapsing, or restoring Scenes updates the spine automatically.
5. Preserve connector selection, reconnection, deletion, markers, styles, proposal previews, and accessible labels.
6. Add focused unit and browser coverage, then run the full Fixture-mode regression gate.

## Use cases

- Story Premise with Scenes 01–05 shows one shared vertical spine and five branches, not five unrelated elbows.
- Adding Scene 06 automatically extends the existing spine without rewriting saved project data.
- Removing or hiding a Scene removes only that branch and recomputes the visible group.
- A single Story → Scene connector remains a simple smooth-step connection.
- A legacy top-to-bottom Story → Scene layout keeps its explicit vertical routing.
- Narrative sequence remains separate from hierarchy; no Scene is made the parent of another Scene.

## Acceptance criteria

- [x] AC-ER-01: Two or more visible horizontal Scene children of one Story use one deterministic shared spine.
- [x] AC-ER-02: Every branch terminates at its Scene's left handle and cannot visually imply a Scene → Scene parent relationship.
- [x] AC-ER-03: The Story → Scene endpoints and hierarchy records remain direct and unchanged in persistence.
- [x] AC-ER-04: The spine stays between the Story's right edge and the nearest Scene's left edge and does not cross a node card.
- [x] AC-ER-05: Adding, removing, moving, collapsing, restoring, or reloading Scenes updates routing automatically.
- [x] AC-ER-06: Single-child and explicit vertical hierarchies retain their existing smooth-step behavior.
- [x] AC-ER-07: Scene → production-child, attachment, reference, sequence, proposal-preview, and unrelated freeform connectors are unaffected.
- [x] AC-ER-08: Connector markers, styles, selection, deletion, reconnection, and accessible labels continue to work.
- [x] AC-ER-09: Routing is derived presentation state and creates no undo entry or document-schema change.
- [x] AC-ER-10: Unit, TypeScript, ESLint, build, provider-boundary, Vinext, and three-browser Fixture regressions pass without live provider calls.

## Test cases

- Unit: multi-Scene grouping, common spine coordinate, endpoint preservation, order independence, hidden child exclusion, single-child fallback, vertical fallback, non-hierarchy isolation, legacy semantic hierarchy support, and insufficient-horizontal-clearance fallback.
- Browser: create Scenes 02 and 03, verify a common Story spine and direct accessible endpoints, add another Scene, reload, and confirm the route remains derived while IndexedDB edges stay `smoothstep` hierarchy records.
- Regression: connector selection/deletion/reconnect, collapsed branches, proposal preview, accepted production canvas, manual node movement, Project Outline, Undo/Redo, and the existing stress graph across Chromium, Firefox, and WebKit.

No Google Cloud mutation, live research, live planning, storyboard generation, video generation, deployment, or paid-provider request is authorized by this plan.

## Acceptance evidence

- `planCinemaHierarchyBusRoutes` recognizes direct horizontal Story → Scene sibling groups, excludes hidden/non-hierarchy/vertical routes, and computes one shared spine between hierarchy levels.
- `CinemaHierarchyBusEdge` uses the existing source and target handles, styles, markers, labels, and interaction behavior while applying the shared rounded orthogonal route.
- `Editor` enriches only the rendered edge objects. IndexedDB verification confirms persisted connectors remain direct `smoothstep` hierarchy records with no derived route metadata.
- Unit coverage verifies multi-Scene grouping, a common spine, order independence, hidden and vertical fallbacks, legacy semantic edges, unrelated relationship isolation, and insufficient-clearance fallback.
- Browser coverage verifies single-child fallback, automatic two- and three-Scene spine updates, direct Story endpoints, no Scene → Scene hierarchy, unchanged persistence, and reload reconstruction.
- Visual Fixture inspection confirmed one Story-to-Scene spine with five distinct Scene branches on the saved local project.
- Vinext compatibility: 100% (9 supported, 0 partial, 0 issues).
- TypeScript, ESLint, client/server provider boundary, production build, and diff validation: passed.
- Unit/integration: 219 passed, 3 intentionally skipped live-provider tests.
- Playwright: 208 passed across Chromium, Firefox, and WebKit; 2 intended non-Chromium stress skips.
- Provider mode: Fixture. Vertex, Parallel, storyboard, video, managed evaluation, Google Cloud mutation, deployment, and paid calls: none.
