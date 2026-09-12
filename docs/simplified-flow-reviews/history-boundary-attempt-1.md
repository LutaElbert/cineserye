# Interim Story history boundary — attempt 1

Verdict: **NOT ACCEPTED, 8.63/10**. Fresh critic `story_history_boundary_critic_1` independently ran 45 focused unit tests and reproduced a resolved-result undo/redo regression. This was never a full P2/P4 completion claim.

Candidate HEAD `abfa0fa` plus dirty changes; sorted path/NUL/bytes/NUL SHA256 `c7fc1b2ded183d62c6e230d409d4d41aa7166678be97328380d56990cb9e2a96` over `app/domain/cinema/story-workflow{,.test}.ts`, `app/editor/story-development-commands.ts`, `app/editor/story-history-safety{,.test}.ts`, `app/editor/Editor.tsx`, and `e2e/story-development.spec.ts`.

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| H1 Deleted Continue anchor preserves unresolved outcome and ID through reload | PASS | Three state cases, domain validation, independent unit rerun |
| H2 Undo/redo cannot erase unresolved request; rejected restoration does not pop stacks | PASS | Source inspection and pure helper tests |
| H3 Ordinary/resolved history stays usable | FAIL | Undo can restore a completed operation's old running snapshot; redo then rejects it |
| H4 Cancel → repeated undo → reload checks original ID with no extra POST | NOT VERIFIED | Earlier version passed 9/9; strengthened identity test did not finish all engines |

Scores: correctness 8.5, simplicity 9.1, usability 7.8, safety 9.1, evidence 8.8; weights 30/20/20/20/10. High confidence in reproduced defect, moderate browser coverage. No score overrides failed criteria.

Commands in credential-free `/private/tmp/cineserye-full-flow-3W6tpD`: focused 45-unit suite, typecheck, fixture production build passed. Combined cancellation/short-height run: 36 expected, 17 passed, 2 failed, 2 interrupted, 15 not run. Failures were Firefox test interception trying to parse compressed `route.fetch()` response bytes as JSON, not evidence of a passing layout matrix. Retained report: `artifacts/simplified-flow/history-boundary-attempt-1/combined-incomplete.json`. Layout CSS is outside this frozen scope.

Disposition: accept H3 as a real high finding and fix before another attempt; retain all failed evidence. Add resolved-result undo/redo and accepted-batch browser evidence, then spawn a new critic. Do not represent this interim boundary as a durable operation journal, full controller, cross-project/backup restore protection, or completion of any phase. No live/provider calls, remote writes, CI, deployment or billing changes.
