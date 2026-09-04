# Dominant Hierarchy Orientation Implementation Plan

Status: Complete (2026-09-04)

Baseline: `1ae7d032bac702388bfe0c2485c9775ffdc03d96`

## Problem

Sparkle currently lets the first narrative Scene connector choose the orientation for every sibling. In a mixed five-Scene hierarchy where Scenes 01 and 03 are below the Story but Scenes 02, 04, and 05 are connected to its right, the minority bottom-facing connection wins and rotates all five Scenes into a bottom row.

## Goal

Choose hierarchy orientation by direct-Scene majority, then use the existing dominant positional lane within that winning orientation. The first narrative Scene becomes a deterministic tie-breaker rather than an unconditional authority.

## Orientation contract

1. Count one vote per visible direct structural Story → Scene relationship.
2. A right/left handle pair or handle-free relationship votes for a right-facing vertical lane (`horizontal`).
3. An exact bottom/top handle pair votes for a bottom-facing horizontal row (`vertical`).
4. The larger vote count wins, regardless of Scene number or raw edge-array order.
5. A tied vote uses the first narrative Scene relationship: production order first, then Scene number, then stable fallback order.
6. Duplicate structural edges to one Scene cannot give that Scene multiple votes.
7. Hidden Scenes, reference links, sequence links, Scene-child edges, and unrelated freeform connections do not vote.
8. After orientation is selected, the existing sibling-supported lane algorithm chooses the coordinate and run start.
9. Eligible minority connectors normalize to the winning handles in the same Sparkle transaction.
10. Locked and accepted/provider-owned nodes and their protected connectors remain unchanged, although their visible direct relationships may participate as orientation evidence.
11. Typed Scene insertion uses the same vote before it creates the new connector, preventing a new Scene from reinforcing a minority orientation.
12. Reorganization remains deterministic, idempotent, undoable/redoable, and persistent.

## Test cases

- User reproduction: Scenes 01 and 03 bottom-facing; Scenes 02, 04, and 05 right-facing. Right wins 3–2, all Scenes align right, and minority connectors normalize.
- Inverse majority: three bottom-facing versus two right-facing produces one ordered bottom row.
- Even tie: the first narrative Scene direction wins.
- Production-order tie: a production-ordered first Scene overrides numeric Scene 01 as the tie-breaker.
- Raw edge order: shuffling edge storage does not change the vote or result.
- Duplicate relationship: two edges to one Scene still count as one Scene vote.
- Hidden and non-structural relationships: no vote and no normalization.
- Protected minority: locked/provider-owned endpoints are not moved or rewritten.
- Malformed partial handles: they are treated as non-vertical and normalized consistently with the winning direction.
- New Scene: typed insertion inherits the existing majority direction and dominant lane.
- History: Sparkle changes nodes and eligible connectors in one Undo/Redo step.
- Persistence: reload retains normalized handles and the derived shared route.
- Idempotence: a second Sparkle action reports no layout changes.
- Regression: dominant-lane tolerance, Scene children, accepted plans, outline, accessibility, and stress coverage remain green.

## Acceptance criteria

- [x] AC-DO-01: Three right-facing direct Scenes beat two bottom-facing direct Scenes.
- [x] AC-DO-02: Three bottom-facing direct Scenes beat two right-facing direct Scenes.
- [x] AC-DO-03: A tied orientation vote uses the first narrative Scene as the deterministic tie-breaker.
- [x] AC-DO-04: Each visible direct Scene contributes at most one vote, independent of raw edge order.
- [x] AC-DO-05: Hidden Scenes and reference, sequence, child, and unrelated edges cannot influence orientation.
- [x] AC-DO-06: The winning orientation feeds the dominant positional-lane algorithm and preserves narrative ordering.
- [x] AC-DO-07: Eligible minority connectors normalize to the winning orientation atomically with node placement.
- [x] AC-DO-08: Locked and accepted/provider-owned nodes and protected connectors remain unchanged.
- [x] AC-DO-09: Typed Scene insertion inherits the existing majority orientation and lane.
- [x] AC-DO-10: Sparkle remains deterministic, idempotent, undoable/redoable, and persistent after reload.
- [x] AC-DO-11: Existing single-orientation and dominant-lane behavior remains compatible.
- [x] AC-DO-12: TypeScript, ESLint, unit/integration, build, provider-boundary, Vinext, and cross-browser Fixture gates pass without Google Cloud, deployment, or paid-provider calls.

## Acceptance evidence

- `app/editor/cinema-workspace-placement.ts` counts one deterministic vote per visible direct Scene, uses strict majority with the first production/narrative Scene as the tie-breaker, and applies the same result to insertion previews.
- Unit/integration: 232 passed, 3 intentionally skipped live-provider tests. The focused placement module contributes 25 passing cases, including both 3–2 outcomes, ties, duplicates, shuffled storage, protected nodes, insertion, and idempotence.
- Playwright: 214 passed across Chromium, Firefox, and WebKit; 2 intended non-Chromium stress skips. Both mixed-orientation cases verify node placement, connector normalization, Undo/Redo, persistence, and overlap safety.
- TypeScript, ESLint, production build, client/server provider-boundary, and Vinext compatibility checks passed. Vinext reports 100% compatibility: 9 supported, 0 partial, 0 issues.
- Verification ran with the Fixture provider. No Google Cloud command, deployment, or paid/live provider request was made.

No Google Cloud mutation, live research, live planning, storyboard generation, video generation, deployment, or paid-provider request is authorized by this plan.
