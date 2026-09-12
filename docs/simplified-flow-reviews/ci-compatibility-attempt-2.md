# Native CI compatibility repair — attempt 2

Status: **REJECTED BY FRESH CRITIC; PRESERVED AS HISTORY**.

Frozen September 12, 2026 from private release head `0739587da0482e85724398445dd65617cd315523`. The 429-input implementation digest is `5ebaf3e1091ebfc4356f21fa7d2bcd99ade9d30b781ec98bbc84447e1c08ecff`, computed as SHA-256 over `artifacts/simplified-flow/ci-compatibility-attempt-2/source-manifest.txt`. The mutable worktree and credential-free snapshot `/private/tmp/cineserye-ci-fullfix-bKhyH0` were byte-identical for all 429 inputs at freeze. Generated artifacts, videos, review records, and handoff records remain outside the digest.

The candidate differs from the private release head in exactly four implementation files:

- `app/editor/Editor.tsx`
- `app/editor/useDocumentWriter.ts`
- `app/features/assembly/SequenceReview.tsx`
- `app/globals.css`

## CI evidence and failure families

The cancelled native CI run `34664281006` announced 621 browser tests with three workers and ran from 01:19:53 to 01:41:58 before cancellation. It did not reach a final native summary, the expected renderer assertion, or the Worker suite. Its 11 observed failures belonged to four deterministic families:

1. Chromium and Firefox measured approximately 92.87 physical pixels for the short-height Assistant's useful body, below the retained 100px contract.
2. Six desktop, short, and narrow executions could not find the exact missing-media diagnosis, `No local approved clip for this shot.`
3. Two Chromium 500-node stress executions could not observe `Project backup restored.` within 20 seconds.
4. One Chromium story-composer reload could not find the editor's runtime spinbutton within five seconds.

Cancellation after 26 minutes 29 seconds was diagnostic only and cannot be treated as acceptance.

## Narrow repairs and root causes

- `app/globals.css` reserves 124 pre-transform CSS pixels for the short-height Assistant stage. The old 110px reservation was scaled by the React Flow shell to about 92.87 physical pixels. The existing 100px assertion, node bounds, and control layout are unchanged.
- `app/features/assembly/SequenceReview.tsx` presents three truthful preview states: no approved clip, approved metadata with a concrete local usability issue, or approved media still loading. Render remains blocked until every approved local clip is loaded, decoded, and issue-free.
- `app/editor/Editor.tsx` starts the unchanged 4200ms toast lifetime after two animation frames. Under a 500-node replacement, React could previously batch the toast's insertion and timed removal before the status received a paint, leaving neither a sighted status nor a useful live-region announcement.
- `app/editor/useDocumentWriter.ts` makes four non-blocking Web Lock acquisition attempts over a bounded 500ms handoff window. A same-tab reload can mount the replacement page just before the former page releases its lock; the former one-shot `ifAvailable` request permanently classified the replacement page as a reader. A genuinely concurrent editor still becomes read-only after the bounded window, with no indefinite lock wait.

No assertion, retry count, skip condition, duration threshold, production behavior gate, or paid/live provider boundary was weakened.

## Credential-free proof

All proof ran from `/private/tmp/cineserye-ci-fullfix-bKhyH0` in fixture mode with live mode disabled and provider credentials absent.

| Check | Result |
| --- | --- |
| TypeScript | PASS |
| ESLint | PASS |
| Production build | PASS; existing chunk-size advisory only |
| Post-build client-boundary scan | PASS |
| Full offline unit suite | 679 PASS, 5 intentional paid/live skips, 0 failures |
| Exact five-spec Chromium/Firefox/WebKit suite | 47 PASS, 4 intentional non-Chromium stress skips, 0 failures, 0 flakes |
| Repeated lifecycle suite (`--repeat-each=3`) | 24 PASS, 12 intentional non-Chromium stress skips, 0 failures |
| Source manifest identity | 429/429 byte-identical between worktree and snapshot at freeze |
| `git diff --check` | PASS |

The exact five-spec suite covers `assistant-short-height`, `premise-production-critic`, `story-composer`, `stress`, and `story-assistant-stress`. The repeated lifecycle suite exercises same-tab reload, genuine second-editor read-only behavior, and both 500-node restore paths three times per applicable browser. Raw fixture reports are stored in `artifacts/simplified-flow/ci-compatibility-attempt-2/focused-three-engine.json` and `artifacts/simplified-flow/ci-compatibility-attempt-2/repeated-lifecycle.json`.

## CI execution diagnosis and recommendation

The current workflow serializes static checks, build, 621 native browser executions, renderer assertions, and 129 Worker tests in one 30-minute job. The cancelled run spent roughly 22 minutes inside native tests without completing them, so another identical dispatch is unlikely to fit the job timeout even with the source regressions repaired.

The recommended remote plan is to preserve every test and assertion while splitting the workflow into parallel jobs: one static/unit/build/boundary job; a three-browser native matrix with one browser per job and the renderer assertion adjusted from six total renderer executions to two in each browser shard; and one Worker job. The observed Chromium portion was about 11 minutes, while the partial Firefox portion was about nine minutes before cancellation, making each browser shard materially more likely to remain below 30 minutes. This workflow change is a recommendation only: it has not been implemented, committed, pushed, or dispatched, and any paid-minute authorization and zero-cost check must be renewed before execution.

## Fresh critic requirements

The critic must independently verify the digest and exact four-file scope; directly measure short-height body and footer geometry; exercise missing, unusable, and loading media states while confirming render stays blocked; verify same-tab reload recovery and genuine concurrent-editor read-only behavior; verify a 500-node restore exposes the status visually and to its live region; inspect the bounded-lock and post-paint timer reasoning; and rerun focused proof without retries or weakened assertions. The earlier 9.5/10 acceptance applies only to the immutable two-file digest `8969ecd6…`, not this expanded candidate.

## Fresh critic verdict

Critic 14 rejected exact digest `5ebaf3e1…` after finding a medium usability/correctness gap in the unusable-media preview. An approved local MP4 with present bytes but failed metadata decoding correctly produced an active timeline issue and kept Render disabled; however, the truthy local clip still selected the `<video>` branch, so the broken player replaced the intended unusable-media explanation. Its independent six-byte invalid-video seed observed an empty preview explanation, one video element, the correct decode-error row warning, and disabled Render. Missing and loading copy remained truthful and export safety was intact. Attempt 3 gates the player itself on the absence of an active issue and requires another fresh review.

No commit, push, CI dispatch, merge, deployment, public-source change, paid/live provider call, or interaction with preview port 3059 occurred in this repair attempt.
