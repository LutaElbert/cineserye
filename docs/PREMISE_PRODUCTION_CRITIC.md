# Premise-to-production: independent UI critic

Date: 2026-09-07. Scope: the local fixture implementation on `feature/premise-to-production`.

## Verdict

The tested functional UI is **eligible for human review**, not automatically approved. The final independent Chromium run passed **9/9 tests in 30.7 seconds**. No blocking UI findings remain in those journeys after correction and fresh-context reruns.

This verdict is not submission readiness, real-model creative quality, paid-video readiness, hosted deployment readiness, or proof of a finished 60-second film. The fixture clip actually decodes to approximately **0.14 seconds at 160×90**; the UI now distinguishes this from the requested 4-second/720p settings. Assembly/export correctness requires the separate decoded-media integration evidence.

## Method and scoring

The critic independently inspected current code and plan, authored `e2e/premise-production-critic.spec.ts`, and used real Chromium rendering and pointer/keyboard interactions in fresh Playwright contexts. Only the task-owned fixture origin `http://localhost:3040` was used. No main-browser storage, localhost:3000 project, account configuration, or paid provider was changed.

Scores are the critic's qualitative assessment of the tested interactions and actual screenshots, not a real-user study. The threshold is at least 8.5; crossing it only requests human review.

| Viewport | Friction | Visual consistency | Canvas interaction | Trust / disclosure | Overall |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop, 1440×900 | 8.7 | 8.7 | 9.1 | 8.8 | **8.8** |
| Short, 1024×500 | 8.5 | 8.5 | 8.9 | 8.8 | **8.7** |
| Narrow, 390×844 | 8.6 | 8.6 | 8.9 | 8.8 | **8.7** |

- **Friction:** the detailed premise reaches reviewed scenes and shot planning without filling additional brief fields. References are attached inline and permissions are separated from creative inputs. Short screens still require intentional internal scrolling.
- **Visual consistency:** real light/violet canvas editors remain bounded; narrow editors are rendered at readable 100% scale instead of shrinking body text. Media and scene controls are recognizable, though some secondary workbench labels remain technical.
- **Canvas interaction:** actual-node containment, header dragging, Ctrl+wheel over an input, stable typing geometry, global Assistant entry, one persisted Assistant, reachable focus/fit controls, and non-overlapping compact media cards were exercised.
- **Trust:** local edits and reference permissions make no generation POSTs; fixture mode and external-sharing boundaries are explicit; requested media settings are not passed off as decoded output. Paid generation was not attempted.

## Passed journeys

1. At desktop, short and narrow sizes: edit the Story premise; verify no generation requests and no viewport/sibling movement while typing; open the connected Assistant; run fixture analysis; confirm that an explicit 60-second/vertical/horror-mystery/no-dialogue/cliffhanger prompt creates **zero duplicate questions**; confirm direction; obtain the quote automatically; generate three scene proposals; accept them; enter a scene from the Assistant; submit the inherited shot-plan defaults without filling more fields.
2. At all three sizes: open an accepted sample shot inside its actual node; generate fixture storyboard variants only after scoped consent; approve a frame; generate and approve one fixture clip; verify decoded media disclosure; close the editor; use Fit View; verify the media-enriched card does not overlap the following shot.
3. Desktop interaction probe: drag the expanded Story by its header; zoom the canvas using Ctrl+wheel over the prompt; open the global Assistant without a selected scene; hide/reopen it without creating a second helper.
4. Desktop and narrow references: upload a local image; insert its `@image1` mention; choose rights and specific allowed uses in the in-node permissions view; save locally; verify zero cinema generation POSTs.
5. Sequence screenshots cover the truthful **missing/unplanned work** state. They do not claim a completed full-cut render or prove an all-approved sequence through the UI.

## Findings corrected during review

| Finding | Correction verified |
| --- | --- |
| Narrow sample Board navigation intercepted the Focus layer editor button. | Separate reserved toolbar space; real pointer click succeeds. |
| Narrow bottom import banner intercepted Fit View after closing an editor. | Banner hidden at narrow width; toolbar upload remains available; Fit View succeeds. |
| Compact approved-media card overlapped the next shot. | Compact thumbnail content reduced to fit the existing card; rendered-card non-overlap asserted in the final tests. |
| Assistant grew down over zoom controls and showed production clutter before direction confirmation. | Fixed phase geometry and collapsed production section; bounded screenshots verified. |
| Short-viewport success toasts obscured editing controls. | Non-error notices suppressed visually while editing, with announcements preserved. |
| Short-viewport response retained a stale scroll offset, exposing confirmation before the understood facts. | Scroll resets only on checkpoint/state transitions; the understood heading is asserted in the viewport. Typing remains stable. |
| Narrow editors rendered small scaled text. | Actual editor widths adapt to the narrow canvas, allowing readable 100% body scale. |
| Fixture clip label implied requested duration/resolution were actual output. | Separate `Requested` and `Decoded footage` labels plus explicit fixture-footage warning. |

## Evidence

Final evidence root:

`artifacts/premise-production-critic-final-proof/`

Representative actual screenshots:

- [Desktop Story composer](../artifacts/premise-production-critic-final-proof/premise-production-critic--5cb79-ry-and-assistant-at-desktop-chromium/desktop-story.png)
- [Desktop understood direction](../artifacts/premise-production-critic-final-proof/premise-production-critic--5cb79-ry-and-assistant-at-desktop-chromium/desktop-assistant-understood.png)
- [Desktop scene review with inherited defaults](../artifacts/premise-production-critic-final-proof/premise-production-critic--5cb79-ry-and-assistant-at-desktop-chromium/desktop-scene-review-defaults.png)
- [Short viewport begins with understood facts](../artifacts/premise-production-critic-final-proof/premise-production-critic--cb016-tory-and-assistant-at-short-chromium/short-assistant-understood.png)
- [Narrow Story composer](../artifacts/premise-production-critic-final-proof/premise-production-critic--cc157-ory-and-assistant-at-narrow-chromium/narrow-story.png)
- [Narrow shot media workbench](../artifacts/premise-production-critic-final-proof/premise-production-critic-critic-shot-workbench-at-narrow-chromium/narrow-shot-plan.png)
- [Actual decoded fixture clip disclosure](../artifacts/premise-production-critic-final-proof/premise-production-critic-critic-shot-workbench-at-desktop-chromium/desktop-shot-video.png)
- [Narrow local reference permissions](../artifacts/premise-production-critic-final-proof/premise-production-critic--a8753-s-and-permissions-at-narrow-chromium/narrow-reference-permissions.png)
- [Missing sequence work is explicit](../artifacts/premise-production-critic-final-proof/premise-production-critic--5cb79-ry-and-assistant-at-desktop-chromium/desktop-sequence-missing.png)

Reproduce against the task-owned fixture server:

```sh
PLAYWRIGHT_BASE_URL=http://localhost:3040 npx playwright test e2e/premise-production-critic.spec.ts --project=chromium --workers=1 --output=artifacts/premise-production-critic-final-proof
```

The critic suite intentionally skips when not pointed at port 3040 to avoid accidentally operating on the user's main application. Earlier failure traces and correction screenshots remain in the other `artifacts/premise-production-critic*` folders for auditability.

## Remaining polish and limits

- A media-enriched card still carries its planning status badge alongside its distinct media status. Separating those labels more explicitly would improve scanning; it does not change the selected take or approval state.
- At short viewport heights, deeper shot controls and scene proposals require inner scrolling. Primary editing close controls stay reachable. This is acceptable for the tested scope, not a claim of a finished mobile filmmaking experience.
- The tests do not evaluate live AI question quality, sparse-prompt wording quality, large reference libraries, batch paid generation, real-film continuity, full sequence playback/render in the browser, or accessibility with assistive technology. Other unit/cross-browser/assembly evidence must be reported separately.
- The fixture is clearly test footage, not the user's final movie. No paid-video or submission approval follows from these scores.

**Human approval remains pending.**
