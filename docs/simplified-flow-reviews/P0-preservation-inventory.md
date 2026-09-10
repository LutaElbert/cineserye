# P0 preservation inventory — work in progress

Baseline: private main `23af84303dd7571932e9faa94c80b2fd9b84d497`. Implementation worktree: `codex/simplified-flow`. This is a retention map, not a claim that the new journey or all tests pass. No baseline action is authorized for removal merely because it is secondary.

| Action / invariant | Existing ownership and characterization | Intended retained location |
| --- | --- | --- |
| Typed Story, Scene, Shot, Character, Asset, Note; parent/child/sibling links | `app/editor/cinema-domain-commands.ts`; `e2e/manual-creation-recovery.spec.ts` | Canvas Add / Outline; manual path in stages |
| Select, drag, zoom, resize, text/format/checklist, locks, hide, duplicate, delete | `canvas-commands.ts`, `layer-editing.ts`; `e2e/canvas-behavior.spec.ts`, `layer-behavior.spec.ts`, `layer-gestures.spec.ts` | Canvas, keyboard, Properties |
| Connect/reconnect, reverse edges, delete and undo/reload | `graph-rules.ts`; `e2e/layer-behavior.spec.ts` | Canvas; stable world-space positions |
| Nonlinear hierarchy, narrative order, draft placement, Outline / flat Layers | `cinema-hierarchy.ts`, `cinema-workspace-placement.ts`; `e2e/manual-creation-recovery.spec.ts` | Outline and Canvas, not a parallel stage store |
| Premise, timing, format, genres and local attachment aliases | `StoryComposer.tsx`; `e2e/story-composer.spec.ts` | Idea |
| Explicit Surprise confirmation; no implicit scene insertion | `useStoryAssistant.ts`, `story-development-commands.ts`; `e2e/story-assistant.spec.ts`, `story-development.spec.ts` | Idea / Plan |
| Continue after reviewed scene; additional runtime; unknown allocation correction | `AssistantSceneStage.tsx`, `SceneAllocationCorrection.tsx`; `e2e/story-revision-history.spec.ts`, `story-development.spec.ts` | Plan |
| Local full brief, reference notes (including audio-direction notes), purpose-specific permissions | `StoryDevelopmentPanel.tsx`, `StoryReferencePermissions.tsx`; `e2e/story-development.spec.ts`, `story-composer.spec.ts` | Secondary Story tools and Plan; never remove manual entry when AI blocked |
| Edit/reorder/select some proposals; confirm duration mismatch; one batch/undo | `story-development-commands.ts`, `AssistantSceneStage.tsx`; `e2e/story-development.spec.ts`, `assistant-compact-review.spec.ts` | Plan |
| Saved draft lineage, older/stale review, scoped revision, unselected proposals | `StoryRevisionHistory.tsx`, `story-revision-history.test.ts`; `e2e/story-revision-history.spec.ts` | Plan / saved drafts; no POST on review |
| Explicit scoped shot planning, separate proposed/accepted plans | `AssistantShotPlanning.tsx`, `scoped-shot-commands.ts`; `e2e/scoped-shot-assistant.spec.ts` | Plan |
| Research sources and planning assumptions, transfer review | `SceneBriefDialog.tsx`, `CinemaInspector.tsx`; `e2e/scene-planner.spec.ts`, `story-workflow-safety.spec.ts` | Plan and advanced inspector |
| Professional table/board and synchronized shot edits | `ProfessionalPlanningWorkspace.tsx`; `e2e/professional-planning.spec.ts` | Advanced planning views |
| Separate production/narrative order, camera/lighting setups | `domain/cinema/professional-planning.ts`; `e2e/professional-planning.spec.ts` | Advanced planning views; never conflate render order |
| Continuity review, shared identity variants, exceptions and audit undo | `ProjectProductionWorkspace.tsx`, `domain/cinema/continuity-audit.ts`; `e2e/multi-scene-project.spec.ts` | Plan / advanced production |
| Story → Scene → Shot reference inheritance, replace/exclude/reset, historical versions | `domain/cinema/story-workflow.ts`, `story-reference-bridge.ts`; `e2e/story-development.spec.ts`, `visual-preproduction.spec.ts` | References with purpose-specific transfer review also in Plan |
| Images: local import/validation, variants, approve/reject, individual download | `VisualPreproductionPanel.tsx`; `e2e/visual-preproduction.spec.ts` | References; media bytes remain local |
| Videos: quote/consent, cancellation/recovery/retry, approve/reject, individual download and metadata | `VideoPreproductionPanel.tsx`, `video-storage.ts`; `e2e/video-preproduction.spec.ts`; `video-safety.test.ts` | Video; unknown costs/outcomes stay unknown |
| Sequence, current approved take validation, trims, silent local MP4 download | `SequenceReview.tsx`, `sequence-manifest.ts`, server `assembly.ts`; `assembly.test.ts` | Final Cut; 720p/24fps, ≤24 clips/120s, no audio/captions/transitions |
| Revision-specific six-file planning handoff | `domain/cinema/handoff.ts`; `handoff.test.ts` S5-IT-02; `e2e/professional-planning.spec.ts` | Advanced planning export; CSV/PDF/Markdown/JSON archive preserved |
| Canvas SVG export and safe URLs/text | `export-svg.ts`, `export-svg.test.ts`; `e2e/editor.spec.ts` | Project actions |
| Save, undo/redo, checkpoint, new/empty recovery, backup/restore | `persistence.ts`, `document-file.ts`; `story-workflow-persistence.test.ts`, `e2e/editor.spec.ts`, `story-data-foundation.spec.ts` | Shared document controller and project actions |
| Origin-wide writer lock and compare-and-swap | `useDocumentWriter.ts`, `persistence.ts`; `e2e/story-development.spec.ts`, `story-data-foundation.spec.ts` | Unchanged exclusive writer policy |
| Reachability roots, explicit cleanup confirmation, transactional recheck/lease | `media-reachability.ts`, `useMediaRetentionLease.ts`; `e2e/story-workflow-safety.spec.ts` SAFE-07 | Project/media recovery; never automatic on navigation |
| Backup image bytes vs video metadata vs excluded cut files | `document-file.ts`, `video-storage.ts`; `story-workflow-persistence.test.ts`, `e2e/visual-preproduction.spec.ts` | Backup disclosure and empty-store restore; P2/P5 add integrated evidence |
| Keyboard, focus, short/mobile, reduced motion, a11y | `e2e/accessibility.spec.ts`, `editor-focus.spec.ts`, `assistant-short-height.spec.ts` | All retained surfaces and five stages |
| 500-node/800-edge Assistant and hierarchy scale | `e2e/story-assistant-stress.spec.ts`, `stress.spec.ts`, `cinema-hierarchy.test.ts` | Same fixtures/budgets; no downsizing |

## Discovered baseline issues

1. Pointer tests read coordinates during first-run fit animation. Actionability settling repaired the original six focused failures (54/54 runs across three engines, no retries).
2. Ten suites used port 3040 as a safety switch and skipped on the CI Worker port. Named runtime lanes now replace that implicit coverage loss; full matrices are still in progress.
3. Three storage integration cases imported development-only `/app/*.ts` URLs. The test harness now bundles the real modules for browser/IndexedDB testing without production test routes.
4. StoryComposer omitted note-library access without an uploaded image and ignored its `onDiscard` prop. Secondary Story tools restore these actions. The earlier manual full-brief workflow was also unreachable from the compact Assistant; the same existing panel is retained under explicit advanced tools, not duplicated as a new implementation.
5. Older selectors assume always-open shot fields, removed Story toolbar actions and 4-second sample video defaults. Migration retains geometry, consent, reference, reload and generation assertions; current sample shot needs 8 seconds because its plan is 7 seconds.

## Baseline comparison protocol (P0.9 / P3.9)

Freeze before P3: five identical fixtures/tasks at 1440×900 on native fixture build. Count only deliberate navigation clicks/panel switches separately from content editing, consent and acceptance. Record next-action latency as automation timing (not a user study), competing primary actions and selection prerequisites. Persist raw baseline/candidate measurements and action logs; do not infer usability from total test duration.

1. New idea → accepted shot plan (`scoped-shot-assistant.spec.ts`).
2. Reopen and partially accept a saved draft (`story-revision-history.spec.ts`).
3. Locate a blocked capability (`story-assistant.spec.ts`, mocked disabled-live discovery; no live call).
4. Reconcile interrupted work after reload (`story-assistant.spec.ts`, durable GET recovery).
5. Find a usable take → local cut (`SequenceReview.tsx`, synthetic local media; existing fixture sample is not production footage).

Measurements are NOT VERIFIED yet. The P0 gate must not pass until the repaired baseline has measured action logs, including an honest blocked result if a baseline task cannot finish. P3 candidate must remove navigation steps in at least one task and add none without reviewed justification. User walkthrough and visual approval remain mandatory.
