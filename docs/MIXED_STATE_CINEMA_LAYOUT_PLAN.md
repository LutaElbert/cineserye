# Mixed-State Cinema Layout Implementation Plan

Status: Complete

Baseline: `d78b985a2f0dbc58cff86bf91b7259ac6ae51d72`

Branch: `codex/mixed-state-cinema-layout`

## Problem

Manual **Add shot** and **Add next scene** currently invoke the generic top-down Story hierarchy layout even after a scene has an accepted horizontal planning package. The hierarchy pass moves the Story/Scene hosts but does not own the accepted agent, context, and chronological-shot lanes, so their connectors stretch across the canvas. Generated titles also fall outside the manual `Scene 01` / `Shot 01` numbering parser and can produce duplicate draft numbers.

## Implementation

1. Extend draft numbering to recognize accepted `Scene 01 · Title` and `01 · Shot title` forms.
2. Add a cinema-aware additive insertion planner that activates only when a Story owns an accepted cinema project.
3. Keep accepted plan hosts fixed; place manual shots in a scene-local draft lane and new scenes below the complete planned workspace footprint.
4. Repack locked generated lanes around their existing scene anchor on reload so documents saved by the prior conflicting layout self-heal without moving creator-owned Story or Scene anchors.
5. Preserve the existing generic hierarchy planner for unplanned canvases.
6. Keep creation, connection, and any calculated position in one validated, undoable command.

## Use case

The creator accepts the six-shot fixture plan, selects the accepted scene, adds one manual shot, then adds the next scene. The result is `Shot 07` and `Scene 02`; the accepted planning package does not move, neither new node overlaps another node, and both connections retain their semantic parents.

## Acceptance criteria

- [x] AC-MSL-01: An accepted six-shot plan allocates the next manual shot as `Shot 07`.
- [x] AC-MSL-02: `Scene 01 · Title` allocates the next manual scene as `Scene 02`.
- [x] AC-MSL-03: Adding a manual shot or scene does not reposition accepted scene, agent, context, or generated-shot hosts.
- [x] AC-MSL-03A: Reload repairs displaced generated lanes around the persisted scene anchor without moving Story or Scene anchors.
- [x] AC-MSL-04: A manual shot connects to its selected Scene; a new Scene connects to the Story, never the previous Scene.
- [x] AC-MSL-05: New nodes do not overlap visible existing nodes, including mixed-height accepted hosts.
- [x] AC-MSL-06: Undo/redo, autosave, reload, and portable persistence retain the insertion and layout.
- [x] AC-MSL-07: The original unplanned Story → Scene → Shot automatic layout remains unchanged.
- [x] AC-MSL-08: Unit, Chromium/Firefox/WebKit, accessibility, build, and dependency gates pass in fixture mode without external calls.

## Regression tests

- Unit: accepted-title numbering; additive shot placement; additive scene placement; collision avoidance; generic fallback.
- Browser: explore accepted sample → Add shot → Add next scene → assert names, parents, stable accepted positions, no overlap, undo/redo, save/reload.
- Existing: manual hierarchy creation, structured outline, proposal acceptance, multi-scene workspace, and full cross-browser suite.

No provider call, Google Cloud change, credit use, or deployment is part of this fix.

## Completion evidence

- Vinext compatibility: 100%, with 9 supported features and no issues.
- TypeScript, ESLint, production build, and client/server provider-boundary checks: passed.
- Unit/integration: 201 passed; 3 opt-in live-provider tests intentionally skipped.
- Playwright: 199 passed across Chromium, Firefox, and WebKit; 2 intended non-Chromium stress tests skipped.
- Dependency audit: no high or critical findings; 13 moderate transitive ADK/OpenTelemetry and gaxios findings remain.
- The focused accepted-plan browser scenario verifies generated-aware numbering, semantic parents, stable accepted hosts, collision avoidance, undo/redo, autosave, and reload.
- Existing backup/restore regressions verify portable `.cineserye` persistence.
- All validation ran in Fixture mode. No external provider, Google Cloud, credit-consuming, or deployment action occurred.
