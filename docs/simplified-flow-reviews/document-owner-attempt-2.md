# Document ownership and atomic replacement — attempt 2

Status: **NOT ACCEPTED — 8.23/10**, fresh critic `document_owner_critic_2`. User requested continued implementation after this milestone, not a final full-app claim.

Retains D1–D5 from `document-owner-attempt-1.md`: one current document owner; gesture/session isolation and existing interaction parity; serialized replacement with source/owner admission and persistence-before-publication; atomic document/media storage; exact-candidate regression proof. Additional D6: ordinary queued saves recheck writer ownership after asynchronous database opening, immediately before transaction creation. No broad operation-journal or full P2 acceptance is claimed.

Attempt 1 was NOT ACCEPTED, 8.36/10. Its unchanged canvas marquee regression failed three Chromium repetitions at Shift-add. Reports and verdict remain in its packet. Attempt 2 captures only selected IDs in native pointer capture before XYFlow resets selection; `onSelectionStart` determines the add/subtract/replace mode without reading already-cleared selection. This is transient gesture state, not another document mirror. Existing Shift/Alt marquee assertions are unchanged.

Ordinary saves now pass a controller-owned writer assertion through the persistence adapter and invoke it after the database-open await. A unit exercises owner detachment during adapter preparation; browser coverage exercises the actual persistence check and verifies no write. Replacement history is pre-cloned before persistence, so a cloning failure cannot first occur after the replacement commits. All other controller/admission/transaction behavior from attempt 1 remains.

Frozen 319-file candidate: `41a0114819d20952b6b4a246243718039a6953e819b0a11682d220a1ae8eb7f4`, matching root and credential-free `/private/tmp/cineserye-document-owner-Ds15Ei`. Manifest under `artifacts/simplified-flow/document-owner-attempt-2/`. That safe directory now holds attempt 2; attempt 1's report/digest is historical. Branch `feature/simplified-flow`, base HEAD `abfa0fa`, uncommitted private changes. Build/typecheck/lint passed. Remaining offline/boundary/repeated/full-native evidence and fresh verdict pending.

No live/paid calls, remote writes, CI dispatch or public deployment. Complete operation ownership/recovery, media preflight validation, stage guidance, export/empty-store restore/walkthrough evidence, all 58 acceptance mappings, Worker concurrency, exact-SHA Actions with verified $0 controls and actual user approval remain open.

## Final evidence and critic verdict

582 offline passed / 5 intentional paid-live skips; 54 repeated browser checks passed. Complete native matrix: **582 total, 573 passed, 5 failed, 4 unchanged baseline skips**, zero retries/flakes/interrupted/unrun, 17.0 minutes. Retained `full-units.json`, `browser-54.json`, `full-native.json` and full-native traces under `artifacts/simplified-flow/document-owner-attempt-2/`. Root and safe 319-file digest independently verified by critic. Both failing test files are byte-identical to accepted media baseline.

D1/D3/D4/D6 PASS; **D2/D5 FAIL**. Scores: correctness 7.6; simplicity 9.0; usability 7.7; safety 8.8; evidence 8.5. Weighted 8.23.

- High: `handleEdgesChange` and `handleNodesChange` independently record history during one cascaded deletion. With synchronous reads, the second boundary contains an already removed edge. The unchanged connector-cascade test fails at line 644 in all three browsers. Disposition: repair in attempt 3 with one validated deletion commit/history boundary; no deferred document mirror and no weakened Undo assertion.
- Medium: both Firefox actionbar tests fail at line 47 because the required camera movement did not occur. This is not proof of an activation failure. Disposition: independently reproduce the motion precondition, retain failed report and repair the verified cause.
- Low: stale autosave comment credits a layout effect instead of controller invalidation. Disposition: correct in attempt 3.

Critic insight: one authoritative document owner still needs one transaction per user gesture. The separate media-result draft is paused in `/private/tmp/cineserye-operation-owner-aeIkCO`; it was not copied into this frozen candidate and is not part of this verdict.
