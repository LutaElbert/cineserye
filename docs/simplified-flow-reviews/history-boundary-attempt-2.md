# Interim Story history / durable fence / layout — attempt 2

**NOT ACCEPTED: 8.75/10.** Fresh critic `story_history_boundary_critic_2`; high confidence in the reproduced finding and bounded history fixes. This is not full P0/P2/P4 acceptance.

Frozen 15-file sorted path/NUL/bytes/NUL digest: `2a81023810293d332f32e643a3fc9b58c9cb3056eb1f3c5971240d3e39e1db52`, on HEAD `abfa0fa` with dirty work. Scope: `app/domain/cinema/story-workflow{,.test}.ts`, `app/editor/story-development-commands.ts`, `app/editor/story-history-safety{,.test}.ts`, `app/editor/Editor.tsx`, `app/globals.css`, `app/features/project-actions/ProjectActionsMenu.tsx`, `app/server/cinema/operation-repository{,.test}.ts`, `app/server/cinema/story-development{,.test}.ts`, and `e2e/{story-development,assistant-short-height,canvas-planning-entry}.spec.ts`.

| Criterion | Verdict |
| --- | --- |
| H1 Missing Continue anchor preserves unresolved identity through reload | PASS |
| H2 Unsafe history restoration rejects before stack mutation | PASS |
| H3 Completed outcomes do not revert to running; normal and accepted-batch undo/redo work without adoption | PASS |
| H4 Cancellation/undo/reload recovery checks original ID without another POST | PASS |
| D1 Durable project fence prevents new-ID redispatch | FAIL |
| D2 Manual fixture, streaming and mocked-live requests share durability | PASS |
| L1 Short-height content/approval retains unchanged geometry thresholds | PASS |
| L2 390px project actions and opt-in preview entry remain reachable | PASS |

High finding: a project ID containing embedded NUL passes the Story input schema, but SQLite `length`/`substr` truncate its text. The exclusive-scope query can miss an existing pending record and permit a fresh ID. Critic independently reproduced the SQL behavior with `node:sqlite`. Disposition: accepted; reject NUL in scope/key before claim/dispatch, add pending/unknown and route regressions, freeze a new candidate and use a fresh critic. No weakening of Unicode support or assertions.

Scores: correctness 8.7, simplicity 9.0, usability 8.9, safety 8.2, evidence 9.2 (weights 30/20/20/20/10). Independent focused tests: 70/70. Full offline report: 507 passed / 0 failed / 5 intentional paid/live skips. Final browser report: 72/72, Chromium/Firefox/WebKit × 3, three workers, no retries/skips/flakes. Reports: `artifacts/simplified-flow/history-boundary-attempt-2/{units-507,browser-final-72}.json`. Production fixture build, latest typecheck, lint and client-boundary passed in credential-free `/private/tmp/cineserye-full-flow-3W6tpD`.

History attempt-1 high finding is fixed with current source and resolved-result plus accepted-batch browser tests. Short-height Advanced tools use the shared scroller; mobile preview entry moved to the existing project-actions menu. The Firefox intercept test now negotiates identity encoding before Node-side JSON parsing; geometry and zero-provider-call assertions remain intact. The earlier incomplete report remains in attempt-1 artifacts.

Remaining P4 issue: POST permits project IDs which the ASCII-only recovery GET rejects; repository Unicode/literal tests are not end-to-end Unicode recovery proof. The interim boundary is not a durable client operation journal or full document controller; old-backup recovery UI, other operations, full matrix, Worker, exact-SHA CI and user visual approval remain separate gates. No paid calls, remote writes, CI dispatch, deployment or budget changes.
