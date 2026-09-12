# Native CI compatibility repair — attempt 1

Status: **ACCEPTED BY FRESH CRITIC FOR THE BOUNDED TWO-FILE REPAIR; SUPERSEDED AS A RELEASE CANDIDATE BY ATTEMPT 2**.

Frozen September 12, 2026 from private release head `0739587da0482e85724398445dd65617cd315523`. The 429-input implementation digest is `8969ecd6aa0d124d8d25d877004254fb654ca4ff6e513d874ba5311b0c5f0b47`, computed as SHA-256 over `artifacts/simplified-flow/ci-compatibility-attempt-1/source-manifest.txt`. The worktree and credential-free snapshot `/private/tmp/cineserye-ci-shortfix-xvGZJc` are byte-identical for all 429 inputs. Generated artifacts, videos, this review record, and the mutable handoff remain outside the digest.

The candidate differs from the private release head in exactly two implementation files:

- `app/globals.css`
- `app/features/assembly/SequenceReview.tsx`

## Reported CI failures and root causes

1. **Short-height Assistant body.** Ubuntu CI measured 92.869 physical pixels for the content body where the product contract requires at least 100. The short-height rule reserved 110 CSS pixels inside a 220px React Flow node, but the canvas scaled that node to approximately 84.4% after reserving the toolbar and controls. This is deterministic transformed geometry, not a timing failure.
2. **Missing approved-clip diagnosis.** The preview generalized any active sequence issue to “no usable local preview,” so the explicit “No local approved clip for this shot.” diagnosis disappeared even though the timeline still correctly required approval. The required missing-media state remained blocking but lost its precise preview explanation.

## Narrow repairs

- The short-height Assistant now reserves 124 pre-transform CSS pixels for the stage body. At the measured CI scale this leaves about 104.7 physical pixels, preserving the existing 100px assertion without changing shell bounds, overlay behavior, retries, or thresholds.
- Sequence preview copy now distinguishes three truthful states: no approved clip, an approved clip with a concrete usability issue, and an approved clip still loading locally. Export remains blocked under all incomplete states.

A first experiment shortened the shared focus shell to avoid scaling. Focused browser proof rejected it because the pinned footer reduced usable content to 89.44px. That experiment was fully reverted and is absent from the frozen two-file diff.

## Credential-free proof

All retained proof ran from `/private/tmp/cineserye-ci-shortfix-xvGZJc` with fixture mode, live mode disabled, provider credentials stripped, retries disabled, and one browser worker.

| Check | Result |
| --- | --- |
| Compatibility check | PASS, 100% supported |
| TypeScript | PASS |
| ESLint | PASS |
| Production build | PASS; existing chunk-size advisory only |
| Post-build client-boundary scan | PASS |
| Full offline unit suite | 679 PASS, 5 intentional paid/live skips, 0 failures |
| Affected built Chromium suite | 12/12 PASS |
| Affected built Chromium/Firefox/WebKit suite | 36/36 PASS, 0 skips, retries or flakes |
| Source manifest identity | 429/429 byte-identical between worktree and snapshot |
| `git diff --check` | PASS |

The focused browser suite is exactly `e2e/assistant-short-height.spec.ts` plus `e2e/premise-production-critic.spec.ts`. It preserves the 100-physical-pixel body assertion, shell containment between canvas toolbar and controls, pinned action visibility, scrolling/history/revision behavior, all three critic viewports, explicit missing-clip text, and disabled local render.

## Fresh critic requirements

The critic must independently verify the digest and two-file scope, assess whether 124px is sufficient geometric headroom rather than a single-platform test accommodation, inspect action/footer accessibility at short height, confirm the missing/unusable/loading copy is semantically truthful, and rerun focused proof without weakening assertions or enabling retries. A score cannot waive a body below 100 physical pixels, an overlaid primary action, misleading missing-media state, or an export path that becomes enabled without usable clips.

## Fresh critic verdict

Critic 13 accepted the immutable two-file digest at **9.5/10** with **0.98 confidence** and no blocker, high, or medium findings. It independently rehashed all 429 inputs, confirmed the exact two-file scope, measured the interactive stages at 103.80–105.00 physical pixels across Chromium, Firefox, and WebKit at 735×389, verified fully visible actions without body/footer overlap, exercised the missing/unusable/loading states and blocked render, and obtained 36/36 focused cross-engine browser passes, 2/2 Final Cut Chromium passes, and 34/34 focused unit passes without retries.

Its one low finding is that the CSS comment's approximate 84% scale is illustrative rather than universal: the critic measured a 0.795455 transform locally, leaving compliant but modest 3.8–5px headroom. This verdict applies only to `/private/tmp/cineserye-ci-shortfix-xvGZJc` and digest `8969ecd6…`; the later lifecycle changes in attempt 2 require and are receiving a separate fresh review.

No commit, push, CI dispatch, merge, deployment, public-source change, paid/live provider call, or interaction with preview port 3059 occurred in this repair attempt.
