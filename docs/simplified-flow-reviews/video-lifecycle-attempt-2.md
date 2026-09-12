# Video lifecycle — attempt 2 (NOT ACCEPTED)

Fresh critic `video_lifecycle_critic_2`: **8.59/10**, correctness 8.2 / simplicity 8.8 / usability 8.7 / safety 8.5 / evidence 9.3. L1/L2/L3 pass; L4 fails; L5 evidence completeness passes but does not override the failure. All 54 repeated browsers pass (three engines, zero failures/skips/retries/flakes); independently rerun 53 focused tests pass. Manifest verified. A pre-stop live poll can overwrite the stored unknown stop with running, allowing a stale observer to resume ordinary polling. No duplicate dispatch demonstrated. Retain this attempt; repair with durable observation revision and atomic compare/write in attempt 3. Current draft `/private/tmp/cineserye-video-lifecycle3-9cW9T2` has two meaningful before-fix cross-repository late-running/late-ready failures. Root still contains attempt 1.

Candidate `/private/tmp/cineserye-video-lifecycle2-W85ygD`; 349 runtime/test/config/fixture inputs in `artifacts/simplified-flow/video-lifecycle-attempt-2/source-manifest.json`. Root integration is pending; root retains rejected attempt 1. L1–L5 criteria from attempt 1 remain unchanged. This is a bounded lifecycle gate, not full simplification acceptance.

## Repairs and evidence

- Protect old live failed/cancelled/timed-out checkpoints before EVERY repository pruning pass, including open, claim, read, completion and observation. Migration can now recover their original scope and handle under age, count and byte retention. Already-expired legacy keys without recoverable ownership fail closed globally; scoped modern tombstones are unaffected. This conservative legacy restriction needs provider/operator investigation, not automatic ledger deletion.
- Only `reconcile=1` on a user-triggered owned GET resumes an unknown operation. A successful check renews a separate 15-minute tracking deadline, preserves original provider start time, and cannot dispatch. Automatic polls do not renew it; the client consumes the explicit flag on its first request only.
- Six retention regressions seed the old SQLite schema directly. Age cases reopen a test-owned disk database; count and byte paths use memory SQLite. The byte test substitutes only accounting sizes to avoid a 256 MiB allocation; filtering, migration, SQL updates and admission remain real.
- Exact new assertions against frozen attempt 1: 10 pass / 8 fail. Seven meaningful new retention/window failures plus one existing transport-recovery test adapted to the new explicit query rejected by the old schema. Evidence `/private/tmp/cineserye-retention-before-izjX9q/retention-window-before.json`. Original five before-failure report also retained.
- Full offline suite: **634 pass / five intentional paid/live skips / 639 total**, mandatory native renderer tests enabled. Typecheck, lint, production build and client-boundary check pass. Existing large-chunk warning remains.
- Final browser repeat and fresh independent critic pending. No real provider, credentials, user SQLite database, deployment, CI or remote write was used. Browser tests use a fresh local fixture server and test-owned storage.

## Scope still open

Undo-independent operation journal, durable client intent, orphan recovery, missing-byte reconciliation, stage task measurement/projection, final full-native/Worker/exact-SHA CI/$0 controls, all 58 criteria and actual user walkthrough/visual approval remain open. Passing L1–L5 alone cannot close them.
