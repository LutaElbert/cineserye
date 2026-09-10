# Minimal canvas Assistant — implementation and acceptance

## Design

Use Claude's click/tap multiple-choice pattern, not its modal placement. Reference: https://support.claude.com/en/articles/13641943-visual-and-interactive-content. Keep Cineserye's existing draggable canvas node and validated structured-question schema.

1. Remove expanded/collapsed disclosures, duplicated premise/price copy and manual-form detours from the primary flow.
2. Show one structured question at a time with selectable answer cards, optional skip, back navigation and retained answers. No provider call on selection or navigation.
3. Keep one explicit scoped paid action with a single cost disclosure. Do not hide transfer scope, blockers, or silently authorize subsequent media requests.
4. Use compact outline rows and direct Add scenes action. Local direction changes return to this review path, never demand a second analysis solely because a brief was approved manually.
5. Test fixture flows, stale-source protection, keyboard input, short viewports, and screenshots. Independent critic review before claiming visual completion.

## Acceptance / regression

- Main Assistant analysis/questions/outline stages contain no details/summary accordions, dropdown question controls or collapse toggle.
- Single-choice answers are full clickable radio cards; multi-choice answers are selectable checkbox cards. Native semantics, labels, focus and disabled states remain intact.
- One question visible at a time; Back/Next retains answers, required answers block advancing, optional questions can be skipped. Recommendations are not preselected or submitted automatically.
- Custom values remain available for schema-supported text/numeric/multi-choice fields. Existing drafts and references are not discarded.
- One-use cost/transfer disclosure remains readable exactly once per approval stage; no automatic dispatch, retries or purchases on entering/editing the node.
- Confirmed local corrections stay confirmed and enter outline review. Changed premises/references still invalidate stale approval.
- Proposal review displays concise scene rows, durations, edit action and direct Add selected scenes. No internal state label or Back to Assistant primary action.
- Zoom, pan, node dragging, text selection, persistence and explicit acceptance remain unchanged.
- No new model, dependency, provider setting, paid test, deployment, commit or push in this UI pass.

## Implementation notes

- The Assistant remains an actual React Flow node. Its initial invitation is compact; question, correction, progress and scene-review stages reuse that node with one pinned primary action.
- Single-choice controls now use native radio cards; multiple-choice controls use checkbox cards. Runtime offers quick presets plus a custom value. Suggested answers require a user selection.
- Local direction correction edits one detail at a time and returns to outline planning without another paid analysis. Prior outlines and earlier answers remain in a separate, flat saved-drafts view inside the node.
- Scene revisions have a dedicated in-node instruction step and scoped approval. Existing accepted scenes are not silently overwritten.
- A locked premise blocks questions, local direction edits, proposal edits and generation, including a final pre-dispatch lock check.
- Very short layouts prioritize the working content, keep approval text/action readable, and show a scroll cue when more scene content remains below.
- Generated test reports previously triggered repeated development CSS updates. Tailwind scanning is now scoped to application sources, and Vite ignores generated artifacts and browser reports. Browser reruns write outside the repository.

## Verification caveats

- This pass uses fixture responses and one mocked live-capability disclosure test that blocks generation POSTs. It does not establish live-model creative quality, billable-media reliability or feature-film production readiness.
- The existing note-only reference entry is still gated behind an attached image in the premise composer. This is a separate follow-up; approved-note scoping itself is covered by regression tests.
- Disk pressure interrupted an extra browser run. Nineteen redundant trace archives from this pass were permanently removed (110,171,835 bytes); screenshots and error summaries were retained. No saved user project or prior live-test database was deleted.

## Final verification — 8 September 2026

| Gate | Result |
| --- | --- |
| Unit suite | 479 passed, 5 skipped; 80 passing test files, 4 skipped |
| Main browser regression | 45/45 passed across Chromium, Firefox and WebKit |
| Extended Assistant regression | 27/27 passed across those three engines, including fixture SVG/MP4 downloads |
| Final extreme-height polish | 9/9 repeat checks passed after the last UI change |
| TypeScript / changed-file ESLint / client-server boundary | Passed |
| Production build / whitespace check | Passed |

The first concurrent unit run hit the existing 100ms outline-performance threshold (125ms) while browsers and other checks were running. The unchanged full suite then passed with one worker. No timing assertion was weakened.

Browser acceptance covers required-answer blocking, Back/Skip retention, understood-fact corrections, no redundant reanalysis, scope-limited revisions, stale draft recovery, lock/unlock protection, cursor-anchored zoom, stable typing, accepted scene/shot persistence, cancellation, reference exclusion and no reload redispatch. There were 72 distinct browser checks plus the 9-check repeat.

### Independent screenshot critic

| View | Score / 10 |
| --- | --- |
| Initial invitation: desktop / narrow / short | 8.8 |
| Scene review: desktop / narrow | 8.6 |
| Scene review: short | 8.5 |
| Selectable questions: narrow | 8.7 |
| Revision at 735 × 389: Chromium / WebKit | 8.7 |

The critic initially scored the extreme-height revision 8.1 because its textarea was clipped by duplicated helper text and a scroll fade. The final pass removed duplication, moved selection scope into the footer, and suppressed the fade while typing. The regression now requires at least 48 visible screen pixels of textarea above the pinned footer. All reviewed views meet the requested 8.5 threshold; **user visual approval is still pending**.

Actual fixture screenshots: [questions](../artifacts/minimal-assistant-2026-09-08/visual-review/questions.png), [scene review](../artifacts/minimal-assistant-2026-09-08/visual-review/scene-review.png), [very short revision](../artifacts/minimal-assistant-2026-09-08/visual-review/short-revision.png). These are browser captures of the implementation, not generated mockups. The independent critic reviewed those captures; it did not assess live model quality.

### Cleanup

- Owned fixture server on port 3040 and browser test workers stopped; main app on port 3000 remains available.
- The two disposable operation databases from this UI pass were moved to macOS Trash for recovery. Previous live-analysis evidence is untouched.
- Screenshots, acceptance criteria and verification logs retained. No separate preview screen was added, and no commit, push, deployment or paid AI/media call occurred in this pass.
