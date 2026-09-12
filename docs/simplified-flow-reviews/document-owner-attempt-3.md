# Document ownership and atomic deletion — attempt 3

Status: **PASS D1–D6, 9.30/10**, fresh critic `document_owner_critic_3`; bounded acceptance only, not full P2 or full simplification. Attempt 2 remains NOT ACCEPTED (8.23); its five full-native failures and six later passing unchanged Firefox motion tests remain preserved. The latter do not erase the full-run failures.

## Independent critic and disposition

Correctness 9.4, simplicity 9.0, usability 9.3, safety 9.4, evidence 9.4; weights 30/20/20/20/10, overall **9.30**, high confidence within the bounded scope. D1 one owner/validated commits, D2 session isolation/gesture parity/atomic delete, D3 source-checked durable replacement, D4 atomic storage, D5 source-matched evidence, D6 post-preparation writer checks: **all PASS**. Critic independently inspected source, installed XYFlow mechanics, both hashes and all JSON reports; build/typecheck/lint/boundary were parent-run evidence, not duplicate critic execution.

No blocking findings. Low maintainability finding deferred with an explicit rule: existing fallback node/edge remove handlers remain for compatibility, but every future compound user deletion must go through `DocumentController.deleteElements`, never two independent history writes. The active user-delete route is already centralized and covered in all engines.

Insights: one owner still requires one transaction per user action; removing a competing camera-option writer is preferable to treating a persistent framing failure as timing. Failed attempts remain retained. Next work is the separately reviewed media/operation draft and remaining plan criteria, not a final completion claim.

## Final verification

- Root/safe 319 files still match the frozen manifest after all tests.
- Required-renderer offline suite: **584 passed / 5 intentional paid/live skips**, 589 total; `full-units.json`.
- Repeated three-engine matrix: **81 passed**, zero failures/skips/retries/flakes; `browser-81.json` and `browser-81/`.
- Complete three-engine native suite: **582 total / 578 passed / 4 unchanged baseline skips / zero failed, interrupted, unrun or flaky cases**, retries 0, 13.6 minutes; `full-native.json` and `full-native/`. Four baseline skips are Firefox/WebKit versions of the two existing Chromium-only stress scenarios.
- Final typecheck, lint, build and client-boundary checks pass. Fixture runner stopped normally. No paid calls or remote writes.
- Fresh `document_owner_critic_3` has the final packet and is deciding the bounded D1–D6 gate. All earlier pending-verification notes below are preserved WIP chronology, superseded by this section.

Final candidate is now frozen at **462e6c5d5ad35782e8b3758275d71a99ea990bfc58ee55d33dfc5b93943db6bd**, 319 matching root/safe source files; manifest under this attempt's artifact folder. Fresh read-only `document_owner_critic_3` started. Final verification pending; the earlier “no critic yet” sentence describes the initial WIP state only.

Carries D1–D6 from attempt 2. D2 now explicitly covers a single Undo restoring a deleted node **and every incident connector**. New controller `deleteElements` validates and commits one graph change, respects locked/nondeletable nodes, removes related cinema data and records one history origin. Editor `onBeforeDelete` retains whole-canvas confirmation/recovery, rechecks the captured source after awaits and suppresses XYFlow's separate removal callbacks after the controller commit. No deferred document refs or duplicate state is reintroduced.

The unchanged connector-cascade regression failed in all three engines at line 644 on attempt 2. Source inspection of XYFlow confirms edge removals are delivered before node removals; the old second history entry therefore saw the already-deleted edge. New characterizations cover node+edge atomic undo/redo, edge-only deletion, no-op/locked targets and reader rejection.

Firefox motion failure evidence shows an unchanged camera at the immediate post-350ms read. Six unchanged focused reruns pass, so no application activation failure is established. The revised assertion retains actual camera movement, the minimum 350ms hold, <1px toolbar stability, inside/outside native release and undo/redo/reload checks. It now uses Playwright's condition-based attribute assertion rather than assuming a frame was serviced by the fixed delay. No skip, reduced concurrency or relaxed geometry tolerance.

Safe candidate `/private/tmp/cineserye-document-owner3-5Warjk`; no credentials. Initial typecheck/build passed; 27 controller/history/save units passed. Full offline/boundary/lint/repeated and full-native final-candidate evidence and fresh critic remain pending. A preliminary 81-case run began with the unchanged motion assertion still in the safe copy because a same-directory copy command was a no-op; preserve it as preliminary, copy the revised test before freezing and final verification. Do not label that report as the final source-matched candidate.

Media draft remains paused and isolated in `/private/tmp/cineserye-operation-owner-aeIkCO`; none of its unverified changes is included here. No commit/push/merge/CI dispatch, paid execution or deployment. All 58 phase criteria and the external gates remain open; proceed into remaining implementation after this bounded gate.

Further WIP evidence supersedes the initial motion hypothesis: the condition-based assertion also fails in Chromium after a full five seconds with the camera still at the overview transform. This is not merely a delayed frame. XYFlow's `fitView()` queues options in its store; `StoreUpdater` also writes the `fitViewOptions` prop whenever its identity changes. Editor supplied a new overview-options object on every render even though `fitView={false}`, overwriting a pending scoped navigation request. Remove that unused ReactFlow prop; retain the explicit Controls overview options and every programmatic scoped fit. This is the application repair being verified, not a timeout increase. Preserve both preliminary failing runs.
