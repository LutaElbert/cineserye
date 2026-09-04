# Parent-Aware Cinema Layout Implementation Plan

Status: Complete

Baseline: `206614eec3048fcf03b36f40a0a31528bd8bce7c`

Branch: `codex/parent-aware-layout`

## Problem

Manual cinema creation currently hard-codes `bottom → top` connectors. That conflicts with an existing horizontal production canvas, where Story → Scene and most generated relationships use `right → left`. A newly added scene is placed below the complete accepted workspace, so several Story-owned scene edges can visually pass through one another and make sibling scenes appear chained.

## Product decision

New typed cinema layers inherit the established flow of their semantic parent and same-role siblings. Parent identity remains graph-authoritative; connector routing and collision-free placement are a presentation policy. Existing accepted hosts, locked nodes, free-form branches, reference links, and sequence links are not rearranged.

## Implementation

1. Add a provider-neutral parent-layout policy that resolves semantic parent, child role, sibling lane, direction, and connector handles.
2. Prefer an existing same-role sibling edge; otherwise inherit a compatible parent edge; otherwise use the Cineserye default `right → left`.
3. Place horizontal children in a vertical sibling lane to the right of the parent. Place vertical children in a horizontal row below the parent.
4. Add only the new node and edge when a stable sibling lane exists; do not reflow accepted or locked nodes.
5. Apply the policy to scene, shot, character, location, prop, visual-element, and note creation. Preserve generic image/free-form child and sibling behavior.
6. Keep every creation as one validated, undoable command proposal and retain automatic Project Outline updates.

## Use cases

- Adding Scene 02 from either Story or Scene 01 connects Story.right → Scene 02.left and stacks it in the existing scene lane.
- Adding Scene 03 from Scene 02 still resolves Story as its parent; it never creates a Scene 02 → Scene 03 hierarchy.
- Adding a shot joins the established shot lane of its Scene and inherits that lane’s direction.
- Adding characters, locations, props, visual elements, or notes joins same-role siblings without overlapping another visible node.
- A vertical legacy branch stays vertical because new siblings inherit its explicit bottom/top routing.

## Acceptance criteria

- [x] AC-PAL-01: Every new Scene has the Story as its semantic edge source regardless of which Story/Scene action created it.
- [x] AC-PAL-02: Scene siblings inherit the existing Story → Scene connector handles; the default horizontal route is `right → left`.
- [x] AC-PAL-03: New scene siblings occupy one collision-free scene lane without moving the accepted production workspace.
- [x] AC-PAL-04: Shots inherit their Scene’s established shot lane and connector direction.
- [x] AC-PAL-05: Character, Location, Prop, Visual Element, and Note children use the same parent-aware policy.
- [x] AC-PAL-06: Explicit vertical legacy branches retain `bottom → top` routing.
- [x] AC-PAL-07: Locked nodes, unrelated free-form branches, reference edges, and sequence edges remain unchanged.
- [x] AC-PAL-08: Creation remains atomic and supports undo, redo, autosave reload, and `.cineserye` restoration.
- [x] AC-PAL-09: Project Outline updates immediately with the correct parent/group while Layers retains technical controls.
- [x] AC-PAL-10: Compatibility, TypeScript, lint, unit/integration, build, client-boundary, audit, and Chromium/Firefox/WebKit regressions pass in Fixture mode without provider calls.

## Test matrix

- Unit: horizontal default, same-role inheritance, vertical inheritance, role-specific lanes, collision avoidance, semantic parent resolution, locked/unrelated stability, and 500-node budget.
- Browser: add three scenes, add shots to different scenes, add production entities and a note, verify handles/parents, undo/redo, reload, Project Outline, and non-overlap.
- Regression: generated proposal acceptance, mixed accepted/manual canvas, Tidy, visibility reveal, raw image/free-form creation, accessibility, persistence, and full cross-browser suite.

No provider request, credit use, Google Cloud mutation, authentication, synchronization, or deployment is part of this change.

## Acceptance evidence

- Parent-aware planner unit coverage: horizontal defaults, accepted scene/shot/prop lanes, every production role and notes, vertical legacy inheritance, collision avoidance, missing parents, and reference/sequence isolation.
- Browser coverage: semantic parents, right/left handles, aligned scene and shot lanes, accepted-host stability, undo/redo, autosave/reload, recovery, and automatic Project Outline updates.
- Visual Fixture verification: added Scene 02 to the accepted sample, then added Shot 07; both followed their parent-owned horizontal lanes without changing accepted nodes.
- Vinext compatibility: 100% (9 supported, 0 partial, 0 issues).
- TypeScript, ESLint, client/server provider boundary, and production build: passed.
- Unit/integration: 208 passed, 3 intentionally skipped live-provider tests.
- Playwright: 199 passed across Chromium, Firefox, and WebKit; 2 intended non-Chromium stress skips. The 500-layer/800-connector stress case passed in Chromium.
- Dependencies were not changed; the synchronized baseline's high-severity audit remains applicable. A fresh registry audit was attempted, but npm's retiring audit endpoint first rejected the installed tree because of pre-existing extraneous Vinext packages, then did not return for a package-lock-only retry.
- Provider mode: Fixture. Vertex, Parallel, storyboard, video, and managed-evaluation calls: none.
