# Story quote freshness — attempt 1

Status: **NOT ACCEPTED, 8.52/10**. Bounded continuation of `quote-toolbar-attempt-1.md`, not full P1/P2/P4 acceptance. Private branch `feature/simplified-flow`, HEAD `abfa0fa` plus preserved dirty work.

## Scope and acceptance

- Q1: Project, approved brief version and provider mode scope a displayed estimate. A same-mode automatic refresh invalidates the previous estimate; invalid/malformed/mismatched responses cannot preserve a ready estimate or consent. Explicit successful retry still requires fresh Live consent.
- Q2: Generation rechecks committed mode, quote identity/request epoch, count and consent after asynchronous preparation and before creating the local running record.
- Q3: After saving that record, recheck current project, workflow, semantic source and quote/mode before POST. A known pre-dispatch rejection becomes failed, not an unknown provider outcome. Own operation bookkeeping may reset presentation consent; it does not grant approval to changed source or estimates.
- Q4: Preserve successful fixture generation, atomic scene acceptance, undo/redo and reload. No paid calls, automatic retry, backend/schema change, or weakened server admission.

Two-file frozen sorted path/NUL/bytes/NUL SHA256: `c188824acd820eccf126bc121e8623c8a2ed4b07edd9be08ba1313385731e158`:

```
app/features/story-development/StoryDevelopmentPanel.tsx
e2e/story-development.spec.ts
```

Credential-free validation snapshot: `/private/tmp/cineserye-full-flow-3W6tpD`. Typecheck, lint and fixture production build pass. Initial 36/36 repeated built-browser checks passed across Chromium, Firefox and WebKit, zero retries/skips; retained `artifacts/simplified-flow/quote-freshness-attempt-1/browser-initial-36.json`. Expanded 45-case run adds a saved-record boundary to the paused-digest regression. Final report and independent critic verdict pending.

No remote writes, CI dispatch, deployments, paid/provider requests or billing changes. Exact-SHA CI, Worker compatibility, complete capability/document/operation adoption, real user walkthrough and all 58 criteria remain mandatory and open.

Final evidence: **45/45** expanded browser checks, zero retries/skips/flakes (`browser-45.json`), and **527 offline passes / 0 failures / 5 intentional paid/live skips** (`units.json`). Typecheck/lint/client-boundary pass. Fresh `quote_freshness_critic_1` independently verified frozen identity/snapshot and browser report. Scores correctness 8.0, simplicity 9.1, usability 9.0, safety 8.0, evidence 9.0 (30/20/20/20/10).

Blocking P1 finding: the pre-record workflow comparison precedes an awaited context digest. Reference permissions are not part of that semantic digest; a separate reference editor can change them during the await. Fixture and planning paths use explicit request approval, so presentation consent reset does not stop the request. Capturing preparedWorkflow after the local mutation can adopt the changed policy while retaining older references in the POST. This was source-confirmed by the critic; the first packet had no exact-boundary browser reproduction. Attempt 2 must recheck the approved snapshot after that await, before mutation, and test reference revocation through the separate editor. The same-mode test is combined automatic/explicit-refresh coverage, not isolated automatic-effect proof.
