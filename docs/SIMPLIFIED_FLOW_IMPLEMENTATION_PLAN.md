# Cineserye simplified flow — implementation plan

Date: 2026-09-10. Revision 3: user-approved Story / Shots / Edit workspace grouping; all 58 revision-2 acceptance criteria and gates retained. No full phase accepted yet.
Baseline: private `main` merge `23af84303dd7571932e9faa94c80b2fd9b84d497` (tree matches `cf695d0`).

## Outcome and boundaries

Give a filmmaker one understandable journey: **Idea → Plan → References → Video → Final Cut**, with one consistent answer to what works, what needs approval, what is blocked, and what happens next. Preserve the canvas as the detailed editing surface; simplify navigation and ownership without rebuilding the application or replacing saved projects.

This document authorizes no deployment or paid execution. Implementation is separate private-repository work following user approval. The frozen public hackathon source, hosted reviewer site, credentials, existing media, and spend ledgers remain untouched. Live provider proof requires separate explicit authorization; fixture completion never implies live or hosted readiness. The previous merge's accepted failures are not permission to waive future acceptance gates.

Continue on `feature/simplified-flow`, as explicitly requested by the user. The active checkout is `/Users/elbert/Documents/ChatGPT/Cineserye`; preserve unrelated work and untracked artifacts. The earlier `codex/` branch-name proposal is superseded.

## Source-grounded starting point

- A versioned contract already exists in `app/features/story-development/workflow-capabilities.ts`, served by `app/server/cinema/workflow-capabilities.ts` and `app/api/cinema/workflow-capabilities/route.ts`. Extend and relocate shared ownership where appropriate, not a competing second contract.
- That contract distinguishes fixture/configured-unverified/blocked/requires-preflight and explicitly says configuration-only. It does not yet provide a complete shared research/reference/runtime view. Several stage builders hard-code `configured: true`; correct the semantics rather than simply relabeling them.
- `app/editor/Editor.tsx` still fetches provider status and story availability separately. Video and assembly have their own authoritative preflights. A common display contract must not remove fresh server-side checks or expose admission tokens globally.
- `app/features/video/VideoPreproductionPanel.tsx` already uses recursive polling after responses. The earlier audit of the separate coordinator on port 3117 is context, not proof that this checkout has overlapping interval polling.
- `app/editor/useDocumentWriter.ts` implements an origin-wide single-writer browser lock, not a document/history controller. Preserve that protection while extracting persistence ownership.
- `app/server/cinema/local-request.ts` already supplies native-local request validation. Reuse it where the same policy applies; do not assume native-local validation is hosted authentication.
- `app/features/assembly/SequenceReview.tsx` already reviews approved takes and renders a local silent MP4. Current constraints: 720p, 24fps, up to 24 clips/120 seconds; no music, captions, transitions, or source audio. Final Cut is a stage name, not an integration with Apple's product.

## Product contract

| Stage | Primary task / output | Completion rule |
| --- | --- | --- |
| Idea | Enter premise, answer necessary questions, review direction | User confirms a saved direction; opening or typing never dispatches AI |
| Plan | Review research when available; propose/accept scenes and scoped shot plans | Required scenes and shots are explicitly accepted; proposals remain separate |
| References | Upload/select identity references and review generated reference images | Each selected shot has the required approved reference or an explicit supported no-reference path; never silently waive a provider requirement |
| Video | Review scope, estimate and approval; generate/review takes | A current usable take is explicitly approved for every shot included in the cut |
| Final Cut | Review sequence, trims, missing media, render and download | Current selected clips validate and produce a playable downloadable local silent MP4 |

The five stages are task states within three top-level workspaces, not five new document stores or five mandatory top-level tabs. The user approved this refinement after revisiting the concept screens:

| Workspace | Journey coverage |
| --- | --- |
| Story | Idea and scene planning: develop direction, review proposals, accept scenes |
| Shots | Scoped shot planning, References and Video: refine shots, attach references, generate and review takes |
| Edit | Final Cut: order approved clips, preview, render and download |

Plan spans scene planning in Story and scoped shot planning in Shots; stable scene/shot identity connects them. Research is a capability within Plan. Reference upload, reference-image generation, and video generation are distinct capabilities. Manual planning and local uploads remain possible when AI is blocked. Users may inspect any stage; unavailable actions show an adjacent reason and safe next step. Never trap users in a linear wizard or trigger work by selecting a workspace or stage. The actual-screen and walkthrough approval gates below remain mandatory; approval of this grouping is not approval of unimplemented UI.

Keep one contextual primary action per active stage; secondary actions include back/review, manual editing, and recovery. Advanced controls remain accessible with stable project/scene/shot identity. Changes upstream mark dependent outputs stale and require review; they never silently delete approved work or regenerate media.

### Coverage and explicit exclusions

| Concern | Required coverage |
| --- | --- |
| Primary journey and actual reduction in navigation | P3.1–P3.9; measured task comparison, not just five new tabs |
| Existing nonlinear planning and professional tools | P0.9, P3.7–P3.8, P6.1; explicit retention/replacement map before UI changes |
| Capability, consent and provider data transfer | P1.1–P1.7, P5.1–P5.2, P5.7 |
| Project recovery, media backup and safe cleanup | P2.1–P2.8, P5.3, P5.6 |
| Progress, unknown/expired results and safe retry | P4.1–P4.6 |
| Local renderer, runtime and CI prerequisites | P0.5–P0.8, P5.5, P7.1–P7.4 |
| Accessibility, untrusted content and scale | P3.5, P6.3–P6.6 |
| Reproducible acceptance, review and rollback | P7.1–P7.6 and the critic/rollback protocols |

Intentionally excluded, not forgotten: cloud sync/accounts/team collaboration; new hosted execution or providers; paid-model semantic/media verification; music, voiceover, captions, transitions and a full nonlinear editor; embedding video bytes into portable project backups; public deployment/submission changes. Existing planning audio notes are still preserved even though rendered audio is excluded. Adding any excluded capability requires a separate scope decision. This is coverage of the agreed private simplification, not a claim of exhaustive future product scope.

## Delivery sequence

Each phase is a small reviewable slice with a completion packet and a freshly spawned independent critic. Dependencies: P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7. Planning/design previews may be prepared earlier, but no dependent phase is accepted before its prerequisites. No big-bang rewrite or arbitrary line-count target.

Implementation-order exception authorized by the user's “proceed, use your best judgements” after the ordering question: document/operation separation and other safe local simplification work may proceed before P0 acceptance. This changes implementation order only, not acceptance dependencies, the 58 criteria, fresh-critic reviews, exact-SHA CI, cost controls or actual user visual/walkthrough approval. Keep the Worker baseline gate open; do not let it prevent independent safety repairs. An interim fail-closed undo boundary is not completion of the durable operation/controller extraction.

### P0 — restore a trustworthy baseline and CI coverage

Work: reproduce and repair the known canvas regressions; distinguish broken behavior from timing/obsolete selectors with traces and source evidence. Audit existing CI coverage and dependency findings before claiming a green baseline.

Acceptance criteria:

- **P0.1:** Added Note no longer prevents the intended Story connector interaction; reconnect and reverse-connector creation/deletion pass with undo/redo and reload coverage.
- **P0.2:** Checklist preserves intended document geometry, trims the trailing empty row, fits its contents, and survives undo/redo/reload. Assertions distinguish world-space geometry from viewport zoom; no relaxed tolerances to hide an actual layout defect.
- **P0.3:** Story reopens after saving/reloading, with usable focus controls and retained content. Locked mobile editor remains readable after resizing; replace instantaneous geometry assertions with condition-based settling where justified, not arbitrary sleeps.
- **P0.4:** The previously failed cases pass three consecutive focused runs without retries in Chromium, Firefox, and WebKit. Every pre-existing skip has a recorded reason; no new skip or deleted assertion conceals a regression. Migrate obsolete selectors while preserving user-behavior assertions.
- **P0.5:** CI explicitly separates built native-Node fixture workflow tests from local built-Worker compatibility/unsupported-feature tests. Current Worker-only execution on port 8787 must not silently skip the suites gated on port 3040. Replace magic-port eligibility with explicit test/runtime configuration; record expected, executed, skipped and failed counts for each suite.
- **P0.6:** Dependency audit findings are inventoried with package path, severity, affected runtime and remediation. The high-severity audit gate must pass before P0 completion; if no safe upgrade is available, report the phase blocked rather than run a forced downgrade or weaken the gate. Track remaining moderate findings with concrete owners and follow-up criteria.
- **P0.7:** Compatibility check, typecheck, lint, client-boundary check, all offline unit tests, production build, audit gate, and the repaired browser matrix pass. Preserve old failed-run evidence as historical, not current proof.
- **P0.8:** Record Node/package-manager/lockfile/browser versions and native `ffmpeg`/`ffprobe` availability in local and CI packets. Provision required renderer tools in the native lane and assert expected/executed renderer test counts: capability-dependent skips cannot stand in for P5/P7 render proof. Unsupported-runtime negative tests remain a distinct lane. This promotes an already accepted attempt-1 review requirement into the canonical plan.
- **P0.9:** Before controller or shell changes, inventory current user actions with source/test, retained or replacement location, and data invariants. Include manual typed layers and connections; Surprise/Continue/scoped revisions/history/partial acceptance; professional table/board, separate narrative/production ordering, setups, continuity warnings/exceptions and shot edits; individual image/video downloads, the revision-specific six-file planning handoff and canvas SVG export. These may remain secondary/advanced; removal without tested replacement requires a new user decision. Capture the repaired-baseline task measurements for P3.9 here.

Primary files: `e2e/editor.spec.ts`, `e2e/layer-behavior.spec.ts`, `e2e/layer-editor.spec.ts`, `app/editor/Editor.tsx`, `playwright.config.ts`, `.github/workflows/ci.yml`, dependency manifests as needed.

### P1 — one capability and readiness contract

Work: evolve the existing versioned schema under shared domain ownership; provide one client query/store and pure selectors. Integrate existing server preflights through adapters. Keep configuration evidence separate from last execution evidence and immediate admission.

Acceptance criteria:

- **P1.1:** Contract covers research, analysis/story, shot planning, local reference upload, generated images, video, and assembly. Runtime and provider mode are explicit. Unsupported runtimes default closed; do not advertise a new hosted adapter that is not implemented.
- **P1.2:** Define and test a truth table for missing configuration, disabled policy, unsupported runtime, fixture, configured-unverified, request-preflight-required, and verified execution evidence. No impossible combinations of `configured/enabled/ready/status`. Prefer deriving display state over independently writable booleans.
- **P1.3:** Verified evidence, if present, includes feature/provider/model/runtime/configuration identity and timestamp. A mismatch or expiry yields unverified, not ready. Historical successful output does not waive current scope/cost/reference approval. No automatic live probe is introduced.
- **P1.4:** Fresh route-side preflight remains authoritative for mutations. Permission, budget, model, source revision, and selected scope changes invalidate applicable approvals. Tampered/stale client capability responses cannot enable execution.
- **P1.5:** Editor, Assistant, media panels, stage navigator and diagnostics show the same capability reason from the shared contract. They do not invent provider readiness or mutate integration objects to impose restrictions. Endpoint-specific admission tokens stay short-lived and operation-local.
- **P1.6:** Loading, offline, malformed response and old contract versions have tested fallback behavior: no false ready badge, no secret values, no paid dispatch, manual editing still available. GET discovery performs no paid calls or execution-state writes.
- **P1.7:** Preserve explicit, scope-bound estimate/approval for every chargeable stage, not just video: research, analysis/story, revisions, shot planning and images. Show the applicable model, selected scope, estimate/ceiling and reference-transfer purpose before dispatch; late quotes or mode/model/reference/source/scope changes clear approval. Server tests reject missing consent, invalid/expired quotes and changed scope. An existing operation's reservations/history are not reset by changing stages; unknown actual cost stays unknown. Fixture tests prove opening panels, editing permissions and switching stages send no live requests.

Evidence: schema/adapter/route truth-table tests; malformed/stale/version tests; fixture and unsupported-runtime UI screenshots; request logs demonstrating zero provider dispatch during discovery.

### P2 — one document mutation/history boundary

Work: extract an incremental document controller from Editor, starting with commit/history/persistence. Keep UI state, operation state and persisted project data distinct. Reuse existing serializers, revision checks, media retention and single-writer lock.

Acceptance criteria:

- **P2.1:** A documented controller API owns validated document commits, undo/redo and save status; one accepted batch creates exactly one reversible history entry. No module relies on independently synchronizing duplicate document state and refs.
- **P2.2:** Selection, focus, open stage and transient progress do not contaminate source fingerprints, generation approvals or history. Repeated typing/navigation does not auto-fit or reposition the canvas.
- **P2.3:** Existing project/checkpoint/backup fixtures round-trip with stable IDs, graph positions, accepted/proposed distinctions, reference ownership, media hashes and lineage, subject to the explicit bytes-versus-metadata boundary in P2.7. Any schema migration is versioned and idempotent; unknown newer versions are refused non-destructively with a backup/recovery path.
- **P2.4:** Save failure, quota exhaustion, corrupt backup, late save, undo during an operation, project replacement and reload are covered. Never show Saved before durable success. Unsaved work stays recoverable and the user can export a backup.
- **P2.5:** The existing origin-wide writer lock remains intact; second-tab writes fail closed, missing-lock support stays safe, and the existing read/recovery behavior remains usable. No unapproved expansion to simultaneous multi-tab writers.
- **P2.6:** Extracted code passes characterization tests before callers are migrated. Each slice has equivalent observable behavior and a reversible code change; no bulk rewrite of persisted browser data.
- **P2.7:** Backup UI distinguishes included reference/storyboard image bytes, video-clip metadata only, and excluded rendered-cut files; users are told before relying on the backup to download videos separately. A restore into an empty isolated browser store restores included images, marks missing video bytes unavailable, and cannot render or approve a metadata-only clip as usable. Preserve individual downloads while bytes exist. For missing bytes, show only supported recovery options (retained source browser or an existing verified retrieval path); if none exists, say it cannot be restored from that backup. Do not promise a new clip-upload/relink feature or silently expand the backup format. Missing required images, corrupt hashes or oversize archives reject atomically without replacing current work.
- **P2.8:** Controller migration retains all media-cleanup roots: current project, undo/redo, in-progress drag/resize/field/text edits, proposals, recovery, checkpoints and pinned media. Existing destructive confirmation, transactional reachability recheck and cross-tab cleanup lease remain enforced. Tests prove newly reachable/pinned media survives cleanup, another editor tab blocks it, cancellation deletes nothing, and unsupported lock capability fails closed. Cleanup is an explicit user action, never a consequence of changing stages.

### P3 — the five-stage journey within Story / Shots / Edit

Work: build a lightweight stage shell and one shared stage model over existing project data. Keep the existing canvas/Outline and use the approved light visual direction as inspiration, with real screenshots for approval rather than treating a generated image as an exact specification.

Implement the complete Story slice first within this phase: idea → proposal review → atomic scene acceptance → undo → safe reload. Then extend the same ownership patterns into Shots and Edit. This is a delivery slice, not permission to accept P3 before its remaining criteria or bypass P0–P2. Document/session/capability/operation state each retain their own authoritative owner; no giant combined store is required.

Acceptance criteria:

- **P3.1:** First-run, existing-project and restored-project entry each show current stage, actionable next step, saved state and blockers without opening diagnostics. Exactly one primary action per active stage; no competing start-flow buttons.
- **P3.2:** Stage selection has zero AI POST side effects. Back/forward/reload and stage changes preserve draft inputs, explicit scope, active project and media approvals. A projection computes stage state from authoritative records, not a second editable workflow database.
- **P3.3:** Idea → accepted scenes → scoped accepted shots → references → approved fixture takes → local cut is reachable without knowing provider names or selecting invisible canvas nodes. Manual entry and existing projects do not require restarting onboarding.
- **P3.4:** Editing an accepted premise/plan marks dependent work stale with a reason and review action. Existing assets remain visible and recoverable. Locked scenes/shots cannot be changed through a different stage entry.
- **P3.5:** Desktop 1440×900, short 877×559, and mobile 390×844 show reachable primary actions and readable stage content without page-level horizontal overflow. Keyboard order/focus restoration, reduced motion and 200% browser zoom work; no serious/critical automated accessibility violations in the new stage states.
- **P3.6:** Show the user screenshots of all five stages plus blocked, empty and partial-completion states before accepting the visual direction. Explicit user visual approval is required before visual rollout; critic scores do not replace it.
- **P3.7:** Preserve nonlinear Plan scenarios with named tests: edit/reorder proposals; accept one of several and keep unselected drafts; reload/reopen remaining drafts; revise only selected proposals without changing accepted scenes; inspect older/stale revision lineage without POST or adoption; later accept eligible remaining work once, with one history entry per batch. Preserve Surprise as explicit confirmed premise replacement, not automatic scene insertion. Stage changes and old-history navigation never mutate accepted work.
- **P3.8:** Continue is anchored after an explicitly reviewed scene and measures requested duration as additional material, not a replacement total. Existing manual scenes, order and allocated runtime remain intact. Missing duration is corrected locally, invalidates the appropriate review, and generates nothing. Under/over-allocation and partial acceptance show selected/new/whole-project totals and require the existing explicit mismatch confirmation; no stretching, duplicate insertion or silent loss of drafts. Existing reference and continuity scope follows the confirmed insertion.
- **P3.9:** Before coding navigation, freeze a stage projection/transition table covering empty, proposed, accepted, partial, stale, blocked, running, failed and unknown/expired states, with primary action and invalidation rules. Compare the same scripted tasks on the P0 repaired baseline and candidate: new idea to accepted shot plan; reopen/partially accept a saved draft; locate a blocker; resume/reconcile interrupted work; find a usable take and export a cut. Count navigation-only clicks/panel switches separately from required editing/consent, competing primary actions, hidden selection prerequisites, and time to find the next action. No task may add navigation-only steps without an explicit reviewed justification; at least one must remove them, and all eliminate competing primary CTAs/hidden-selection prerequisites on the main path. Have the user review the actual walkthrough and identify the next action/blocking reason, not screenshots alone. Timing is reported on fixed fixtures/environment, not marketed as a user-study result.

### P4 — one operation/progress/recovery presentation

Work: normalize existing operation repositories and stream/poll clients into a shared read model and reusable progress component. Preserve specialized server protocols and operation IDs; do not invent a new job backend solely for a status panel.

Acceptance criteria:

- **P4.1:** Map actual lifecycles to queued/running/awaiting-review/succeeded/failed/cancelled/unknown with project, scope, source revision and operation identity. Only real completed/total units produce a percentage; otherwise show indeterminate progress and last update time.
- **P4.2:** At most one outstanding status request per operation subscriber; cancel/ignore requests on unmount, operation replacement or project change. Ordered response tests prove stale data cannot overwrite newer state. Use bounded backoff; visible errors distinguish disconnected/unknown from provider failure.
- **P4.3:** Cancel is not falsely presented as provider cancellation or a refund when only local waiting stopped. Unknown outcomes are never automatically resubmitted. Reconcile/recover from persisted operation records before offering a fresh attempt.
- **P4.4:** Explicit retry targets only eligible failed/unstarted scope, retains successful proposals, and requires refreshed approval when cost/scope/source changed. Unknown work remains excluded until reconciled. Double-click/reload/late-result tests prove no duplicate paid dispatch and no cross-project result adoption using test adapters.
- **P4.5:** Progress/recovery is accessible from the active stage and persistent operation summary. Errors survive closing/reopening panels; successful outputs still require explicit review/acceptance. Opening progress never starts generation.
- **P4.6:** Map expired/pruned/unavailable operation results explicitly to a non-replayable display state with reason, even if normalized under unknown. Preserve operation identity/tombstones across server restart and result retention expiry; a status refresh or old-project restore cannot resurrect a paid dispatch. Synthetic expiry/restart tests distinguish missing retained result from known failure and permit a new request only through fresh explicit approval. This preserves the existing repository policy rather than adding a new retention backend.

### P5 — references, takes and an honest Final Cut

Work: connect existing reference/media/sequence components to the shared stage, capability and operation models. Reuse existing validation and renderer; no expanded media promise.

Acceptance criteria:

- **P5.1:** References show owner, intended identity/scope, permissions and current version. Local upload is distinguished from AI generation. Replaced/revoked references invalidate affected approvals; unrelated shots/scenes remain unchanged.
- **P5.2:** Video approval shows exact shot IDs, input/reference versions, model, estimate and user ceiling before dispatch. Missing/expired consent or changed inputs fail closed. Fixtures are visibly labelled and cannot be represented as real provider output.
- **P5.3:** Takes retain accepted/rejected/current/stale distinctions and decodable local bytes. A completed remote operation without retrieved/validated bytes is not a usable approved take. Missing local media has a recovery action, not an empty preview presented as success.
- **P5.4:** Final Cut uses only current approved takes in explicit sequence order. It reports every missing/unplanned/stale clip, validates duration/aspect/trims, and never silently omits, stretches or freeze-frame-pads missing footage.
- **P5.5:** Current native-local limits are visible: silent 720p/24fps MP4, ≤24 clips/120s, no audio/music/captions/transitions. Unsupported runtimes show a precise block. Synthetic local clips prove preview → render → full decode → browser download without a paid provider.
- **P5.6:** Sequence/source changes invalidate obsolete exports. State clearly that both individual video bytes and the rendered cut require separate downloads and are not embedded in project backup (P2.7); test reload/empty-store restore behavior rather than promising automatic export persistence.
- **P5.7:** Effective references show Story → Scene → Shot inheritance and local add/replace/exclude/reset behavior without losing historical versions. Rights and purpose-specific permissions remain distinct for research, story, planning, images and video; upload is not transfer consent. Reviewed transfer manifests list included/excluded references and reasons; server validation blocks revoked/unknown-rights/unapproved uses and capacity conflicts without silently dropping required inputs. Tests cover inherited overrides, reset, a research-only reference rejected for generation, invalidated approval after replacement, and zero provider upload during local permission editing. These safeguards apply to Plan as well as media stages.

### P6 — simplify secondary paths and finish interaction quality

Work: remove redundant entry points after replacement parity is demonstrated, move advanced diagnostics/older actions behind an explicit advanced area, and complete Editor/controller boundaries. Do not delete a workflow because it was disabled in a different checkout.

Acceptance criteria:

- **P6.1:** Verify every entry in the P0.9 inventory against its tested replacement/retained location before removing a control. Professional table/board, separate production/narrative order, setups, continuity review/exceptions, shot editing, revision-specific planning handoff, individual media downloads and SVG remain accessible without polluting the primary flow. Saved legacy projects still load, edit, back up, restore and export within P2.7 limits; deep links and unavailable legacy actions receive an honest explanation.
- **P6.2:** Essential approval, reference ownership, spending and recovery controls remain in the primary journey, not hidden as advanced settings. Advanced mode does not create a second authority for capabilities or document mutations.
- **P6.3:** Native-local routes consistently use the shared validator when their semantics match; GET/status and multipart rendering retain their correct distinct checks. Negative origin/host/proxy/content-type tests remain green. No hosted-authentication claim is inferred.
- **P6.4:** Canvas selection, drag/zoom, keyboard shortcuts, text editing, locks, connectors, outline navigation, save/undo and media ownership preserve behavior. Accessibility and target viewport checks from P3 pass on all stages; no unexplained new warnings or growing listener/poll counts after 20 stage transitions.
- **P6.5:** Preserve existing untrusted-data protections through new components: validate malformed/oversized backups and media MIME/decoded-size/hash mismatches, sanitize rich text/URLs and exported spreadsheet cells/filenames, and render research/model text as data rather than executable controls or authority to change scope. Logs, errors, screenshots and diagnostic downloads must not expose credentials/admission tokens or unapproved reference bytes. Existing import/export and provider-output negative tests are mapped to the new boundaries; no new model security product or provider behavior is claimed.
- **P6.6:** Preserve the existing 500-node/800-edge Assistant stress scenario and 10-scene/100-shot hierarchy fixture, including geometry and reload invariants. Existing algorithm timing budgets remain unchanged; record browser transition/input timings and request/listener counts on the same environment before/after. A reproducible regression must be fixed or presented as an unresolved gate, not hidden by broader timeouts, skipped stress cases or unexplained fixture downsizing. Do not infer a new supported scale limit from these tests.

### P7 — integrated acceptance and handoff

Acceptance criteria:

- **P7.1:** One clean run of the complete offline suite and applicable browser matrices passes on the exact candidate commit, with no hidden failures, test-only selectors replacing meaningful behavior, or new unexplained skips. Native workflow fixture coverage and Worker compatibility coverage are reported separately.
- **P7.2:** Three-engine evidence covers new project, restored project, partial/stale project, blocked capabilities, save failure, second tab, interruption/reload, retry eligibility and the fixture end-to-end journey. Synthetic local MP4 export is decoded and downloaded; it is not called live-provider proof.
- **P7.3:** GitHub Actions passes for the exact candidate SHA before an ordinary completion/merge claim. If the $0 cap or external outage prevents CI, mark verification pending and stop; do not buy minutes, use skip directives, disable checks or present local tests as a CI pass. Any exception requires a new explicit user decision, recorded separately from acceptance.
- **P7.4:** No unresolved critical/high product-safety findings, no failing required tests, high-severity dependency audit clear, documented moderate risks, critic gate passed, and user visual approval recorded. Each acceptance ID links to evidence, not just a summary score.
- **P7.5:** Update `CINESERYE_HANDOFF.md` with private source SHA, completed criteria, test/CI links, critic decisions, screenshots, rollback steps and remaining limitations. Do not copy secrets or publish this private file to the public repository. Report private implementation complete separately from live/hosted availability.
- **P7.6:** Final traceability matrix maps every acceptance ID and P0.9 inventory entry to an exact candidate test/command, evidence location and verdict. Include preserved nonlinear planning, empty-store media restore, destructive cleanup, transfer permissions, advanced exports and measured simplification—not only the five-stage happy path. No baseline feature is silently unassigned and no NOT VERIFIED mandatory entry counts as done. Explicit exclusions above remain separate backlog/scope decisions.

## CI and cost policy

GitHub Actions stays enabled. Account-wide Actions budget was verified at $0 with Stop usage enabled; treat that as a retained control, not an invitation to claim a perpetual billing guarantee. Before dispatch/merge, verify the applicable control is still present. Use standard Linux runners and included allowances; never change repository visibility or enable paid/larger runners to make CI cheaper.

During implementation, pin fixture configuration and disable opt-in paid smoke tests in both local and CI environments; never inject real provider secrets into fixture jobs. Retain typecheck/lint/build/unit/audit and meaningful browser coverage. Use cancellable same-branch concurrency and targeted local checks to reduce redundant runs. Bound artifact retention/cache use within included allowances; never delete the user's unrelated artifacts. Budget exhaustion means wait for the free allowance or report a blocked CI gate, not spend. No recurring monitoring automation is authorized by this plan.

## Completion and critic protocol — mandatory at every attempt

Applies to this plan and every attempted phase, milestone, fix batch, or final implementation completion. Routine work-in-progress messages need no critic. Never call an attempt complete before the following gate.

1. Freeze the candidate: exact commit/tree or documentation revision, affected files, acceptance IDs, executed commands/results, screenshots/traces, known failures, limitations, and scope/authority boundaries. No concurrent changes to reviewed files.
2. Spawn a fresh bounded independent critic agent for that attempt. Give the critic the packet plus source/test access and require its own inspection of material claims. The critic must not modify files, approve spending, deploy, merge, or rubber-stamp the implementer's score. It may run safe read-only/offline verification, but no live or paid calls.
3. Require criterion-by-criterion verdicts: PASS / FAIL / NOT VERIFIED / NOT APPLICABLE (with a reason); findings ranked blocker/high/medium/low; exact evidence locations; missing tests; practical simplification insights; and the most useful next action.
4. Score each category 0–10: correctness/coverage (30%), simplicity/maintainability (20%), usability/accessibility (20%), data/security/cost safety (20%), evidence/reproducibility (10%). Report the weighted overall score, every category score and confidence. For a document, usability means clarity and testability of the proposed experience, not validated runtime UX.
5. Acceptance requires overall ≥9.0/10, every category ≥8.5, all mandatory criteria in that attempt PASS, and no unresolved blocker/high finding. A score alone never overrides a failed test, NOT VERIFIED mandatory criterion, absent user visual approval or live-provider permission boundary. Planning acceptance scores the plan's completeness, not unimplemented P0–P7 functionality.
6. Parent records each finding's disposition: fixed with evidence, disproved with evidence, or deferred with a visible scope/risk explanation. Mandatory failures cannot be waived by the parent or critic. If fixes are made, freeze a new candidate and spawn a new critic for the next completion attempt. Do not average scores across attempts or recycle an earlier pass for changed code.
7. Retain every review, including failed/invalidated attempts. After two unsuccessful attempts with the same unresolved blocker, report the trade-off/blocker to the user before broadening scope. Never make up a critic score if the agent is unavailable: report the gate incomplete.

Completion packet location: `docs/simplified-flow-reviews/P{phase}-attempt-{N}.md` for durable summaries, with bulky local-only media/log evidence under a named `artifacts/simplified-flow/` folder. Record candidate SHA/revision and commands in each packet. The user-facing update includes scope completed, actual tests, critic score/verdict, open issues and next phase.

## Rollout and rollback

Implement capability adapters before replacing callers, document boundary before reorganizing navigation, and compatibility coverage before removing old controls. Keep each phase independently reviewable; prefer additive adapters and reversible commits. Do not maintain two long-lived implementations of the same workflow.

Before any data migration, provide an exportable backup and test restoring it. Rolling back UI code must not silently downgrade or truncate a newer project schema; retain a compatible reader or provide a documented restore path. Rollback means a targeted revert/feature rollback, not resetting the worktree or deleting media/ledgers. No production rollout is part of this plan.

## Definition of done

The simplified private application has one primary journey, one capability authority, one document mutation boundary, and one coherent operation presentation; existing work survives; all required local/CI/critic/user-review gates above pass; known limits are visible. Live provider quality, hosted execution, paid generation and public release remain separately unverified/out of scope until explicitly authorized and proved.
