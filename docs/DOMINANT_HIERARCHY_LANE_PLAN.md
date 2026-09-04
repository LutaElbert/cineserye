# Dominant Hierarchy Lane Implementation Plan

Status: Complete

Baseline: `08dc2bdea12b5ef8083b1a5b4d0c8db2e18a9710`

## Problem

The hierarchy organizer currently uses the first narrative Scene for both connector direction and lane coordinates. If Scene 01 is dragged away from four otherwise aligned siblings, Sparkle preserves the outlier coordinate and can leave Scene 01 detached from the established Scene lane.

## Goal

Separate orientation from placement: the canonical narrative Scene connection determines whether Scenes are arranged to the right of or below the Story, while the dominant aligned sibling cluster determines the lane coordinate and starting position. Sparkle then restores outliers to narrative order in one reversible action.

## Layout contract

1. Keep the first narrative Scene connector as the canonical orientation signal.
2. For a right-facing hierarchy, cluster Scene `x` coordinates and use the strongest cluster as the vertical Scene lane.
3. For a bottom-facing hierarchy, cluster Scene `y` coordinates and use the strongest cluster as the horizontal Scene lane.
4. Rank candidate lanes by sibling support, then canonical-Scene membership, then total movement distance, then coordinate for deterministic ties.
5. Use a small alignment tolerance so minor hand-placement differences count as one lane, but clearly separated branches do not.
6. Anchor the ordered run at the dominant cluster's earliest perpendicular extent instead of the dragged canonical Scene's position.
7. Arrange Scenes by production order when available, otherwise by Scene number with stable fallback ordering.
8. Recenter a movable Story against the final Scene run and keep the correct parent-to-child level gap.
9. Keep eligible Scene descendants attached and collision-free while reflowing their branch; never move locked or accepted/provider-owned nodes.
10. Apply node and connector repairs through the existing single Sparkle history transaction and reuse the planner for typed Scene insertion.

## Test cases

- Right-facing majority: Scene 01 is dragged left while Scenes 02–05 share a right-side `x`; Sparkle returns Scene 01 to that lane and orders 01–05 top-to-bottom.
- Bottom-facing majority: Scenes 01–03 share a lower `y` while Scenes 04–05 are outliers; Sparkle returns all five to one row and orders 01–05 left-to-right.
- Minor drift: near-aligned sibling coordinates within tolerance form one lane and resolve to an existing representative coordinate.
- Tie: equally supported lanes prefer the one containing the canonical Scene, then the lower movement-cost candidate, with a stable coordinate fallback.
- Fully scattered: the deterministic tie rule produces the same result regardless of raw edge order.
- Branch integrity: editable Scene subtrees remain attached and collision-free through the orientation-aware reflow.
- Protected content: locked and accepted/provider-owned branches remain fixed; their connectors are not rewritten.
- Isolation: reference, sequence, unrelated freeform, and non-Scene relationships remain unchanged.
- History and persistence: one Sparkle click is undoable/redoable and survives reload.
- Typed insertion: a new Scene joins the dominant sibling lane rather than inheriting an outlier's coordinate.
- Regression: existing accepted-plan, Scene-child centering, Project Outline, accessibility, and stress behavior remain green.

## Acceptance criteria

- [x] AC-DL-01: A lone dragged Scene cannot override a lane supported by more direct Scene siblings.
- [x] AC-DL-02: Right-facing Scene groups align vertically and follow narrative order from top to bottom.
- [x] AC-DL-03: Bottom-facing Scene groups align horizontally and follow narrative order from left to right.
- [x] AC-DL-04: The canonical connector controls orientation without controlling the dominant lane coordinate.
- [x] AC-DL-05: Lane selection is tolerant of minor drift, deterministic for ties, and idempotent after application.
- [x] AC-DL-06: A movable Story is centered against the complete arranged Scene run with the required hierarchy gap.
- [x] AC-DL-07: Eligible Scene descendants remain attached and collision-free through the orientation-aware reflow.
- [x] AC-DL-08: Locked and accepted/provider-owned nodes and protected connectors remain unchanged.
- [x] AC-DL-09: Adding a Scene reuses the same dominant-lane policy in one atomic creation transaction.
- [x] AC-DL-10: Sparkle repair remains one undoable/redoable transaction and persists after reload.
- [x] AC-DL-11: Unrelated and non-structural relationships remain unchanged.
- [x] AC-DL-12: TypeScript, ESLint, unit/integration, build, provider-boundary, Vinext, and cross-browser Fixture gates pass without Google Cloud, deployment, or paid-provider calls.

## Acceptance evidence

- Lane selection scores existing Scene coordinates within a 32 px alignment tolerance. Support count wins first; canonical membership, in-cluster movement, total movement, coordinate, and stable input order provide deterministic tie-breaking.
- Unit coverage reproduces the user's dragged Scene 01 against four aligned right-side siblings and verifies that all five return to the dominant `x` lane in top-to-bottom narrative order.
- Unit and browser coverage reproduce three aligned Scenes below the Story with two outliers and verify one shared `y` row in left-to-right narrative order.
- Both orientations recenter a movable Story against the final Scene run and preserve the hierarchy level gap.
- Reapplying the planner after either orientation produces no position or connector changes.
- Typed insertion coverage proves a new Scene joins the sibling-supported lane and repairs a displaced Scene 01 instead of amplifying its outlier coordinate.
- Existing locked/accepted-host, mixed-handle, reference/sequence isolation, Scene-child centering, collision, Undo/Redo, and reload tests remain green.
- Visual Fixture verification on the saved five-Scene canvas produced a centered Story above one ordered Scene row with a clean branching connector.
- TypeScript, ESLint, client/server provider-boundary validation, Vinext compatibility (`100%`, 9 supported, 0 issues), production build, and `git diff --check` passed.
- Unit/integration: 226 passed; 3 live-provider tests intentionally skipped.
- Playwright: 214 passed across Chromium, Firefox, and WebKit; 2 intended non-Chromium stress skips. One unrelated Firefox video-retry timing miss on the first parallel run passed twice in isolation and passed on the complete rerun.
- All runtime verification used Fixture mode. No Google Cloud mutation, live-provider request, deployment, or paid call occurred.

No Google Cloud mutation, live research, live planning, storyboard generation, video generation, deployment, or paid-provider request is authorized by this plan.
