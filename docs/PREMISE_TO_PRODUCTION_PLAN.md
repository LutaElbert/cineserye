# Premise to production — audit, implementation, and acceptance

Date: 2026-09-07. Branch: `feature/premise-to-production`.
Baseline: `a102074`; recoverable enhancement reference: `d3578db`.
Status: local/fixture implementation verified; human visual approval pending. Paid video, batch generation, live-model quality and release readiness remain gated.

## Audit and decisions

- Baseline `Editor.tsx` gates the global planning action on scene selection and opens `SceneBriefDialog`. The screenshot is a sample plan, not produced media.
- Existing cinematic hierarchy, manual creation, undo, locks, scene planning, storyboard and video APIs are reusable. Do not replace semantic nodes with anonymous media nodes.
- Checkpoint contains versioned Story workflow, references, scoped consent, late-result protection, local durable operations and expanding-node interaction fixes. Reuse this foundation, not the rejected form-heavy presentation.
- Checkpoint questions require five fields and repeat estimate/approval actions. Replace entry friction with a compact composer, automatic quote retrieval, and consequential missing questions. Never remove live transfer/spend consent.
- Baseline images and videos are inspector-only, per-shot. Promote their existing workflow into expanded shot nodes, retaining reference and generation approvals. Accepted media enriches the same compact node.
- Local ffmpeg/ffprobe exist, but there is no assembly service. A bounded local renderer must validate actual clip duration/dimensions, reject missing/short clips, use argument arrays and task-owned temporary files, and fail closed on unsupported hosts. Do not claim Cloudflare support.
- Current fixture video bytes are short landscape sample footage regardless of requested metadata. Fixtures must never establish exact runtime/aspect output proof. Test assembly with generated local test clips and decoded output metadata.
- Existing TypeScript agent specification remains authoritative. Agents CLI's Python scaffolding is not introduced into this app. Existing model/account/environment configuration is preserved. Fixture and contract verification is not live AI evaluation.

## Sequenced work

1. **Foundation:** selectively recover validated domain/storage/consent and canvas interaction code. Verify typecheck and baseline regression before additional integration.
2. **Prompt-first Story:** editable premise, local image attachments and stable @image aliases, optional total runtime/aspect/genres (multiple supported, not required). Keep three story goals and manual scene creation. Expand the actual node; no dialog.
3. **Assistant:** one persisted helper, inferred details and consequential questions, native schema-rendered controls, correction/custom answers, quote auto-load, explicit live approval, preserved cancellation/recovery. Global assistant entry must not require scene selection. Accept scenes using the existing additive command boundary.
4. **Production nodes:** preserve shot IDs/edges across plan/image/video states, inline existing media controls, approved selected takes, local downloads. Scene/assistant actions disclose exact target scope. Batch generation is gated until quote binding, persistence and per-shot recovery are proven; never implement an unguarded loop of paid calls.
5. **Assembly:** sequence approved local clips, validate media availability and target trims, local-only bounded MP4 render, inspect actual output runtime/aspect/audio. Audio/captions beyond supported inputs must be labelled unavailable rather than faked.
6. **Verification:** unit/integration, existing Chromium suite, targeted Firefox/WebKit, independent critic screenshots at desktop and short/narrow viewports, correction pass. Retain evidence; remove only task-owned test processes and temporary media. Do not publish, deploy, push, clear user storage, or perform paid generation.

## Acceptance and test cases

| ID | Test / criterion | Required evidence |
| --- | --- | --- |
| P01 | Enter an idea without scene selection; reach one connected Assistant. Reopen never duplicates it. | Browser journey + persisted reload |
| P02 | Runtime means whole story; continuation explicitly means new material. Two or more genres supported without requiring any. | Domain + browser |
| P03 | @image aliases bind stable reference identities. Removing an earlier reference never renumbers later aliases; missing/unauthorized mentions block or clearly exclude, never silently substitute. | Domain + browser |
| P04 | Premise/reference editing is local. Sending externally requires explicit scope approval; permissions and source changes invalidate consent. | Request inspection + server contract |
| A01 | Detailed premise does not produce duplicate questions; sparse premise asks only consequential gaps. Optional creative details can be left to the assistant, not a mandatory full brief. | Fixture cases + real-model gate separately |
| A02 | Invalid question schema, stale responses, duplicate resume, cancelled output and restart ambiguity fail safely; no duplicate scenes or purchases. | Existing and new regression |
| A03 | Accept scenes is additive and one-step undoable. Existing scene/shot plans stay available. | Browser + domain |
| N01 | All editing is inside actual canvas nodes; no editor popup. Header drag works; fields select text; zoom over shell works; typing does not move viewport or siblings. | Browser geometry + critic screenshots |
| N02 | Locked layers remain selectable/unlockable, but cannot mutate; generic notes/raster/connector behavior and Properties toggle remain. | Existing regression |
| M01 | Same shot identity/edges survive image then clip state. Unapproved/failed/rejected outputs never appear as approved. | DOM + domain |
| M02 | Image/video quote/consent stays scoped to shot, revision, references, settings and output count. Extra generation/retry requires approval. | API + browser |
| M03 | Downloads have correct bytes/MIME; unavailable local media has a recovery message. | Browser download checks |
| R01 | Assembly selects approved local takes in chronological order; rejects absent, malformed or too-short clips and unsupported runtimes. | Unit + ffmpeg integration |
| R02 | Final MP4 decoded duration matches sum of trims within one frame; actual aspect matches requested ratio; input audio treatment explicitly disclosed. | ffprobe evidence, not fixture labels |
| Q01 | Independent critic captures actual UI at desktop, short viewport and narrow viewport; scores visual consistency, friction, canvas continuity and trust 0–10. | Screenshot paths + report |
| Q02 | Scores below 8.5 or critical findings require correction. At/above 8.5 is eligible for user approval, never automatic acceptance. | Critic rerun + human gate |

## Release gates / exclusions

Paid model quality, hosted durable storage/authentication, large-film capacity, generated audio, advanced timeline/captions and final submission are not established by this local implementation. An unsupported feature must be clearly unavailable. Each sprint records actual results below; no checkbox is passed by intention alone.

## Execution record

- Read-only audit completed against baseline/checkpoint; two independent code audits requested.
- New feature branch created. Baseline and checkpoint branches remain unchanged.
- Recovered the checkpoint's domain, storage, consent and interaction foundation, then replaced its default Story form with the prompt-first composer. The original dense direction editor is optional advanced functionality, not the default.
- Added an explicit **Start with an idea** action: one empty Story node and no phantom starter scene. Manual scene starter and sample remain separate choices.
- Added optional multi-genre, total runtime/format controls, local reference attachments, stable mentions and a compact rights/use-permissions editor. Archive/history preserves alias identity. No generation on upload, edit, open, close or reload.
- Connected one persisted Assistant with automatic estimates, consequential missing questions, schema validation, correction, live consent and durable checkpoint recovery. Accepted scenes can open their own workbench directly from the Assistant.
- Scene setup inherits approved direction and allocation, with optional adjustments. Generated media enriches the same shot and remains reviewable inside its expanded node. Image and video now use the owning scene's accepted revision, not the global selection.
- Video audit exposed an in-memory job store. Added content-bound receipts and concurrent fixture deduplication; **paid video is explicitly blocked** until durable operation ownership/polling/recovery exists. Existing local clips and fixture generation are retained. This is a remaining production task, not a completed live-video feature.
- Added local sequence review and bounded silent MP4 assembly: 720p/24fps, 24 clips, 120 seconds, 50 MiB per input and 200 MiB total. Real decoded media must satisfy trims/aspect. No stretching, fake runtime, missing-shot omission or hosted fallback.
- Fixture clip labels now separate requested settings from decoded footage (the small sample is approximately 0.14s at 160×90). Assembly tests use separately synthesized real-duration media, not those fixture metadata labels.

### Verification results

| Check | Observed result |
| --- | --- |
| TypeScript | Passed |
| ESLint (whole repository) | Passed |
| Client/server boundary check | Passed |
| Production build | Passed; existing large-chunk and static route-classification warnings remain |
| Unit/integration | **367 passed; 3 live smoke tests skipped intentionally** |
| Canvas/manual/multi-scene regression | **31 Chromium cases passed**, including 4 clean rechecks after dev-reload interference/outdated empty-premise test setup |
| Assistant + 500-node/800-edge stress | **9 Chromium cases passed**; scoped references, missing questions, cancellation/recovery, downloads, reload/no duplicate POST |
| Composer + local references | **6 cases passed** across Chromium, Firefox and WebKit |
| Independent critic | **9 Chromium cases passed** at desktop/short/narrow sizes; desktop **8.8**, short **8.7**, narrow **8.7** |
| Synthetic assembly | Independently decoded **60.000s**, **720×1280**, **1,440 frames**, no audio; temporary-file cleanup verified |

The browser total is **55 targeted cases**, not a claim that every older browser spec was rerun. All unit/integration suites were run. Fixtures validate contracts and interactions, not real-model creative quality or provider output fidelity.

### Acceptance disposition

- P01–P04, A01–A03, N01–N02, M01–M03: passed for the tested local/fixture paths and stated API guards. Live AI semantic quality and live video remain unverified/blocked as described above.
- R01–R02: domain/API/synthetic decoded-media proof passed. Browser screenshots validate missing/unplanned sequence states; a real AI-produced all-approved movie through the complete browser assembly flow has **not** been proven.
- Q01: passed. Q02: critic threshold reached; **user approval still required**.
- No paid request, deployment, remote push, main-project storage clearing or sample insertion occurred during testing.

### Evidence and reproducibility

- [Independent critic report](./PREMISE_PRODUCTION_CRITIC.md).
- Final critic screenshots: `artifacts/premise-production-critic-final-proof/`.
- Cross-browser composer screenshots: `artifacts/story-composer-verification/`.
- Assistant regression: `artifacts/premise-production-assistant-regression/`.
- Canvas regression and clean rechecks: `artifacts/premise-production-regression/` and `artifacts/premise-production-regression-recheck-final/`.
- Earlier failed-run artifacts are retained to distinguish corrected findings from fresh passing evidence.

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:client-boundary` and `npm run build`. Browser tests used a separate local server:

```sh
CINESERYE_E2E_FIXTURE=true CINESERYE_PROVIDER_MODE=fixture CINESERYE_LIVE_ENABLED=false CINESERYE_OPERATION_DB_PATH=:memory: npx vite --port 3040 --strictPort
PLAYWRIGHT_BASE_URL=http://localhost:3040 npx playwright test e2e/premise-production-critic.spec.ts e2e/story-composer.spec.ts --project=chromium --workers=1
```

Do not run a build or change application source during browser validation: dev hot-reloads can interrupt in-flight fixture jobs and document-writer leases. Passing evidence above comes from fresh-context reruns with stable application code.

### Remaining production gates

1. User approval of the actual screenshot-backed design.
2. Durable, owner-scoped video operation storage, polling, cancellation and restart recovery before re-enabling paid video.
3. Reviewed batch manifests, per-shot recovery and spend accounting before offering batch generation.
4. Separately authorized live model/provider validation; no fixture score substitutes for it.
5. A real approved-media browser assembly smoke test and explicit hosted storage/auth/render architecture before claiming end-to-end production/submission readiness.

### Cleanup and handoff

- Stopped the task-owned fixture server on port 3040; verified the user's port-3000 server remains listening.
- Moved the temporary official ADK recipe audit clone to the macOS Trash (`cineserye-agent-reference.NMS3lB`), where it remains recoverable. No project source, saved project data or user media was removed.
- Retained test screenshots and reports as evidence. The pre-existing `videos/` directory was left untouched.
- Verified `main`, `origin/main` and the pre-flow branch still point to `a102074`; the enhancement checkpoint still points to `d3578db`.
- Implementation is in the working tree on `feature/premise-to-production`; no remote push or deployment was performed.

## Follow-up: compact composer controls and Generate

User-requested refinement: remove the default More options/discard section, replace large settings labels with compact icon-led controls, and rename the Story action to Generate. The action still opens the connected Assistant; it does not start paid analysis or render media. Reference permissions remain available from attached references.

Acceptance checks:

- The default composer contains no More options, Manage references and notes, or Discard text/direction button.
- Reference, runtime, aspect and genre controls each show an icon, retain accessible names and tooltips, and preserve editable values. Runtime includes a screen-reader description distinguishing whole-video timing from new-material timing.
- Generate is unavailable for an empty Expand prompt, becomes available with an idea, opens the same Assistant without a popup, and sends zero generation POSTs.
- Local image uploads/mentions/permissions and multi-genre/runtime/aspect persistence still pass; typing and cursor-anchored zoom remain stable.

Verification: 9 composer cases passed across Chromium, Firefox and WebKit. After the final nonvisual accessible-description correction, all 4 Chromium composer/gesture cases passed again. Typecheck, targeted lint and whitespace checks passed. Independent desktop/short/narrow screenshot review is recorded in `COMPOSER_ICONS_CRITIC.md`. No paid calls or user-origin storage changes were made.

Final critic rerun: 3/3 viewport journeys passed; desktop 8.8, short 8.5, narrow 8.6, eligible for human review only. The follow-up fixture server on port 3040 was stopped after testing; port 3000 remains running.
