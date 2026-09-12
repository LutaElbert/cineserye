# Private release attempt 3 — September 12, 2026

Status: app repair and actual CI workflow accepted for dispatch; exact-head runtime gates open.

## Candidate and retained history

Base private head: `0739587da0482e85724398445dd65617cd315523`, branch `feature/simplified-flow-release`, private PR #1. New candidate digest: `d60cc82a359519c32b45a950b76c3b4f55a5420f70bfbcdde3b4c506cb110da5` across the same 429 inputs. Handoff/review Markdown and generated artifacts/videos are excluded from the implementation digest; no generated files or credentials belong in the commit.

Run `34664019846` failed because the client-boundary scan preceded build. Run `34664281006` was deliberately cancelled at 26m29s after eleven failing native executions across four families; native was incomplete, renderer assertion and Worker unexecuted. Neither is accepted. The original worktree remains untouched and both commits remain recoverable in history.

The five-file app/test repair is frozen separately at digest `f11fc9d6497275c0c9b231702ce0e3131cec449a266d4571063b91c0906968a5`, accepted by fresh critic 15 at 9.4/10, confidence 0.93. Its packet preserves critic 14's rejection and the later all-browser renderer-busy 409 diagnostic (5/6). Local static checks, 679 offline unit passes, 47 focused browser passes, 24 repeated lifecycle passes and isolated Final Cut 2/2 in each browser are bounded proof, not a full exact-head Linux matrix.

## Actual workflow change

The only additional implementation input is `.github/workflows/ci.yml`:

- Static/security/unit/build/client-boundary checks run first.
- Native matrix runs Chromium, Firefox and WebKit in separate standard Ubuntu jobs. Each builds the same explicitly checked-out PR head, runs the unchanged full native selection with `--project=<browser>` and requires both Final Cut cases to pass.
- Worker compatibility retains the same three-browser selection and one-worker serialization. It waits for native success to avoid additional included minutes after a known native failure.
- Final `verify` uses `always()` and rejects any failure, cancellation or skipped prerequisite. Every app-testing job checks and logs HEAD against the event's explicit candidate SHA.
- Existing fixture/live-disabled policy, zero retries, test thresholds, test selection and historical stress skips are unchanged. No renderer safety guard is weakened, artifact upload added, or deployment enabled.

Local YAML parsing and workflow semantic assertions pass. The final gate was executed against all 64 combinations of success/failure/cancelled/skipped: only all-success returns zero. Conceptual strategy critic scored 9.2/10 conditionally; this is not the actual-workflow verdict or a runtime CI pass.

Fresh `ci_workflow_actual_critic` independently accepted the implemented workflow at **9.5/10**, confidence **0.96**, with no implementation blocker. It verified the current 429-input digest, exact checkout semantics, all 64 aggregate outcomes, unchanged zero retries/skip policy and actual enumeration of **207 native cases per browser (621 total)** plus **129 Worker cases**. Enumeration used the accepted credential-free snapshot because this release worktree lacks dependencies; all 47 relevant test/wrapper/config files matched byte-for-byte. This approves dispatch only, not final release. Its insights emphasize quota-saving Worker ordering, extra aggregate build/install minutes from sharding, and exact branch-head proof being distinct from later merge integration proof.

## Cost and authority

User delegated private commit/push and CI judgment. Authenticated account Actions billing UI at approximately 12:19 Manila showed $0 budget, Stop usage Yes, $0 spent. No setting changed. Each heavy job has a 30-minute cap; five heavy jobs plus the 2-minute aggregator give a configured upper bound of 152 runner-minutes, not a runtime estimate or available quota. Sharding reduces wall-clock/collision risk but repeats installation/build work and may consume more included minutes. Stop on allowance exhaustion; do not buy minutes or raise limits.

No merge, deployment, public repository/submission update, paid/live provider call or original-worktree cleanup is authorized. Preview 3059 still serves the independently preserved visual-attempt-6 fixture. Normal reviewable revert is the rollback mechanism; never hard-reset user changes.

## Remaining exact-head evidence

Before full acceptance, record pushed SHA/tree/digest, fresh workflow verdict, Actions run/job links, static result, all native counts, two renderer passes per browser, Worker 129 cases, final verify result, cost-control observation, all 58 criteria and fresh final critic. Preserve any failure or cancellation. A final PR evidence record can anchor the tested SHA without repeatedly changing it to embed its own result in a commit. Any post-CI local documentation addendum must be explicitly identified as uncommitted.
