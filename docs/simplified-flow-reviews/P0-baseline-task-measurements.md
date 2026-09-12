# P0 repaired-baseline task measurements

Status: VERIFIED for the baseline half of P0.9 / P3.9. The fixture candidate comparison is recorded in `P3-candidate-task-measurements.md`; user walkthrough remains NOT VERIFIED.

## Frozen source and environment

- Source: accepted video-lifecycle attempt 5 snapshot, 352 files.
- Source digest: `d0358568e190ffcb4a9cb56caa30945d228556bc6dc6f9032a6e5fccdcf07a90`.
- Runtime: credential-free built Node fixture; Chromium; 1440×900; one worker; retries disabled.
- The measurement copy had only the external measurement harness added. The frozen source snapshot was not changed.
- Timing is Playwright automation timing on this fixed fixture environment, not a user study.

## Results

| Fixed task | Outcome | Navigation-only clicks | Panel switches | Hidden selection prerequisite | Provider POSTs |
| --- | --- | ---: | ---: | --- | --- |
| New idea → accepted shot plan | Completed | 2 | 3 | No; Assistant showed the three-scene scope without canvas selection | 2 analysis, 1 outline, 1 scoped shot-plan fixture POST |
| Reopen and partially accept a saved draft | Completed | 3 | 4 | No; proposal and duration-mismatch checkboxes were visible | 2 analysis, 1 outline fixture POST; reopening sent none |
| Locate a blocked capability | Blocked as expected | 1 | 2 | No; blocking reason was inline | None |
| Reconcile interrupted work after reload | Completed | 2 | 3 | No; explicit `Check saved analysis` action | One analysis POST; reconciliation used GET and did not redispatch |
| Find a usable take → local cut | Blocked by baseline defect | 1 | 1 | No; approved takes appeared in story order | None; local assembly failed with `Failed to parse body as FormData.` |

The harness also records every action, wait-to-next-action timing and every snapshot containing more than one visible `.primary-button`. The persistent global `Export SVG` action competed with the current workflow primary action throughout successful Story/Assistant tasks and with local render in the cut task. This is a mechanical selector-based observation, not a user preference finding.

## Reproduction and evidence

The exact harness is `artifacts/simplified-flow/baseline-task-measurements/baseline-harness.ts`; the five adjacent JSON files are the raw action logs. The final serial run was:

```text
CINESERYE_MEASUREMENT_OUTPUT=<workspace>/artifacts/simplified-flow/baseline-task-measurements \
  npm run test:built:node -- e2e/baseline-task-measurements.spec.ts \
  --project=chromium --workers=1
```

Verdict: 5/5 harness cases passed with zero retries. A harness pass means the observed baseline outcome was captured accurately; it does not convert the expected blocked live capability or the local-assembly baseline defect into a successful user task.

## Candidate gate

Run the same five task definitions and fields on the frozen candidate. No task may add navigation-only steps without reviewed justification; at least one must remove steps; main-path competing primary CTAs and hidden selection prerequisites must be eliminated. The user must still identify the next action or blocking reason in the actual walkthrough.
