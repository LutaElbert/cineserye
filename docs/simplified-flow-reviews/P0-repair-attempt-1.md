# P0 bounded Story / sample-media repair — NOT ACCEPTED

2026-09-10. Private `feature/simplified-flow`, HEAD `abfa0fab2fb26c775f639358521d9a29c3a6b640`, uncommitted candidate. This is not full P0 or full simplification acceptance.

## Frozen candidate

SHA-256 `131f8bed5923e34824b579b607e35d278452490c430a1e095640faa81a3ff693`, over sorted path + NUL + file bytes + NUL for these six files:

- `app/editor/story-development-commands.ts`
- `app/editor/story-development-commands.test.ts`
- `app/features/story-development/StoryDevelopmentPanel.tsx`
- `app/server/cinema/video-provider.ts`
- `e2e/story-development.spec.ts`
- `e2e/premise-production-critic.spec.ts`

Credential-free built validation copy: `/private/tmp/cineserye-full-flow-3W6tpD`. Existing dependencies are symlinked from the earlier fresh-install copy; this is not a new install. No .env/.dev.vars files, provider secrets or paid smoke calls. Preview 3040 stays on its earlier accepted snapshot.

## Bounded criteria

| ID | Required result | Evidence |
| --- | --- | --- |
| B1 | Locked premise blocks manual proposal edits, reorder, reject, discard and acceptance at the shared command boundary; tracking errors remains possible | Story command tests; manual lock browser case |
| B2 | Open manual panel shows disabled creative/reference actions while premise is locked and allows them after unlock, without extra AI requests | `manual Story tools respect the premise lock for review, references and acceptance` |
| B3 | Saved running/unknown/locally cancelled Story sessions prevent a new Story-outline request across panels; cancellation and reload cannot auto-replay, recovery is GET-only | Command parameterized tests; extended `cancelled story request never inserts late output; recovery performs only a GET` |
| B4 | Embedded offline sample is playable as a one-second 160×90 silent fixture in Chromium, Firefox and WebKit, without changing requested/live production settings | Three viewport shot-workbench tests now assert actual browser metadata, not just server-reported duration |
| B5 | Offline/static/build checks pass for the candidate without increasing timing budgets or weakening assertions; no live/CI/deployment changes | Exact commands and results below |

Changes: one command-level lock policy, shared unresolved-session selector, consistent manual controls, pre-dispatch failure distinguished from unknown dispatched work, recovery checks project/session identity, regenerated corrupt sample MP4. Existing request approval, reference transfer and live provider paths remain unchanged. The sample is intentionally only one second, not a production take. Generation history is not a new job database.

## Verification

- Exact final candidate: **45/45 built browser checks**, three engines × three repetitions, three workers, zero retries/skips. Command: `npm run test:built:node -- e2e/story-development.spec.ts e2e/premise-production-critic.spec.ts --grep 'cancelled story request|manual Story tools|critic shot workbench' --repeat-each=3 --max-failures=2`. Raw `artifacts/simplified-flow/node-fixture.json` and `test-results/node-fixture/` in the validation copy.
- Initial lock browser test omitted opening Layers before locating its lock control. Retained failed report `story-lock-initial-failed.json`; corrected setup, no assertion removed or timeout increased.
- Earlier unchanged sample: Chromium read 0.142222 seconds; Firefox/WebKit rejected it (media error 4). New sample independently reads 1 second / 160×90 in all three engines. Actual workbench tests retain generation, consent, preview, approval and layout assertions.
- Earlier full units: 491 pass / 5 intentionally disabled live tests. Final run overlapping the browser matrix had one 500-node timing failure: 155.943 ms against unchanged 150 ms limit (490 pass / 1 fail / 5 skips). Retained `repair-units-concurrent-timing-failure.json`. Isolated final unit run is recorded below when finished; do not conceal the observed timing failure or claim full performance acceptance.
- Typecheck, lint (excluding temporary `.diagnostics` only), compatibility, client-boundary and fixture production build executed. Known build chunk-size/route-classification warnings retained. Audit high gate exits 0 with the existing 14 moderate entries; no forced upgrades/downgrades.
- Environment: Node 22.23.2, npm 10.9.8, ffmpeg/ffprobe 8.1.2, lockfile SHA `bf8206c5a429137ce03649d13ed3c2bc6a3821d2f6dbe084d7c2e172eaf522a3`, Playwright 1.62.1; Chromium 151.0.7922.34/rev1234, Firefox153/rev1538, WebKit26.5/rev2336.

## Explicitly still open

Final units, with the browser matrix stopped: **491 passed, 0 failed, 5 intentional live/paid skips**, unchanged timing limits. `CINESERYE_REQUIRE_RENDERER_TESTS=true`, four paid-smoke flags `0`, `npm test -- --reporter=json --outputFile=artifacts/simplified-flow/repair-final-units.json`. Final typecheck and lint passed as well. The earlier concurrent timing failure remains recorded above; P6 performance acceptance is not claimed.

- Worker concurrency failure: see `WORKER_DIAGNOSTIC_LOG.md`. P0 is NOT accepted.
- Full native/Worker matrices and repaired-baseline task measurements are not complete.
- This does not complete the P4 operation model: assistant-analysis/shot/video clients, tombstone/expiry presentation, bounded polling, fresh approval after authoritative reconciliation, and missing legacy operation identities still need that phase. Unresolved operations are intentionally not treated as known failures.
- P1 capability adoption, P2 controller extraction, full P3–P6 parity, user actual-screen/walkthrough approval, exact-SHA CI and P7 handoff remain mandatory. All 58 criteria are retained in `ACCEPTANCE_TRACKER.md`.
- No commit/push/merge, GitHub Actions dispatch, paid generation, credential change or public deployment.

## Independent review

Fresh critic `p0_story_media_critic_1` independently verified the six-file digest, reran 20 command tests, inspected the portable browser/unit reports and played the sample to completion in all three engines. **NOT ACCEPTED, 8.26/10**. B1 PASS, B2 PASS, B3 FAIL, B4 PASS, B5 PASS.

Scores: correctness/coverage 8.0 (30%), simplicity 8.8 (20%), usability 8.6 (20%), safety 7.2 (20%), evidence 9.2 (10%). Both overall and safety thresholds fail. No full P0 or plan acceptance.

### Findings and parent dispositions

1. **High — anchor deletion removes unresolved-operation protection.** `reconcileStoryWorkflow` at `app/domain/cinema/story-workflow.ts:313` rewrites unresolved stages to `stale` after a Continue anchor is deleted. The new selector no longer blocks dispatch. Critic independently reproduced this. **Confirmed, unresolved, not waived.** Next repair must keep source staleness separate from operation outcome and test running/unknown/cancelled deletion plus reload.
2. **High — undo can erase the only client dispatch guard.** Running sessions are committed through ordinary undoable history; `Editor` undo restores the prior cinema snapshot wholesale. Earlier snapshots can erase operation identity even if dispatch commits alone become non-undoable. **Confirmed by source, unresolved, not waived.** Next repair needs operational records outside document undo, or an equivalent durable authoritative boundary, with dispatch → cancel → undo past dispatch → reload tests. A second browser-panel boolean is not sufficient.

Critic insights: preserve creative validity separately from provider outcome; characterize simultaneous preparation, locking during preparation, successful recovery after unlock and project/operation replacement. The new lock projection is a bounded safety improvement, not the eventual operation controller. Keep the sample fix and focused passes, but do not advertise recovery as completed.

### Broader native matrix findings (outside the six-file frozen scope)

Initial full run: 507 expected, 6 passed, 3 failed, 498 not run. Old compact tests asserted zero details despite intentionally restored Advanced story tools. Separate selector migration in `e2e/assistant-compact-review.spec.ts` now explicitly verifies the disclosure stays closed, its manual action stays hidden, and primary-path details/selects are absent; no timeout increase or deleted behavior assertion.

After that migration: **507 expected, 88 passed, 3 failed, 2 interrupted, 414 not run**. Two short-height tests measure only 89.489 px of content against their unchanged 100 px minimum; the 390 px canvas-planning-entry case also failed and needs diagnosis. These are unresolved, not a green matrix. Portable reports: `artifacts/simplified-flow/p0-repair-attempt-1/full-native-initial-failed.json` and `full-native-after-selector-migration.json`. This test-only migration has not received its own completion verdict.
