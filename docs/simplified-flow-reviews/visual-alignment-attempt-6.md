# Simplified-flow practical-viewport repair — attempt 6

Status: **ACCEPTED for the bounded local, agent-delegated visual/walkthrough scope** by fresh `simplified_flow_critic_12` at **9.20/10**, confidence **0.98**. This is not full revision-3 acceptance and does not claim Elbert personally reviewed or approved the candidate.

Frozen September 12, 2026 from base `abfa0fab2fb26c775f639358521d9a29c3a6b640`. Implementation digest `38eedca6efa36f575572269f5c5f8b05d9606016333150913f51dc4bab60ac38` covers the same 429 predeclared inputs as integrated attempt 3. It is SHA-256 over the sorted per-file SHA-256 manifest. Generated `artifacts/`, `videos/`, mutable `CINESERYE_HANDOFF.md`, and reviewer records under `docs/simplified-flow-reviews/` remain outside the digest. The primary worktree and credential-free validation snapshot `/private/tmp/cineserye-visual6-VfcF1h` have byte-identical manifests.

Attempt 5's initial critic-10 acceptance remains historical, followed by the preserved delegated practical-viewport rejection from critic 11. This packet does not rewrite either result. Eleven implementation/test files differ from attempt 5:

- `app/editor/Editor.tsx`
- `app/features/assembly/SequenceReview.tsx`
- `app/features/assembly/sequence-manifest.ts`
- `app/features/assembly/sequence-manifest.test.ts`
- `app/features/simplified-flow/media-workspace.test.ts`
- `app/features/simplified-flow/simplified-flow.css`
- `app/features/simplified-flow/stage-projection.ts`
- `app/features/simplified-flow/stage-projection.test.ts`
- `app/features/storyboard/VisualPreproductionPanel.tsx`
- `e2e/final-cut-export.spec.ts`
- `e2e/simplified-flow-visual-captures.spec.ts`

## Bounded repairs

1. **Readable Story review.** Simplified Story centers the Assistant at a readable scale below 1000 px rather than fitting the premise and Assistant together. At 786×559, 877×559 and 390×844 the assertions require readable effective type, every proposal synopsis scrollable into view, and the Add-scenes action in view.
2. **Usable shot media review.** Opening a shot waits until the previously hidden canvas has dimensions. The focused media editor owns the canvas at all reviewed widths, hides unrelated graph context and low-value canvas controls, places three compact candidates first, and scrolls new results into review. Tests generate three candidates, require meaningful content height, make an approval actionable and approve it at 786×559, 877×559 and 390×844.
3. **Truthful proposal guidance.** The Idea stage now reports “Scene proposals are ready” for a new draft and “Some scene drafts remain” after partial acceptance, with review/resume actions instead of claiming scene planning is next.
4. **Decoded-duration warning.** Final Cut decodes each retained local clip before declaring the sequence complete. A trim whose start plus use exceeds decoded footage gets an explicit warning, attention state and disabled render action. The cross-engine regression uses a real one-second synthetic MP4 against a planned two-second trim, then confirms that changing Use to one second clears the warning.

Saved canvas geometry, canonical document/state ownership, recovery, server assembly validation, backend/provider policy and cost controls are unchanged.

## Reproducible proof

All proof ran from `/private/tmp/cineserye-visual6-VfcF1h` in fixture-only mode, with live mode disabled and provider credentials excluded.

| Check | Result |
| --- | --- |
| TypeScript | PASS |
| ESLint | PASS |
| Production build | PASS (existing chunk-size advisory only) |
| Full offline unit suite | 679 PASS, 5 intentional paid/live skips, 0 failures |
| Built Node focused browser suite, Chromium/Firefox/WebKit | 48/48 PASS, 0 skips, 0 retries/flakes |
| Built Node visual/interaction suite, Chromium/Firefox/WebKit | 36/36 PASS, 0 skips, 0 retries/flakes |
| Practical Story reviews | Three viewports; all synopses readable by internal scroll and Add 3 scenes reachable |
| Practical shot reviews | Three viewports; three candidates visible and one variant successfully approved |
| Implementation manifest comparison | 429/429 byte-identical between worktree and validation snapshot |
| `git diff --check` | PASS |

## Evidence packet

`artifacts/simplified-flow/visual-direction-attempt-6/` contains 17 current screenshots, two attempt-5 before screenshots, `source-files.txt` and `source-manifest.txt`. Key practical evidence:

- `before-01-story-786x559.png` → `13-story-review-786x559.png`
- `before-02-shot-786x559.png` → `14-shot-review-786x559.png`
- `13-story-review-877x559.png` and `13-story-review-390x844.png`
- `14-shot-review-877x559.png` and `14-shot-review-390x844.png`

The Story screenshots intentionally show an internally scrolled review rather than claiming all three scene synopses fit simultaneously in a short viewport. The automated interaction reads every synopsis. The shot screenshots show a completed approval, and the automated interaction proves that approval succeeds. At 786×559, the fresh critic found the lower 7.8 px of the Approve button initially under the sticky footer; a small internal scroll exposed the full button, top/center/bottom hit-testing resolved to it, and approval succeeded. `toBeInViewport()` alone does not prove absence of overlay coverage, so this packet makes no stronger claim.

## Fresh critic verdict and delegated review boundary

Elbert delegated product judgment to the managing agent. Fresh `simplified_flow_critic_12` independently reproduced the 429-input digest and byte identity, inspected and interacted with the 786×559 and 877×559 Story and shot reviews, read all proposal summaries, completed partial 2-of-3 acceptance with explicit 20-second consent, approved shot variants, and reran the real one-second MP4 regression. The critic found no blocker, high-severity issue, inaccessible interaction or misleading product state.

Category scores: correctness/preservation 9.4; simplicity/maintainability 8.9; visual/usability/accessibility 8.8; data/security/cost safety 9.8; evidence/reproducibility 8.8. Low-only findings were the initial 7.8 px Approve-button/footer intersection at 786×559, harmless compact-header label/underline proximity, and intentionally two-line-clamped synopsis presentation. All remained readable and actionable under direct interaction.

Under the delegated product-judgment instruction, this supports `VERIFIED` decisions for P3.6 and P3.9 by agent review. It must not be represented as Elbert personally reviewing the screenshots or performing the walkthrough. P0.8, P7.1, P7.3, P7.4 and P7.5 remain open for their separate exact-SHA/remote authority and evidence.

No paid/live provider call, remote write, CI dispatch, commit, push, merge, deployment or public-source change occurred.
