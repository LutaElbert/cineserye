# Scoped-shot final-digest admission — attempt 1

Final verdict: **PASS for bounded S1–S5, 9.15/10**, high confidence, fresh critic `scoped_dispatch_critic_1`. Correctness 9.2, simplicity 9.2, usability 8.9, safety 9.3, evidence 9.1; weights 30/20/20/20/10. No blocker/high finding in this slice. Separate from capability attempt 4, whose frozen snapshot is unchanged. No full phase acceptance.

## Criteria

- S1: First-time planning and explicit retry reject source edits, locks, cancellation, operation replacement, project replacement and review changes occurring while final source hashing is awaited. No POST after rejection.
- S2: Rejection preserves current creative changes, cancellation/replacement identity and a different current project. Never restore the previous retry parent into a different project.
- S3: Unchanged approved requests still dispatch once; existing eligible retry, successful-sibling preservation, recovery and acceptance behavior remain covered.
- S4: Existing capability admission, route-side authorization, quote/reference/source validation, consent and durable operation safety remain intact. This is a UI freshness repair, not new provider permission or a completed operation journal.
- S5: Corrected before-fix regressions, focused units, full offline suite, typecheck/lint/boundary/build and repeated three-engine browser verification pass. Record latest complete native evidence separately; do not inherit full-matrix acceptance for changed source.

## Candidate

Branch `feature/simplified-flow`, base HEAD `abfa0fab2fb26c775f639358521d9a29c3a6b640`. 311-file digest `8abdd8fc3ac266fc1056b2a297157a0004419e115d1049fe52eab1854d8ad916`, manifest `artifacts/simplified-flow/scoped-dispatch-attempt-1/source-manifest.json`. Root equals credential-free `/private/tmp/cineserye-scoped-dispatch-7dEslE`. Three files differ from capability attempt 4: `AssistantShotPlanning.tsx`, its test, and `e2e/capability-dispatch.spec.ts`.

The planner now compares synchronous scoped source/eligibility/operation identities before and after asynchronous preparation and final validation. Final comparison and POST have no intervening await. A committed review token invalidates work if input, quote or retry scope changes, including a later return to the previous value. Existing workspace admission still applies. Error cleanup also checks current project identity before restoring a retry parent or updating status. Canvas position/selection and save timestamps are outside the scoped source identity.

## Evidence so far

Corrected before-fix matrix: **12/12 fail**, each records one unexpected intercepted POST after its change, covering new/retry × six mutations. `scoped-before-corrected.json`. The initial test setup incorrectly returned only a quote for retry recovery GETs; this was corrected to return the saved state. Retain the initial setup report (`scoped-before.json`) without counting its six retry failures as product evidence.

After repair **21/21 focused tests pass**, `scoped-after-final.json`; typecheck and lint pass. Intermediate after reports retained: the two remaining lock assertions compared an unnormalized synthetic fixture with the normally normalized document. The fixture now applies the same `changeStory` normalization before replacement; source preservation assertion remains full-node equality. All initial before/after reports remain available.

Browser regression holds the real final digest after the actual IndexedDB completion callback, changes scope through the visible control, then requires an explicit local rejection and zero POSTs. Before-fix browser run: **3/3 failures** across Chromium/Firefox/WebKit against the copied capability-attempt-4 build, with POSTs intercepted; report `browser-before.json` and retained `browser-before/` traces. The new snapshot was then rebuilt from its own matching source.

Build, typecheck, lint and client-boundary passed. Full offline: **544 passed / 5 intentional paid/live skips / 0 failed**, `full-units.json`. Repeated browser matrix: **72/72 passes**, eight cases × three engines × three repetitions, no retries/skips/failures/flakes (2.0m), `browser-72.json`. It covers the new final-digest rejection, four existing capability/preparation/save cases, quote recovery, accepted three-scene shot plans through reload, and the submission journey through frames/downloaded clip. Command: `npm run test:built:node -- e2e/capability-dispatch.spec.ts e2e/scoped-shot-assistant.spec.ts e2e/story-development.spec.ts --grep 'workspace refresh before POST|old quote|final digest|accepted three-scene|submission journey' --repeat-each=3 --max-failures=3`. Final root/safe digests match the frozen candidate; independently confirmed by the fresh critic.

No complete native report for this newer candidate. The preceding capability-attempt-4 complete native run remains **NOT ACCEPTED, 8.94**, 547 pass / 1 manual-scene-creation failure / 4 baseline skips. Its fourth Add next scene click never produced Scene 05; root cause is not proved. This scoped dispatch slice neither fixes nor waives that separate failure.

Critic insight: one scoped identity comparison covers creative source, reference rights, locks and active operation instead of several competing booleans. Camera position and save timestamps are excluded so harmless interactions do not invalidate review. Existing workspace and server authorization boundaries remain independent. All S1–S5 passed for this bounded slice; full native and broad acceptance remain separate.

## Boundaries

No complete document/operation ownership or broad polling/result-adoption guarantee. Full simplification, all 58 criteria, Worker concurrency, exact-SHA Actions/$0 controls, export/restore/walkthrough proof and actual user approval remain open. No paid requests, remote writes, CI, merge or deployment. Existing 3040 preview unchanged.
