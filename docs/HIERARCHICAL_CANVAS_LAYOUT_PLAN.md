# Cineserye hierarchical canvas layout implementation plan

**Plan date:** 2026-09-03

**Baseline:** `6c83f81e1db00266042a33e60252f9b564b82187`

**Status:** Complete and verified

**Completion evidence (2026-09-03):** The editor now resolves Story/Scene ownership semantically, recursively packs mixed-height scene and shot subtrees, preserves the Story anchor and locked/unrelated layers, normalizes affected hierarchy connectors through an allowlisted atomic edge command, and rechecks spacing when a hidden cinema layer is shown. Creation, reflow, connector routing, undo/redo, IndexedDB persistence, and reload are covered together in Chromium, Firefox, and WebKit. The final gates passed with 191 unit/integration tests and three intentional live-provider skips, 190 browser tests and two intended non-Chromium stress skips, 100% Vinext compatibility, TypeScript, ESLint, production build, and the client/server provider-boundary scan. The high-severity dependency gate has no high or critical findings; 13 moderate transitive ADK/OpenTelemetry and `gaxios`/`uuid` findings remain because the available complete remediation is breaking. All acceptance runs used the local fixture harness; no provider or Google Cloud operation succeeded, no credits were consumed, and nothing was deployed.

## 1. Outcome

Adding a scene or shot must preserve the visible filmmaking hierarchy automatically:

```text
Story Premise
├── Scene 01
│   ├── Shot 01
│   └── Shot 02
└── Scene 02
    ├── Shot 01
    └── Shot 02
```

The selected layer determines the requested action, but the semantic ancestry determines ownership:

- **Add shot** on a scene creates a direct `Scene → Shot` hierarchy edge.
- **Add next shot** on a shot resolves that shot's owning scene and creates another child of that scene.
- **Add next scene** on a scene resolves its owning story and creates another child of that story.
- Scene and shot order remain in the cinema domain records; a hierarchy edge does not pretend to be a chronological transition.

The affected Story subtree is repacked using actual node dimensions. Existing hierarchy connectors in that subtree are normalized to the same routing direction, eliminating the mixed right-to-left and bottom-to-top paths visible in the reported screenshots.

## 2. Problem statement

The current `relativeConceptLayout` function is parent-aware for one generation, but three gaps remain:

1. The initial `Story Premise → Scene 01 → Shot 01` connectors use horizontal handles, while manually added children use vertical handles.
2. Immediate siblings are repacked without accounting for the width of their descendants. A scene with several shots can therefore overlap the shot subtree of another scene.
3. Generic incoming-edge lookup uses the first matching edge. A cinema node with reference or user-authored connectors can resolve the wrong structural parent.

This is primarily a hierarchy-planning problem, not a React Flow rendering problem.

## 3. Terminology

- **Hierarchy edge:** An ownership relationship such as Story→Scene or Scene→Shot.
- **Semantic parent:** The valid filmmaking owner determined from node roles and hierarchy edges, not visual proximity.
- **Subtree:** One node plus every hierarchy descendant beneath it.
- **Ancestor-aware reflow:** Recalculating layout from the nearest Story root so descendant size changes are reflected in sibling spacing.
- **Structural connector normalization:** Updating only hierarchy-edge handles and routing while preserving its ID, label, style, marker, and other user-visible properties.

## 4. Scope

### In scope

- Story, scene, and shot hierarchy resolution.
- Automatic parent resolution for toolbar, node-action, and creation-palette entry points.
- Dimension-aware Story subtree packing.
- Consistent bottom-to-top hierarchy connectors.
- Lazy migration of legacy starter hierarchy edges when an affected branch is edited.
- One atomic and undoable creation/reflow operation.
- Locked, hidden, collapsed, malformed, and partially disconnected graph behavior.
- Unit, integration, accessibility, performance, and Chromium/Firefox/WebKit coverage.

### Out of scope

- Redesigning the canvas or changing React Flow.
- Converting arbitrary user connectors into hierarchy edges.
- Adding chronological Shot→Shot or Scene→Scene sequence connectors.
- Repositioning agent-run, character, location, prop, visual-element, reference-image, or unrelated note branches.
- Automatically moving locked layers.
- Changing cinema-domain narrative or production order as a side effect of visual layout.
- AI, provider, Google Cloud, storage, or deployment work.

## 5. Architecture decisions

### 5.1 Explicit hierarchy classification

Extend `EditorEdgeData` with an optional relationship field:

```ts
relationship?: 'hierarchy' | 'reference' | 'sequence'
```

New Story→Scene and Scene→Shot connections are written as `hierarchy`. Existing documents remain valid because the field is optional.

For legacy edges without the field, classify an edge as hierarchy only when both endpoints form one of these unambiguous role pairs:

- `cinema.story → cinema.scene`
- `cinema.scene → cinema.shot`

Do not infer hierarchy from position, label, connector direction, or creation time.

### 5.2 Semantic ancestry resolver

Introduce a pure resolver that returns:

```ts
type CinemaHierarchyResolution = {
  selectedId: string;
  selectedRole: 'story' | 'scene' | 'shot';
  parentId: string | null;
  storyRootId: string | null;
  targetParentId: string;
  insertionIndex: number;
};
```

Resolution rules:

| Action | Selected role | Target parent | Insertion position |
| --- | --- | --- | --- |
| Add scene | Story | Selected Story | After its final scene |
| Add next scene | Scene | Owning Story | Immediately after selected scene |
| Add shot | Scene | Selected Scene | After its final shot |
| Add next shot | Shot | Owning Scene | Immediately after selected shot |

If the required semantic parent is missing or ambiguous, creation is blocked with an actionable message rather than creating a visually plausible but structurally incorrect node.

### 5.3 Recursive subtree packing

Replace the cinema path through `relativeConceptLayout` with a pure Story-tree planner:

1. Build the hierarchy tree from visible Story, Scene, and Shot nodes.
2. Calculate each node's real dimensions through `editorNodeDimensions`.
3. Calculate subtree width bottom-up:
   - a Shot subtree is its node width;
   - a Scene subtree is the larger of the scene width or its packed shot-row width;
   - a Story subtree is the larger of the story width or its packed scene-subtree widths.
4. Keep the Story node anchored at its current position.
5. Position scenes on the next level with a stable branch gap.
6. Position each scene's shots on the following level inside that scene's allocated subtree.
7. Test proposed rectangles against locked-node obstacles and increase spacing without moving the locked node.

The planner returns positions and connector patches; it does not mutate editor state.

### 5.4 Smallest safe affected scope

- Adding a Shot reflows its owning Story subtree when a Story ancestor exists.
- If a valid Scene has no Story ancestor, only that Scene subtree is reflowed.
- Adding a Scene reflows only its owning Story subtree.
- Other roots and unrelated generic canvas content retain byte-equivalent node positions and edge data.
- Hidden descendants remain attached but are excluded from visible spacing until shown.
- Collapsed branches keep their stored child positions; expanding later runs collision validation before display.

### 5.5 Consistent connector routing

Every affected hierarchy edge uses:

```ts
sourceHandle: 'bottom'
targetHandle: 'top'
type: 'smoothstep'
```

All siblings share their parent's source-side trunk visually and branch toward their own top handles. Edge IDs, labels, kinds, animation, stroke styles, markers, and selection state are preserved.

### 5.6 Atomic command boundary

Add an allowlisted `update-edge` canvas command so the operation can include:

1. moves for affected unlocked nodes;
2. creation of the new scene or shot;
3. creation of its hierarchy edge;
4. normalization of affected legacy hierarchy edges.

The complete proposal is validated against a clone and committed as one history entry. Undo restores the prior node positions, connectors, and document data together; redo reapplies the exact deterministic result.

## 6. Work packages

### HL-1 — Hierarchy contract and legacy classification

Files:

- `app/editor/types.ts`
- `app/editor/document-file.ts`
- `app/domain/cinema/manual-creation.ts`
- new `app/editor/cinema-hierarchy.ts`

Tasks:

- Add the optional edge relationship field and strict validation.
- Implement role-pair classification for legacy edges.
- Resolve Story and Scene ancestry without using arbitrary incoming connectors.
- Detect missing, duplicate, cyclic, or ambiguous ownership.
- Keep imported schema-version-5 projects backward compatible.

### HL-2 — Ancestor-aware layout planner

Files:

- `app/editor/node-layout.ts`
- new `app/editor/cinema-hierarchy-layout.ts`
- corresponding unit tests

Tasks:

- Calculate recursive subtree widths from measured or styled dimensions.
- Preserve sibling order from current cinema records, with canvas order as the legacy fallback.
- Anchor the hierarchy root and produce deterministic positions.
- Avoid node overlap with configured horizontal and vertical clearances.
- Respect locked obstacles and exclude hidden nodes from visible packing.
- Return edge-routing patches separately from node positions.

### HL-3 — Validated atomic edge updates

Files:

- `app/editor/canvas-commands.ts`
- `app/editor/canvas-commands.test.ts`
- `app/editor/document-file.ts`

Tasks:

- Add and strictly parse `update-edge`.
- Allow only endpoints, handles, type, selected safe presentation fields, and relationship metadata.
- Re-run graph validation after every edge patch.
- Reject unknown, locked-endpoint, self, duplicate, or over-broad updates.
- Include updated connector IDs in the affected-record summary.

### HL-4 — Creation-flow integration

Files:

- `app/editor/Editor.tsx`
- `app/domain/cinema/manual-creation.ts`
- `app/editor/cinema-domain-commands.ts` only if scene/shot order needs an explicit synchronized command

Tasks:

- Route Add shot, Add next shot, Add scene, Add next scene, and palette creation through the hierarchy resolver.
- Generate the new node, positions, hierarchy edge, and legacy edge patches in one proposal.
- Preserve edit-after-create and focus behavior.
- Fit the viewport to the created node without losing the user's zoom after editing begins.
- Announce blocked ancestry and successful placement accessibly.

### HL-5 — Migration and recovery behavior

Files:

- `app/editor/persistence.ts`
- `app/editor/document-file.ts`
- migration and backup tests

Tasks:

- Keep untouched legacy projects visually unchanged on load.
- Normalize only the affected Story subtree on the first structural creation beneath it.
- Preserve the normalized result through IndexedDB, reload, and `.cineserye` backup/restore.
- Ensure undo immediately after lazy normalization returns to the exact imported layout.

### HL-6 — Browser verification and closure

Files:

- `e2e/manual-creation-recovery.spec.ts`
- `e2e/layer-behavior.spec.ts`
- `e2e/accessibility.spec.ts`
- `e2e/stress.spec.ts`

Tasks:

- Add the reported two-shot and two-scene scenarios.
- Assert semantic edge endpoints and handles, not screenshot coordinates alone.
- Measure every visible Story/Scene/Shot rectangle and require zero intersections.
- Verify keyboard and 390px behavior.
- Run the complete existing compatibility, TypeScript, lint, unit, build, boundary, audit, and three-browser regression gates.

## 7. Data flow

```text
Creator selects Scene 01 and chooses Add shot
  → resolve selected role and semantic ancestry
  → choose Scene 01 as owner and Story Premise as reflow root
  → create provisional Shot 02
  → build Story/Scene/Shot hierarchy including Shot 02
  → measure nodes and calculate subtree widths
  → plan deterministic node positions and hierarchy-edge patches
  → compile one CanvasCommandProposal
  → validate on cloned EditorDocument
  → commit one history entry
  → persist through normal IndexedDB autosave
  → focus Shot 02 editor and fit it into view
```

No provider, agent, network, or cloud boundary participates in this flow.

## 8. Use-case scenarios

### UC-HL-01 — Add a second shot

The creator selects Scene 01 and chooses **Add shot**. Shot 02 appears as a direct child of Scene 01 beside Shot 01. Both connectors leave Scene 01 from the bottom and enter their shots from the top. Neither shot overlaps the other or its editor toolbar.

### UC-HL-02 — Add the next shot from an existing shot

The creator selects Shot 01 and chooses **Add next shot**. Cineserye resolves Scene 01 as the semantic parent, inserts Shot 02 after Shot 01, and never creates a Shot 01→Shot 02 hierarchy edge.

### UC-HL-03 — Add a second scene

The creator selects Scene 01 and chooses **Add next scene**. Cineserye resolves Story Premise as the parent and creates Story Premise→Scene 02. Both scene subtrees are repacked so their shots cannot overlap.

### UC-HL-04 — Add shots under two scenes

Scene 01 and Scene 02 each contain several mixed-height shots. Adding another shot to Scene 01 expands its allocated subtree and shifts only movable nodes inside the same Story hierarchy. Scene 02 and its shots remain grouped together with stable order.

### UC-HL-05 — Work around a locked layer

A shot in the affected Story subtree is locked. Cineserye does not move it. The planner expands or shifts the movable branch to maintain clearance. If no safe placement exists within the bounded search, creation is blocked without modifying the document.

### UC-HL-06 — Preserve an intentional connector

The creator has drawn a custom Scene 01→Reference Note connector. Adding Shot 02 does not reinterpret, reroute, relabel, or delete that connector because its endpoint roles do not form an allowlisted hierarchy pair.

## 9. Acceptance criteria

### Hierarchy correctness

- Every newly created Scene has exactly one Story hierarchy parent when a Story is available.
- Every newly created Shot has exactly one Scene hierarchy parent.
- Add next scene never creates Scene→Scene ownership.
- Add next shot never creates Shot→Shot ownership.
- Parent resolution ignores unrelated incoming reference and user-authored connectors.
- Ambiguous or invalid ownership blocks creation and leaves the document unchanged.

### Layout correctness

- All visible Story, Scene, and Shot rectangles in the affected hierarchy have at least the configured clearance and do not overlap.
- Layout uses measured/styled width and height, including nodes expanded by rich-text editing.
- Adding a child accounts for both its siblings and their descendants.
- The Story root remains anchored unless the user explicitly invokes global Tidy.
- Unrelated roots, images, notes, agent runs, and production entities do not move.
- Hidden nodes do not reserve visible space; showing them triggers a safe collision check.
- Locked nodes retain their exact positions.

### Connector correctness

- Every affected Story→Scene and Scene→Shot hierarchy connector uses bottom-to-top smooth-step routing.
- Existing hierarchy connector IDs, labels, kinds, markers, animation, and styles survive normalization.
- Arbitrary connectors remain byte-equivalent.
- No connector crosses through the bounding rectangle of a visible Story, Scene, or Shot node, excluding its own endpoints.

### State and command safety

- Creation, reflow, and connector normalization commit as exactly one undo entry.
- One Undo restores the byte-equivalent pre-action nodes and edges; one Redo restores the planned result.
- IndexedDB reload and `.cineserye` backup/restore preserve hierarchy metadata and positions.
- Invalid command proposals cannot update arbitrary edge fields or bypass graph validation.
- Cinema narrative and production order change only through their explicit domain commands.

### Interaction and accessibility

- Toolbar, node action, creation palette, keyboard, and mobile entry points produce the same hierarchy result.
- Focus enters the new node's title editor and returns predictably after commit or cancel.
- Success and ancestry errors are announced through the existing live region.
- Primary creation remains usable at a 390px viewport and under enlarged text/reduced motion.

### Performance and compatibility

- Planning and validating a 10-scene/100-shot Story hierarchy completes in under 100ms in the deterministic unit benchmark.
- The existing 500-layer/800-edge global Tidy threshold does not regress by more than 15%.
- Chromium, Firefox, and WebKit produce the same semantic hierarchy and non-overlap result.
- The generic canvas remains capable of free-form connections and cycles outside classified cinema hierarchy edges.

## 10. Test matrix

| ID | Level | Test |
| --- | --- | --- |
| HL-UT-01 | Unit | Legacy Story→Scene and Scene→Shot edges classify as hierarchy; other role pairs do not. |
| HL-UT-02 | Unit | Add-next-scene resolves the owning Story through the selected Scene. |
| HL-UT-03 | Unit | Add-next-shot resolves the owning Scene through the selected Shot. |
| HL-UT-04 | Unit | Unrelated incoming connectors do not change the resolved semantic parent. |
| HL-UT-05 | Unit | Missing, duplicate, and cyclic hierarchy parents return deterministic blocking errors. |
| HL-UT-06 | Unit | Recursive subtree widths prevent collisions across two scenes with mixed-height shots. |
| HL-UT-07 | Unit | Root anchoring, order, gaps, and results are deterministic across repeated runs. |
| HL-UT-08 | Unit | Hidden descendants are excluded; locked obstacles remain fixed and receive clearance. |
| HL-UT-09 | Unit | Edge patches normalize handles/type while preserving IDs and presentation data. |
| HL-SEC-01 | Security | `update-edge` rejects unknown fields, endpoints, duplicates, self-links, and locked endpoints. |
| HL-IT-01 | Integration | Add Shot creates node, direct Scene edge, family reflow, and normalized connectors atomically. |
| HL-IT-02 | Integration | Add next Scene creates a Story sibling and reflows both complete scene subtrees. |
| HL-IT-03 | Integration | Undo/redo restores nodes, edge routing, selection, and cinema order exactly. |
| HL-IT-04 | Integration | Lazy legacy normalization persists through reload and portable backup/restore. |
| HL-IT-05 | Integration | Creation failure leaves node, edge, history, cinema, and save state byte-equivalent. |
| HL-E2E-01 | Browser | Reproduce Image 2: add Shot 02 and assert direct parent, consistent handles, and zero overlap. |
| HL-E2E-02 | Browser | Add Scene 02, then shots to both scenes, and assert subtree grouping and zero overlap. |
| HL-E2E-03 | Browser | Add next shot from Shot 01 and prove no Shot→Shot ownership edge exists. |
| HL-E2E-04 | Browser | Lock a shot, add a sibling, and prove the locked rectangle does not move or overlap. |
| HL-E2E-05 | Browser | Undo, redo, reload, and backup/restore retain the exact hierarchy and layout. |
| HL-A11Y-01 | Accessibility | Keyboard-only creation, focus, announcements, and error recovery work at desktop and 390px. |
| HL-PERF-01 | Performance | 10-scene/100-shot hierarchy planning and validation complete under 100ms. |
| HL-REG-01 | Regression | Generic child/sibling notes and images retain their existing free-form behavior. |
| HL-REG-02 | Regression | Generated shot plans, continuity audit, Project/Table/Board views, exports, and persistence remain unchanged. |
| HL-REG-03 | Regression | Full 500-layer/800-edge and Chromium/Firefox/WebKit suites remain green. |

## 11. Implementation order and checkpoints

1. Implement and test hierarchy classification/resolution without changing the UI.
2. Implement the pure recursive layout planner and prove deterministic non-overlap fixtures.
3. Add the validated `update-edge` command and security tests.
4. Integrate one **Add shot** entry point and verify atomic undo/redo.
5. Integrate Add next shot, Add scene, Add next scene, and palette paths.
6. Add lazy legacy normalization, persistence, and backup tests.
7. Add three-browser use-case tests and run the complete regression matrix.

Stop after any checkpoint if generic canvas behavior, history atomicity, or saved-project compatibility regresses.

## 12. Demo gate

Use a clean `Story Premise → Scene 01 → Shot 01` document:

1. Add Shot 02 from Scene 01.
2. Add Shot 03 from Shot 02 using **Add next shot**.
3. Add Scene 02 from Scene 01 using **Add next scene**.
4. Add two mixed-height shots beneath Scene 02.
5. Show that every shot has its correct Scene parent, both scenes have the Story parent, all hierarchy connectors use consistent routing, and no visible nodes overlap.
6. Undo the last creation once and show that positions and connector routing return together.
7. Redo, reload, and confirm the organized hierarchy persists.

The feature is complete only when this demo passes in Chromium, Firefox, and WebKit alongside the entire existing regression suite.
