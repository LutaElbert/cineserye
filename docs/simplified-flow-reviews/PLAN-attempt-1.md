# Simplified-flow plan — independent completion review, attempt 1

Date: 2026-09-10.
Candidate: `docs/SIMPLIFIED_FLOW_IMPLEMENTATION_PLAN.md`.
Candidate SHA-256: `b4ac80f38d7a22c58b132029c84bf439d125aea056aad6b21b35cdb0c2bf1e8f`.
Implementation baseline: private main `23af84303dd7571932e9faa94c80b2fd9b84d497`; tree `c90b7a3411014260ad06aa84c1a3088ccb5eb349` also matches source checkpoint `cf695d0`.
Fresh independent reviewer: `/root/simplified_plan_critic_1`.

## Verdict

**PASS for planning completeness — 9.30/10.** No blocker/high findings; no necessary candidate changes. All 45 criteria were independently judged sufficiently specified, feasible and measurable as future work. This is not a claim that any implementation phase has passed.

| Category | Score / 10 | Weight |
| --- | ---: | ---: |
| Correctness / coverage | 9.4 | 30% |
| Simplicity / maintainability | 9.2 | 20% |
| Usability / accessibility | 9.2 | 20% |
| Data / security / cost safety | 9.5 | 20% |
| Evidence / reproducibility | 9.0 | 10% |
| Weighted overall | 9.30 | 100% |

Confidence: high for planning completeness. Every category exceeds the 8.5 minimum and overall exceeds 9.0.

## Criterion-level planning verdicts

PASS means adequately specified in the plan, not implemented or runtime-verified.

| ID | Verdict | Reviewer assessment |
| --- | --- | --- |
| P0.1 | PASS | Documented connector regressions plus persistence/history coverage. |
| P0.2 | PASS | Actual geometry distinguished from zoom-induced measurement changes. |
| P0.3 | PASS | Reopening failure and intermittent mobile assertion covered. |
| P0.4 | PASS | Explicit engines, consecutive runs, no retries or concealed skips. |
| P0.5 | PASS | Worker-only CI versus port-gated native fixture gap correctly identified. |
| P0.6 | PASS | Real audit remediation without weakening gates or unsafe forced upgrades. |
| P0.7 | PASS | Complete baseline checks and historical/current evidence separation. |
| P1.1 | PASS | Capability inventory and unsupported-runtime behavior specified. |
| P1.2 | PASS | Truth table addresses contradictory readiness fields. |
| P1.3 | PASS | Verification identity/age cannot replace admission. |
| P1.4 | PASS | Server preflight and approval invalidation remain authoritative. |
| P1.5 | PASS | Consistent display without global admission tokens. |
| P1.6 | PASS | Failure/version behavior and nonmutating discovery specified. |
| P2.1 | PASS | Mutation/history ownership and observable batch semantics. |
| P2.2 | PASS | Transient UI separated from substantive source state. |
| P2.3 | PASS | Existing-data invariants and safe schema compatibility. |
| P2.4 | PASS | Persistence failure/race coverage and durable save requirement. |
| P2.5 | PASS | Origin-wide single-writer policy accurately preserved. |
| P2.6 | PASS | Characterization-first incremental migration. |
| P3.1 | PASS | Entry-state and primary-action requirements observable. |
| P3.2 | PASS | Navigation cannot dispatch AI or create another authoritative store. |
| P3.3 | PASS | Understandable fixture journey and manual entry. |
| P3.4 | PASS | Upstream invalidation, asset retention and consistent locks. |
| P3.5 | PASS | Explicit viewport, zoom, keyboard, motion and accessibility gates. |
| P3.6 | PASS | Actual screenshots and explicit user visual approval. |
| P4.1 | PASS | Lifecycle mapping and honest progress units. |
| P4.2 | PASS | Ordering, concurrency, cleanup, backoff and errors testable. |
| P4.3 | PASS | Safe cancellation and unknown-outcome reconciliation. |
| P4.4 | PASS | Retry scope/idempotency, late results and project isolation. |
| P4.5 | PASS | Reachable persistent recovery and explicit acceptance. |
| P5.1 | PASS | Reference ownership/version/permission invalidation. |
| P5.2 | PASS | Exact dispatch approval and fixture labelling. |
| P5.3 | PASS | Provider completion separated from usable validated media. |
| P5.4 | PASS | Sequence validity without silent omissions or padding. |
| P5.5 | PASS | Renderer constraints match source; real local decode/download required. |
| P5.6 | PASS | Export persistence promises correctly limited. |
| P6.1 | PASS | Replacement inventory, legacy data and deep-link preservation. |
| P6.2 | PASS | Safety/recovery cannot disappear into advanced settings. |
| P6.3 | PASS | Shared validation constrained by route/runtime semantics. |
| P6.4 | PASS | Interaction invariants and bounded lifecycle-leak exercise. |
| P7.1 | PASS | Exact-candidate verification and separate runtime reporting. |
| P7.2 | PASS | Three-engine failure/recovery coverage and synthetic export. |
| P7.3 | PASS | Exact-SHA CI; exhaustion cannot authorize payment or skips. |
| P7.4 | PASS | Scores cannot override failures, severe risks or missing approval. |
| P7.5 | PASS | Durable private handoff with evidence and limitations. |

## Findings, insights and parent disposition

1. **Low — make FFmpeg provisioning explicit.** Existing renderer integration tests use capability-dependent skipping (`app/server/cinema/assembly.test.ts:22`); assembly needs both binaries (`app/server/cinema/assembly.ts:48`). **Accepted as required execution follow-through for P0/P5:** record `ffmpeg` and `ffprobe` versions and expected/executed test counts in the native test packet. Missing binaries or skipped required renderer tests cannot satisfy synthetic-export acceptance. No binaries were installed or tests run in this planning turn.
2. **Low — stage projection/invalidation table before navigation.** P3.1–P3.4 already require derived stage state. **Accepted as the first P3 design artifact:** enumerate empty/proposed/accepted/stale/blocked/partial states, allowed actions and invalidation effects before implementing the shell. This table derives from existing project records; it must not become another mutable workflow database.
3. **Low — keep completion packets phase-specific.** **Accepted:** list relevant IDs for each attempt, with a reason for genuinely unrelated NOT APPLICABLE entries. Unexecuted mandatory criteria remain NOT VERIFIED, never NOT APPLICABLE. This reduces review overhead without weakening acceptance.

No finding was rejected or waived. These are implementation follow-through within existing criteria, not evidence that the actions have been executed. The reviewed candidate remained unchanged after review.

## Independent evidence inspected

- Existing four-status schema and configuration-only evidence: `app/features/story-development/workflow-capabilities.ts:4`.
- Hard-coded configuration values in stage construction: `app/server/cinema/workflow-capabilities.ts:16`.
- Recursive video polling: `app/features/video/VideoPreproductionPanel.tsx:256`.
- Exclusive origin-wide writer lock and reader fallback: `app/editor/useDocumentWriter.ts:5`.
- Native-local request validator, not hosted authentication: `app/server/cinema/local-request.ts:4`.
- Fresh operation-local renderer admission: `app/features/assembly/SequenceReview.tsx:82`.
- Export limitations/backup exclusion: `app/features/assembly/SequenceReview.tsx:139`.
- Full frame/runtime/silence validation: `app/server/cinema/assembly.ts:116`.
- Worker-only CI target: `.github/workflows/ci.yml:29`; port-specific fixture skips: `e2e/story-development.spec.ts:20`.
- Prior failures and dated budget observation: `artifacts/local-merge-review-2026-09-10.md`.
- Reviewer independently verified matching merge/checkpoint Git trees.

Parent validation: 45 unique acceptance IDs; all literal app/test/workflow source paths in the candidate exist; tracked workspace code matches merged baseline; `git diff --check` passed. These are document/source checks, not fresh application test results.

## Limitations and next action

Current GitHub CI and billing settings were not reverified by the critic; the plan requires rechecking before dispatch/merge. Future phase behavior, user visual approval, live provider quality and hosted readiness remain NOT VERIFIED. No application code, credentials, deployment, GitHub state or paid-provider calls were changed for this review.

Planning deliverable is accepted. Next implementation action, after user approval: begin P0 in an isolated branch/checkout with explicit native/Worker test inventory and baseline repairs. Every subsequent completion attempt requires a new independent critic under the candidate plan's protocol.
