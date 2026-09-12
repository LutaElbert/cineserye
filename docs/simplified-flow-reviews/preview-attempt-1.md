# Simplified flow preview — implementation attempt 1

2026-09-10. Branch `feature/simplified-flow`, base HEAD `abfa0fab2fb26c775f639358521d9a29c3a6b640`. Uncommitted, private local work. This is a bounded opt-in preview, **not acceptance of P0, P3, or the complete implementation plan**. All 58 canonical criteria and their prerequisite gates remain in force.

## Scope and acceptance checks

- **S1:** Opt-in Story / Shots / Edit navigation changes session layout, not project content or provider operations. Original workspace remains available. Browser Back and outline inspection reveal a coherent surface.
- **S2:** Story uses the existing approved assistant workflow: idea → review → accept scenes. Acceptance is one undo step and survives redo/reload. Adding a missing premise preserves existing scenes, shots, assets and connections.
- **S3:** Shots shows actual ordered project records and local media, with explicit entry to existing shot/scene controls. Edit reuses the real silent sequence review; no fabricated timeline tools, media, progress or cost estimates.
- **S4:** Workspace status validates the existing capability contract, distinguishes fixture/configured-unverified/blocked, and treats failed or malformed discovery as unknown. Research is explicitly not yet integrated. Existing route-side approvals remain authoritative.
- **S5:** Hidden canvas cannot consume destructive keys, import paste/drop files, or create branches. Workspace navigation keeps operation owners mounted; simplified mode has one SequenceReview owner.
- **S6:** Desktop, short-window and mobile navigation, status-dialog keyboard focus and scoped serious/critical accessibility checks pass across Chromium, Firefox and WebKit. Typecheck, lint, boundary, fixture build and offline tests pass.

## Implementation choices and limitations

`?flow=simplified` enables the preview; `workspace=story|shots|edit` selects a stage. The shell is deliberately opt-in. Current canvas controls and the compact assistant remain underneath: this is not pixel-for-pixel completion of the concept images. The original table, board, production overview and SVG export remain accessible.

Navigation preserves the ReactFlow/assistant owner and the single keyed sequence owner. Canvas-only keyboard/import handlers are disabled when hidden. Moving between stages does not dispatch generation. Preview mode entry/exit uses same-document history navigation rather than a reload that could lose pending edits.

Switching into or out of preview mode explicitly warns that temporary Final Cut trims and undownloaded exports reset and the client cancels an active local render request. These are existing session-only renderer values, not saved project data. The renderer's unmount cleanup aborts its fetch; this is not proof that server-side work has stopped. Back/reload also do not persist those temporary settings. Durable trim/export persistence and active-render lifecycle proof remain outside this preview acceptance.

The new status panel consumes the shared contract; older diagnostics and operation-specific discovery still exist. Full capability consolidation, document-controller extraction, manual-panel lock/recovery inconsistencies, concurrent Worker failure, prior cross-browser video failures, complete regression matrix, exact-SHA CI and actual user visual approval remain open. No dependency additions, paid calls, deployments, CI dispatch, commits or pushes were performed.

## Validation environment

Credential-free snapshot `/private/tmp/cineserye-flow-preview-FT3uQ6`, with no `.env`/`.dev.vars` copied. Dependencies are symlinked to the prior isolated install; no fresh-install claim. Fixture mode and live-disabled environment are explicit. Built tests use a temporary loopback server with retries disabled and three workers; no magic-port readiness inference.

Evidence directory: `artifacts/simplified-flow/` in that snapshot. Browser screenshots/traces: `test-results/node-fixture/`.

## Iteration insights (before completion review)

1. Initial Chromium layout checks: 3 passed, 2 failed. Responsive legacy header rules hid the document title and overlaid controls. Specific preview layout rules repaired the actual short/mobile layout.
2. Initial cross-engine run: 10 passed, 3 WebKit failed, 2 interrupted. Native dialog focus did not return consistently; explicit close-to-trigger focus restoration fixed it. The next 15-case run passed all engines.
3. Critic found hidden ReactFlow keyboard deletion, navigation/outline coherence gaps, misleading overview placeholder copy and reload-based mode switching. These were fixed before freezing the candidate.
4. Expanded run: 20 passed, 1 failed. WebKit Backspace outside an input navigated history; guarding non-editable hidden-canvas Delete/Backspace prevents both deletion and unintended navigation.
5. The initial additive-premise test incorrectly assumed the sample lacked a premise (21 passed, 3 failed waiting for the nonexistent entry button). It now seeds an explicit legacy generic-root fixture. Source review identified the corresponding ownership edge case: explicit premise creation must retain that card and its links, and update canonical premise ownership in the same undoable transaction.
6. All 24 cases then passed. Critic final-boundary review prompted symmetric mode-switch warnings and ReactFlow's `nokey` keyboard exclusion on the new status modal. A focused-node → modal → Delete/Backspace preservation assertion was added before final validation.
7. The first 72-case repetition exposed the second modal keyboard mechanism: `nokey` stopped canvas deletion, but WebKit still interpreted Backspace as browser history (65 passed, 3 failed, 2 interrupted, 2 not run). A shared modal capture guard now prevents non-editable Delete/Backspace defaults; a unit regression proves input/contenteditable editing is not blocked. Shared confirmations receive the same protection.

## Completion review

Frozen source digest: `fcefccbd398f9d3f5646028785ce6d8b20fbd69c26084e2f10685280182b234c`. SHA-256 over sorted paths, each encoded as path + NUL + file bytes + NUL:

```
app/api/cinema/assemble/route.ts
app/api/cinema/generate-storyboard/route.ts
app/components/ConfirmationDialog.tsx
app/editor/Editor.tsx
app/features/simplified-flow/SimplifiedWorkspace.tsx
app/features/simplified-flow/navigation.test.ts
app/features/simplified-flow/navigation.ts
app/features/simplified-flow/simplified-flow.css
app/features/simplified-flow/useWorkspaceCapabilities.ts
app/features/story-development/AssistantShotPlanning.tsx
app/features/storyboard/ShotMediaPreview.tsx
app/server/cinema/assembly.ts
app/server/cinema/local-request.ts
app/server/cinema/native-runtime.test.ts
app/server/cinema/native-runtime.ts
app/server/cinema/story-assistant.ts
app/server/cinema/story-development.ts
app/server/cinema/workflow-capabilities.ts
docs/SIMPLIFIED_FLOW_IMPLEMENTATION_PLAN.md
e2e-worker/runtime.spec.ts
e2e/simplified-flow.spec.ts
worker.ts
```

Handoff/review packet and evidence are excluded. Earlier P0 runtime changes are included for exact candidate identity but are not reclassified as accepted by this preview.

Final implementer verification:

| Check | Result |
| --- | --- |
| Typecheck and lint after final source/test changes | PASS |
| Client/server boundary check | PASS |
| Credential-free fixture production build | PASS; existing large-chunk/unclassified-route warnings retained |
| Full offline suite, required renderer tests, four live/paid smoke opt-ins disabled | **492 total: 487 passed, 5 intentional live/paid skips, 0 failed** |
| Built Node preview matrix, 8 cases × 3 engines × 3 repetitions, 3 workers, no retries | **72 passed; 0 failed, skipped, interrupted or not run** |
| Runtime preview smoke on localhost:3040 | Aggregate reports `fixture`, `local-node`, configuration-only; no paid operation executed |
| `git diff --check` | PASS |

Local versions: Node v22.23.2, npm 10.9.8. Final application build preceded the added modal text-editing unit test; that test changes no application bytes. Typecheck/lint and full units were rerun afterward.

Portable evidence copies in the active checkout: `artifacts/simplified-flow/preview-attempt-1/preview-unit.json`, `browser-repeat.json`, and `desktop/`, `mobile/`, `story/` screenshots. Earlier failed iteration JSON remains in the validation snapshot. These browser proofs cover the bounded fixture preview only; no full regression/Worker/render-completion proof is implied.

Fresh critic `simplified_preview_critic_1`: **PASS for the bounded fixture-only review preview, 9.06/10**. All S1–S6 pass; no unresolved new-preview blocker. Confidence high within this scope, not a production-readiness score. Critic independently verified the 22-file digest in both checkout and snapshot, inspected raw reports and desktop/mobile screenshots, and reran the five navigation/modal unit tests (5/5 passed). Static/build and full browser results were inspected, not independently rerun by the critic.

| Category | Weight | Score |
| --- | --- | --- |
| Correctness/coverage | 30% | 9.1 |
| Simplicity/maintainability | 20% | 9.0 |
| Usability/accessibility | 20% | 8.7 |
| Data/security/cost safety | 20% | 9.3 |
| Evidence/reproducibility | 10% | 9.3 |
| Weighted total | 100% | **9.06** |

Critic insights:

- Hiding a view does not disable its behavior. Keep operation owners mounted while explicitly disabling hidden canvas input.
- Navigation includes browser Back, outline inspection and mode switches, not just the three tabs. These negative paths exposed real defects missed by the initial happy path.
- Reusing actual project/media/sequence components keeps the UI honest without claiming the illustrative concept's editing tools exist.
- The next usability improvement is Story focus, especially on mobile; the full canvas is not yet the concept's focused-screen experience.
- Temporary Final Cut trims and undownloaded output remain session-only. Warnings are honest, but durable persistence and server-side cancellation proof are future work.

Next: obtain the user's actual preview walkthrough feedback. No P0/P3/full-plan or user visual approval is implied by this verdict.
