# Unified Project Outline Implementation Plan

Status: Complete

Baseline: `4efc9154f5ab828395ee90ad90ec24cb909b11d2`

Branch: `codex/unified-project-outline`

## Problem

Cineserye currently replaces the manual **Structure / Layers** sidebar with a structurally different **Project Outline** whenever a proposal preview or accepted revision exists. Draft nodes can appear to disappear, accepted totals can omit connected manual shots, and creators can mistake two browser-local documents for different application versions.

## Product decision

Use one permanent **Project Outline / Layers** shell. Project Outline is a derived, read-only projection that merges the validated canvas graph with cinema-domain production metadata by stable node ID. It is never persisted as a second hierarchy.

## Implementation

1. Build a unified outline model from nodes, semantic edges, optional cinema data, and optional proposal IDs.
2. Show every typed Story, Scene, Shot, Character, Location, Prop, Visual Element, and Note immediately, including drafts.
3. Enrich matching rows with proposed/accepted status, duration, cost, prompts, and sharing metadata without replacing their place in the tree.
4. Support multiple scenes, grouped scene children, and a visible **Needs attention** section for typed nodes without one valid scene/project parent.
5. Keep **Layers** as the flat technical stack and preserve its existing controls.
6. Recalculate the projection after every existing command, undo/redo, proposal transition, autosave reload, and backup restore. Add no new storage or mutation path.

## Use cases

- A creator starts a blank project and immediately sees Story → Scene → Shots in Project Outline.
- Generating a fixture proposal marks new rows Proposed; rejecting removes only those rows; accepting enriches them in place.
- Adding `Shot 07` after an accepted six-shot plan immediately changes the scene total to seven while retaining the six accepted shot statuses.
- A disconnected typed shot remains reachable under Needs attention with its graph warning.

## Acceptance criteria

- [x] AC-UPO-01: Project Outline is the primary sidebar before, during, and after planning; the header does not switch products.
- [x] AC-UPO-02: Layers remains available as a separate flat technical view in every planning state.
- [x] AC-UPO-03: Draft nodes appear immediately under their semantic Story/Scene and carry a Draft status.
- [x] AC-UPO-04: Proposal rows carry Proposed status and accepted rows retain production status without duplication.
- [x] AC-UPO-05: Scene shot totals include both connected draft shots and accepted cinema shots exactly once.
- [x] AC-UPO-06: Multiple scenes render in deterministic project order with their own grouped children and metrics.
- [x] AC-UPO-07: Ambiguous, cyclic, or disconnected typed items remain visible under Needs attention.
- [x] AC-UPO-08: Search preserves matching ancestor context; collapse, selection, focus, visibility, and locking remain accessible.
- [x] AC-UPO-09: Undo/redo, reload, `.cineserye` restore, proposal accept/reject, and manual creation automatically recalculate the outline.
- [x] AC-UPO-10: Compatibility, TypeScript, lint, unit/integration, build, dependency audit, and Chromium/Firefox/WebKit regression gates pass in Fixture mode without external calls.

## Test matrix

- Unit: draft-only hierarchy, accepted enrichment, draft-plus-accepted deduplication, multiple scenes, shared entities, search, unassigned warnings, deterministic ordering, and 500-node budget.
- Browser: new project → manual shot → proposal preview → reject; fixture acceptance → add shot; switch Project Outline/Layers; undo/redo; reload.
- Regression: canvas editing, semantic connections, proposal review, multi-scene planning, accessibility, persistence, backup/restore, and full cross-browser suite.

No provider call, Google Cloud change, credit use, authentication, synchronization, or deployment is part of this work.

## Completion evidence

- Vinext compatibility: 100%, 9 supported, 0 partial, 0 issues.
- TypeScript: passed.
- ESLint: passed with no warnings.
- Unit/integration: 205 passed; 3 live-provider tests intentionally skipped.
- Production build: passed.
- Client/server provider boundary: passed.
- Dependency audit: no high or critical findings; 13 moderate transitive ADK/OpenTelemetry and gaxios findings remain.
- Playwright: 199 passed across Chromium, Firefox, and WebKit; 2 non-Chromium stress tests intentionally skipped.
- Provider mode: Fixture. No provider, Google Cloud, managed evaluation, generation, deployment, or paid-credit call was made.
