# Document ownership and atomic replacement — attempt 1

Status: **NOT ACCEPTED, 8.36/10**, fresh critic `document_owner_critic_1`. No full P2 or app acceptance. Attempt 2 must repair the marquee regression and receive a fresh review.

## Bounded criteria

- D1: One controller owns the current in-memory document, synchronous functional field updates, source revision, validated domain commits, history and save status. Editor reads the same snapshot and read-only current-value views; no independent document-ref synchronization remains. Existing trusted canvas gesture adapters remain, with full validation at completed domain and persistence boundaries.
- D2: Selection/measurement-only changes do not dirty saving or advance source revisions. Existing graph geometry, gestures, one-step domain acceptance, undo/redo, media roots and nonlinear workflows remain covered. Checkpoint undo includes the document title.
- D3: New, portable backup, checkpoint and recovery replacements reject stale source/owner, lock creative edits, drain prior saves and persist before replacing the visible document. Errors preserve current content/history; failed-load protection remains until durable successful replacement. Reader/unmount and duplicate replacement paths fail closed.
- D4: Document, included portable images and pending-proposal cleanup commit in one IndexedDB transaction. Preparation, hash mismatch, quota failure and synchronous transaction write errors do not partially replace work. Existing media, checkpoints and provider operation ledgers are not deleted. New explicitly clears its old recovery copy; no project schema migration.
- D5: Characterization units precede caller migration. Source-matched offline/build/type/lint/boundary checks, before/after restore regressions, repeated three-engine checks and full native regression pass. No new skips or assertion weakening. Fresh critic independently scores this bounded candidate.

## Implementation and scope

`DocumentController` owns current document fields and publishes a React external-store snapshot. Stable existing field adapters retain canvas gesture behavior. `commit` validates complete domain batches; `save` validates the persisted document. Read-only getters replace four mutable mirrors. The controller owns the existing `DocumentHistory` and `DocumentSaveQueue`, retaining media roots and serial save semantics. Hook dependencies now explicitly include those stable adapters/views; no lint rule was disabled.

The replacement boundary captures creative revision plus project epoch, disallows overlapping replacements, blocks ordinary writes while active, drains the save queue and calls `replaceLocalDocument`. IndexedDB validates/prepares portable media before one document/media/pending transaction. A synchronous write exception explicitly aborts that transaction. The controller publishes new content/history only after durable success. New/backup reset history, checkpoint/recovery retain one undo boundary. A busy announcement remains outside the temporarily inert editor.

Baseline: preceding media capability slice, 316-file digest `6660af2944f88cc2f3f940c19a241164cfb7988df1883380fef35c47b6acdc10`, retained `/private/tmp/cineserye-media-adoption-oS71dp`. Current validation `/private/tmp/cineserye-document-owner-Ds15Ei`; before-build `/private/tmp/cineserye-document-before-mIU5gF`. No credentials copied; fixture/live-off only.

## Evidence (pending final candidate)

Before Editor migration, 18 controller/save-queue characterization tests passed. One initial harness failure revoked writer admission before the older write had actually started; the test now waits for the observed write, then tests revocation while that write drains. One additional title-undo test was added during integration.

Initial integrated units: **581 pass / 5 intentional paid/live skips**, renderer required. Initial built browser: **36/36 pass**, existing failed-load recovery and simplified flow cases across three engines. Retained under `artifacts/simplified-flow/document-owner-attempt-1/initial-*`; these predate final atomic-transaction/busy-announcement refinements and are not final-candidate acceptance evidence. Initial duplicate aria-busy prop and dependency-array type/compiler errors were corrected; no rule suppression.

Frozen 319-file digest `6f163ecb74fc53b45bc0bdb0731d4f561e02cda424ad512cc3d496cacfa8b76a`, root/safe match. Final typecheck/lint/build/boundary pass. Corrected baseline `before-corrected.json`: 6/6 actual failures across three engines: failed save changes displayed title; delayed parse overwrites newer edits. Initial `before-selector-failure.json` failed to match the complete title label and is setup evidence only. Corrected test uses the textbox role; assertions retained. Candidate `replacement-browser-9.json`: 9/9 pass, including document/media transaction rollback.

Critic identified the old marquee code's reliance on deferred ref synchronization. Reproduction in unchanged `canvas-behavior.spec.ts`: Shift-add selection loses previous selection. `marquee-regression.json`: 18 planned / 3 pass / 3 Chromium failures / 2 interrupted / 10 unrun, cutoff after three failures, no retries. All three failures target line 140 expecting three selected layers after Shift-marquee. No full native run was attempted for this rejected candidate.

Fresh verdict: D1 PASS on inspected ownership; D2 FAIL (selection regression); D3/D4 PASS on inspected replacement/transaction boundary and targeted evidence; D5 FAIL/incomplete. Scores correctness 7.8, simplicity 9.0, usability 7.8, safety 9.2, evidence 8.2; weights 30/20/20/20/10, **8.36/10**. Fix required: capture selected IDs as gesture/session state before XYFlow's synchronous selection reset, not another mutable document mirror. Ordinary save admission after DB-open awaits and broader operation ownership remain open. Retain this failed verdict and traces; do not retroactively accept it.

## Still open

Full operation/result ownership, endpoint media preflight validation, complete operation presentation and expiry/recovery; stage guidance and measured navigation; browser cut download/empty-store restore and remaining 58-criterion traceability; Worker concurrency; exact-SHA Actions with verified $0 controls and actual user visual/walkthrough approval. This controller increment is not an operation journal. The user asked to continue through remaining safe work rather than stop at this milestone. No paid call, commit/push, merge, CI dispatch, deployment or public-release edit is authorized by this packet.
