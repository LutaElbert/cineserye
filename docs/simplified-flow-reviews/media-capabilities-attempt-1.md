# Shared media and Final Cut capabilities — attempt 1

Verdict: **PASS M1–M5, weighted score 9.38/10**, fresh critic `media_capabilities_critic_1`. This is a bounded adoption slice, not full P1/P4/P5 or app acceptance.

## Acceptance criteria

- M1: Images, video and Final Cut display the same status label/reason as the editor's validated capability contract, in simplified and retained legacy entry points. No independent provider-mode prop remains in these panels. Discovery itself performs no paid calls.
- M2: Unknown/blocked capabilities disallow new generation/render requests, including fixture mode. Local reference editing, existing media review/download and already dispatched work are not disabled merely by discovery failure. Review-required is not called verified/ready execution; endpoint checks remain authoritative.
- M3: Same-mode discovery replacement clears unsubmitted image/video consent, binds fresh endpoint preflight to the current discovery identity and rejects refresh/unmount during awaited preparation before POST. Final Cut rejects discovery/sequence changes during its fresh preflight before uploading clips. Existing route-side consent, scope and token checks remain unchanged.
- M4: Fresh capability discovery does not discard already-dispatched same-source image results or local render output. Existing video tracking continues when new requests become blocked. This does not claim a completed operation journal or resolve every pre-existing unknown-outcome/result-ownership issue.
- M5: Manual/media controls, approvals, mobile layouts, backup/reload and native export behavior remain covered by existing tests. No existing assertion/skip is removed to pass. Before-fix evidence, offline/build checks, repeated three-engine coverage and a complete native run must be recorded for the final candidate.

## Implementation

`WorkspaceFeatureStatus` derives execution-review eligibility, status and description from the shared contract. Editor and retained Inspector/Assistant pass that same contract into media/assembly consumers. Media provider mode is derived, not independently passed. `useScopedConfirmation` accepts an optional authority identity; existing callers retain their prior behavior while media approval expires on any discovery replacement. Existing `useWorkspaceAdmission` guards asynchronous preparation; endpoint preflight remains distinct and bound to its discovery identity.

Images separate creative source identity from transient quote/discovery identity so refreshing workspace status does not erase a dispatched same-source result. Project identity is included in that source. Video checks admission before writing its queued record and again before POST, with unmount guards for the new-request callbacks. Final Cut validates its endpoint capability shape and rechecks discovery/sequence before upload; refresh does not cancel a dispatched local render. No provider/route policy, paid execution or full operation-lifecycle rewrite is introduced.

## Evidence

Baseline: accepted actionbar digest `cd0bf80cc988310d4aaa8502de35fbb16021a0d807650cda8ef484566c37188f`. Credential-free before copy `/private/tmp/cineserye-media-before-N11WvS` uses that built application. Corrected before-fix browser matrix: **6/6 fail** (desktop/mobile × three engines), image consent remains enabled despite shared blocked discovery. Reports and traces under `artifacts/simplified-flow/media-capabilities-attempt-1/browser-before-corrected*`. Initial before report includes two Firefox compressed-response setup failures; these are not counted as product proof. Identity encoding fixed the test interception, with all assertions retained.

New unit coverage exercises authority replacement, blocked/unknown discovery, media-preparation races, unmount, late local-render preflight, malformed renderer preflight, and already-dispatched image/render result preservation. Development exposed an unmounted video callback and a queued-record write before final admission; both were repaired. Initial JSON falsely indicated success despite an unhandled runtime rejection; exit status/default-reporter evidence is preserved in `development-findings.md`, and that run is not accepted.

Credential-free validation copy: `/private/tmp/cineserye-media-adoption-oS71dp`. Final digest, commands, counts and independent verdict follow.

Final 316-file candidate digest: `6660af2944f88cc2f3f940c19a241164cfb7988df1883380fef35c47b6acdc10`, root/safe independently matched by fresh critic. Typecheck, lint, `git diff --check`, fixture build and post-build client-boundary pass. Existing large-client-chunk/static-route-classification build warnings remain; no threshold was changed. Focused `focused-units.json`: **30/30 pass**, exit 0 and no new React warnings/unhandled errors. Renderer-required `full-units.json`: **570 pass / 5 intentional paid/live skips / 0 failures**, exit 0; pre-existing AssistantShotPlanning act warnings remain. The admission tests use deterministic digest scheduling; real digest code runs in existing unit and built-browser coverage.

`browser-initial-9.json`: **9/9 pass**. `browser-108.json`: **108/108 pass**, twelve new/existing media cases × three engines × three repetitions, no skips/retries/flakes, 1.8 minutes. Command: `npm run test:built:node -- e2e/media-workspace-capabilities.spec.ts e2e/visual-preproduction.spec.ts e2e/video-preproduction.spec.ts --repeat-each=3 --max-failures=3`. Original nine media cases retain all assertions. Screenshots retained in `browser-108/`; these show local reference management after scrolling, not the status card itself. Status wording is browser-assertion covered. Native export preservation here is renderer-required offline route/media evidence, **not** completed browser decode/download/empty-store-restore proof.

Complete native: `npm run test:built:node`, no grep or maximum-failure cutoff. `full-native.json`: **570 total / 566 passed / 4 baseline skips / 0 failed / 0 interrupted / 0 not run / 0 flaky / 0 retries**, exit 0, 11.4 minutes. The four skips are the existing Firefox/WebKit exclusions of the two Chromium-only large-canvas stress cases; both Chromium cases passed. Root and safe source rehashed unchanged after testing. All owned verification runners stopped. No Worker or CI pass is inferred.

## Independent review

Fresh critic `media_capabilities_critic_1` independently matched the source digest and checked all panel call sites, before/after regressions, final reports, baseline skips and zero retries. **M1–M5 PASS**, no blocking new source finding. Plan-format scores: correctness **9.4**, simplicity **9.3**, usability **9.2**, safety **9.5**, evidence **9.6**, weights 30/20/20/20/10, total **9.38/10**. Separate equal-weight criterion average **9.40/10** (M1 9.5, M2 9.4, M3 9.3, M4 9.2, M5 9.6). Every category exceeds 8.5.

Main insight: discovery, consent and operation ownership have distinct responsibilities. Discovery can prevent a new request without erasing an existing result. Two pre-existing P4 follow-ups remain explicit: image/video preflight payloads still need runtime schema validation, and video artifact persistence needs ownership/unmount checks after awaits before document writes. The new video guard is pre-dispatch and top-level completion protection, not a claim that all late result writes are safe.

## Still outside this completion

Validated document controller/project replacement, full operation/result ownership and recovery, shared stage guidance, final export/empty-store restore/walkthrough proof, all 58 acceptance mappings, Worker concurrency, exact-SHA GitHub Actions with verified $0 controls and actual user visual approval remain open. No remote write, CI dispatch, push, merge, deployment or live/paid call. Old 3040 preview unchanged.

Rollback reference: the previous accepted application is preserved at `/private/tmp/cineserye-scoped-dispatch-7dEslE`. This slice changes thirteen source/test files relative to it. If rollback is requested, review and reverse only those media-adoption hunks (including prop call sites) and remove only the three new slice files after checking later edits. Do not reset the dirty checkout, undo earlier accepted work, downgrade project data, or delete media/operation storage. No schema migration occurred in this slice.
