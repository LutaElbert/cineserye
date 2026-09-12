# Story quote freshness — attempt 2

Fresh critic **PASS, 9.16/10** for Q1–Q4. This is a bounded repair, not a full phase acceptance. Attempt 1 remains **NOT ACCEPTED, 8.52/10** despite 45 browser passes and 527 offline passes.

## Repair

Capture the current pre-record document and compute its semantic digest. After that await, synchronously compare the current workflow with the originally approved workflow, confirm project identity, and reject any intervening document change. Only then validate current approval and create the local running record. Existing post-save/current-quote checks remain intact. This prevents a reference-policy change from being adopted as the saved baseline for older approved input.

Frozen two-file sorted path/NUL/bytes/NUL SHA256 `9b55bf18ead9e2edc0b74dec32d6e5efe1de0523dbdd6ee5a6f21e15de8a0430`:

```
app/features/story-development/StoryDevelopmentPanel.tsx
e2e/story-development.spec.ts
```

New regression: attach an owned image with Story and shot-planning permissions; approve the direction; pause the third generation digest (the pre-record source); withdraw Story permission through the separate premise reference editor; resume. Require the local source-changed message, zero POST, and no unresolved request. Uses real UI permission controls, not direct React/document mutation; any POST is intercepted/aborted.

Test setup initially needed reopening the premise editor before focusing it; that failure is retained as `artifacts/simplified-flow/quote-freshness-attempt-2/test-setup-failure.json`, not product proof. The corrected regression **failed against attempt 1's build**: an intercepted POST was attempted and UI showed `Failed to fetch` / `outcome-unknown`. Before-fix report, screenshot/context/trace are retained as `before-fix-failure.json` and `before-fix/`. The repaired build is now undergoing the expanded 54-check browser matrix.

No paid/provider calls, remote writes, CI dispatch, deployment or budget changes. All complete-phase gates and actual user approval remain open.

## Final bounded evidence

**54/54** browser checks (six cases × three engines × three repetitions), zero retries/failures/skips/flakes. New reference-permission regression passes 9/9 after failing the earlier build. Report `artifacts/simplified-flow/quote-freshness-attempt-2/browser-54.json`. Full offline suite: **527 passed / 0 failed / 5 intentional paid/live skips**, `units.json`. Fixture production build, typecheck, lint and client-boundary check passed in the credential-free snapshot.

Fresh `quote_freshness_critic_2` independently verified the source digest/byte identity, both passing reports and before-fix evidence. Scores correctness 9.2, simplicity 9.0, usability 9.0, safety 9.3, evidence 9.4; weights 30/20/20/20/10. No blocking finding. Q1–Q4 accepted only; full native/Worker, exact-SHA CI and actual user walkthrough remain open.

Insights: preserve the demonstrated before-fix failure when refactoring the implementation-coupled third-digest pause. Same-mode refresh coverage combines automatic and explicit paths. Whole-document comparison deliberately rejects conservatively; future source revisions can narrow this without weakening reference-permission checks. Never adopt a newer source as approved merely because it was saved with the running record.
