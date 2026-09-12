# P3 candidate task measurements

Status: VERIFIED by the fixed fixture harness for the mechanical P3.9 comparison. User walkthrough identification and visual approval remain NOT VERIFIED.

## Fixed source and environment

- Candidate: implementation digest `9344602b414cacbe9d3eba8356bc3de7e693a81e42ef93bebeb7ad2152f7f231` in the current worktree.
- Runtime: one credential-free **built Node production artifact** for all five tasks; Chromium; 1440×900; one worker; retries disabled. No source-development server contributed final candidate evidence.
- The five task definitions, action categories and measurement fields match the repaired-baseline harness. Candidate tasks enter the simplified flow explicitly.
- Timing is Playwright automation timing on this fixed fixture environment, not a user study.

## Baseline comparison

| Fixed task | Candidate outcome | Navigation baseline → candidate | Panels baseline → candidate | Hidden selection | Provider POST change |
| --- | --- | ---: | ---: | --- | --- |
| New idea → accepted shot plan | Completed | 2 → 1 | 3 → 2 | None | Unchanged: two analysis, one outline, one scoped shot-plan fixture POST |
| Reopen and partially accept a saved draft | Completed | 3 → 3 | 4 → 4 | None | Unchanged; reopening sent none |
| Locate a blocked capability | Blocked as expected | 1 → 1 | 2 → 2 | None | None |
| Reconcile interrupted work after reload | Completed | 2 → 2 | 3 → 3 | None | Unchanged: one analysis POST; exact-request recovery used GET |
| Find a usable take → local cut | Completed | 1 → 1 | 1 → 1 | None | None |

The candidate removes one navigation-only click and one panel switch from the first task and adds no navigation-only step to any task. Full scene acceptance opens the scoped shot-plan review using a read-only capability/quote check; it does not dispatch generation. Partial acceptance remains in the explicit Assistant flow.

The baseline local-cut task recorded `Failed to parse body as FormData.` The candidate completes preview → local assembly → MP4 download without a provider POST. This is a candidate defect fix, not a claimed navigation reduction.

The harness records every wait for the next expected action. In the final serial built-production run, the longest recorded next-action wait was the scoped fixture plan result (approximately 0.81 seconds); navigation and review transitions were tens of milliseconds. These are automation observations only.

## Enforced gates

- `finish()` fails the candidate harness if any recorded action snapshot contains more than one visible `.primary-button`; the final run recorded no competing primary CTA.
- Every task records an explicit hidden-selection statement. All five were `observed: false`.
- The blocked-capability task fails if a provider POST occurs.
- The interrupted-work task requires exactly one initial POST and exact-request reconciliation without redispatch.
- The serial result was 5/5 passed with retries disabled against one built-production runtime. Task 5 includes full downloaded MP4 decode. `artifacts/simplified-flow/final/candidate-measurements-built.json` is the immutable Playwright report for all five tests; the five per-task JSON logs are from that same run.

## Evidence and remaining human gate

The exact candidate harness is `e2e/candidate-task-measurements.spec.ts`; the five raw JSON logs are in `artifacts/simplified-flow/candidate-task-measurements/`. The repaired-baseline harness and raw logs remain in the adjacent baseline directory.

An earlier mixed-runtime measurement attempt is retained as invalid historical evidence: source-development tasks 1–4 completed, while its first 18-clip assembly request hit development middleware HTTP 413. It is not used for the comparison above.

P3.9 is not accepted until the user performs the actual walkthrough and identifies the next action or blocking reason. P3.6 separately requires explicit approval of all five stage screenshots plus blocked, empty and partial states.
