# Cineserye current-feature audit

> **Status update — 2026-09-01:** the findings that became Sprints 1–4 are now implemented and verified. P0-08’s rights-aware Reference Deck and Increment C’s one-shot storyboard-still workflow are complete. The findings below remain as the decision record; outstanding recommendations begin with Sprint 5 professional planning and handoff.

**Audit date:** 2026-09-01

**Audited baseline:** `d4dd5eefecd0a0512338f9cd520a0afd6d380e59`

**Product stage:** local proof of concept; not deployed

**Primary user:** an independent creator without a complete pre-production crew

**Execution plan:** [remaining-sprints implementation plan](SPRINT_IMPLEMENTATION_PLAN.md)

## Executive assessment

Cineserye already has a stronger technical foundation than most hackathon prototypes: the canvas engine is reusable, cinema data is versioned separately, provider credentials stay on the server, model output is runtime-validated, proposals are previewed before one atomic mutation, and the local document has serious persistence, backup, accessibility, and test coverage.

The next product risk is not lack of image generation. It is trust and workflow closure. A creator can produce a first shot package, but the current experience makes it difficult to discover the action, establish neutral intent from a blank project, revise an accepted result, safely edit domain data, recover an unaccepted proposal, or prove that every citation genuinely supports the item showing it. Generation-budget language also overlaps with physical-production budgeting.

**Recommendation:** do one closure sprint before adding storyboard media. Then add a visual-reference approval layer, followed by one approved storyboard frame for one accepted shot. Do not jump directly from a text proposal to multi-shot video generation.

## Scope and method

This audit covered:

- the running desktop and 390px mobile UI at `http://localhost:3001`;
- first-run, saved-demo, scene selection, proposal, acceptance, persistence, and export affordances;
- the generic editor, cinema sidecar, command boundary, provider adapters, API route, telemetry policy, CI, unit tests, browser tests, and evaluation assets;
- official product documentation from Higgsfield, StudioBinder, LTX Studio, ShotDeck, Frame.io, Google Flow, and Runway.

No live planning request was submitted during this audit. That avoided consuming Parallel or Google Cloud credits and avoided sending scene content to third parties without an action-time review. Existing fixture, mocked-provider, and opt-in Vertex results were inspected instead.

## Maturity scorecard

Scores describe readiness for the approved one-scene product, not feature parity with a full production suite.

| Area | Score | Assessment |
| --- | ---: | --- |
| Generic canvas foundation | 8/10 | Mature local editing, graph behavior, undo/redo, accessibility, and scale tests. |
| Cinema domain boundary | 7/10 | Strong schema and relationship validation; post-accept edit synchronization is incomplete. |
| Proposal safety | 8/10 | Clone-first preview and atomic acceptance are excellent; ready-proposal recovery is missing. |
| First-run and discoverability | 4/10 | Saved demo state and inconsistent action names hide the primary job. Mobile omits important project actions. |
| Scene brief and intent capture | 5/10 | Compact and validated, but biased defaults and missing format/generation intent reduce generality. |
| Research and references | 4/10 | Bounded and normalized sources exist; visual references, user curation, and strict claim-to-source integrity do not. |
| Shot-plan usefulness | 6/10 | Prompts, duration, lens, movement, audio, risk, continuity, and cost records exist; there is no professional shot-table editing surface. |
| Revision workflow | 2/10 | Accepted plans block replanning; no versions, diff, selective retake, or rollback UI. |
| Reliability and recovery | 5/10 | Provider timeout/retry/cancellation plumbing exists; the creator cannot cancel, resume, or restore a pending proposal. |
| Privacy and local safety | 8/10 | Per-request live consent, server-only secrets, local storage, and content-free telemetry defaults are strong. |
| Evaluation and observability | 5/10 | Deterministic tests and eval assets exist; behavioral eval execution and a usable run trace are not integrated. |
| Export and handoff | 3/10 | Project backup and SVG work; no production-ready shot-list, prompt-package, or source report export. |

## What is already strong

### 1. Isolation and local-first ownership

- Cineserye has independent Git history, dependencies, storage identifiers, backup format, and Worker configuration.
- Accepted documents live in `cineserye-local` IndexedDB and portable `.cineserye` backups.
- Fixture mode makes no external provider requests.

### 2. A defensible agent mutation boundary

- Parallel and Vertex return domain data, not React nodes.
- Provider output passes Zod/domain validation and a deterministic proposal compiler.
- `app/editor/canvas-commands.ts` applies commands to a clone, respects locks and graph rules, validates the result, and returns one atomic document.
- Rejecting a proposal leaves the saved document unchanged; accepting creates one undo step.

### 3. Useful cinema records already exist

The sidecar models scenes, shots, characters, locations/props/visual elements, prompts, sources, agent runs, continuity relationships, and illustrative costs. This is enough structure to support the next reference-frame stage without redesigning the generic canvas.

### 4. Good privacy defaults

- Live planning requires explicit consent in the UI and API.
- The browser never receives the Parallel key or Google credentials.
- Raw scene text and prompts are excluded from telemetry by default.
- The privacy baseline clearly distinguishes local fixture behavior from live content transfer.

### 5. Verification depth

The verified baseline has compatibility, TypeScript, lint, unit, build, client-boundary, dependency-audit, accessibility, mobile, persistence, and cross-browser gates. The most recent full run before this audit recorded 94 passing unit tests plus one opt-in skip, and 121 passing Playwright tests plus two existing platform skips.

## Priority findings

### P0-01 — Make the primary workflow unmistakable

**Evidence**

- The product concept has been described as “Generate shot proposal,” but the UI uses **Plan scene**, **Draft shot prompts**, **Plan ready**, and **Plan accepted** for related states.
- A saved accepted demo opens with **Plan ready**, so a new creator cannot see where generation begins.
- At a 390px viewport, **New** and backup are not exposed in the visible top bar, while the already-complete plan is represented by an unlabeled check icon.
- The creator needed external guidance to find the action and understand why it was disabled.

**Decision**

Use one canonical verb: **Generate shot plan**. Treat “prompt package” as an output detail, not the primary call to action.

**Acceptance criteria**

- A fresh or first-seen workspace offers two clear choices: **Start a scene** and **Explore the sample**.
- Desktop, mobile, inspector, toolbar, progress, review, and documentation use the same action name.
- A visible badge identifies **Fixture** or **Live** mode before the creator submits anything.
- Mobile exposes New project, backup/restore, provider mode, and Generate shot plan through visible controls or an accessible overflow menu.
- When a plan is already accepted, the action becomes **Review plan** and a separate **Create revision** action is available.

**Required tests**

- First-run desktop and mobile discovery from an empty local database.
- Saved-demo and accepted-plan states.
- Keyboard and screen-reader naming consistency.

### P0-02 — Remove demo bias from blank-project intent

**Evidence**

- Planning is hard-coded to the node ID `scene-01` rather than a general cinema scene identity.
- If the scene body is empty, the planner falls back to its label, so the placeholder text `Scene 01` passes required-text validation.
- Every new scene brief defaults to “Restrained supernatural suspense,” a late-1980s Manila cinema, a PHP 1,200 ceiling, 36 seconds, a phone/camera, tripod, and flashlight.
- The brief does not explicitly capture output mode, aspect ratio, platform, genre, dialogue/audio intent, required story beat, or must-have/must-avoid elements.

These defaults are excellent for the sample but conflict with the product promise that genre and approach should follow the creator's intent.

**Acceptance criteria**

- Any validated scene record can be planned; node identity is not tied to `scene-01`.
- Placeholder labels and empty bodies cannot trigger a live request.
- Sample defaults live only in the sample project. A blank project uses neutral defaults or the creator's last confirmed preferences.
- The brief captures: creation mode (`AI-generated`, `live action`, or `hybrid`), aspect ratio/platform, tone/genre, location/period, target duration, dialogue/audio intent, budget semantics, available equipment, required beats, must-include elements, and must-avoid constraints.
- The selected scene text remains directly visible and editable before submission.

### P0-03 — Fix citation integrity before calling the output “cited”

**Evidence**

`planner-output.ts` filters model-returned source IDs and, when none remain, substitutes the first research sources as fallbacks. This can attach a valid URL to a character, asset, shot, or prompt even when the model did not identify that source as supporting the item. The first four normalized results are also automatically marked `pinned` without creator review.

That behavior preserves schema completeness but weakens research trust. A citation should mean “this source supports this decision,” not merely “this source was available during the run.”

**Acceptance criteria**

- Invalid or absent model source IDs produce an explicitly **Uncited** or **Needs verification** state; they never inherit unrelated fallback citations.
- Each displayed finding retains the exact normalized source relationship supplied by research/planning validation.
- The creator can pin, unpin, remove, replace, or mark a source irrelevant before acceptance.
- Source cards show query purpose, retrieval date, publisher/domain, and which claims or nodes use the source.
- Citation coverage is calculated without rewarding unrelated links.
- Tests prove that an invalid, missing, or unrelated source ID cannot appear as supporting evidence.

### P0-04 — Add revisions without overwriting accepted work

**Evidence**

- The existence of `cine-agent-plan` blocks another plan.
- Generated host IDs such as `cine-shot-01` and prompt versions are fixed.
- Accepted plans expose **Plan accepted** as a disabled action.
- There is no plan-version list, before/after diff, rollback, “revise with notes,” or selective shot retake.

This is the largest gap between a successful demo and a usable creative tool. Creative work is iterative by definition.

**Acceptance criteria**

- **Create revision** starts a new run linked to the accepted predecessor and never silently mutates it.
- Run, shot, asset, and prompt identities are collision-safe across revisions.
- The review surface summarizes created, changed, retained, and removed records.
- The creator can compare revision N with revision N-1, accept the new version, or return to an older accepted version.
- The first revision can remain scene-atomic; selective single-shot revision is the following increment.

### P0-05 — Establish one editable source of truth after acceptance

**Evidence**

- Generated canvas hosts are unlocked generic concept nodes.
- The Project Outline and cinema inspector derive from the sidecar, not from later generic title/body edits.
- The cinema inspector is read-only.
- A creator can therefore cosmetically edit a host while its shot title, duration, lens, prompt, continuity links, and outline entry remain unchanged in domain data.

This contradicts the approved behavior that the creator can manually edit an accepted proposal afterward.

**Acceptance criteria**

- Shot, character, asset, scene, prompt, source, and cost-related edits go through validated domain commands.
- A domain edit updates the sidecar, host card, outline, inspector, persistence, backup, and undo history together.
- Reordering shots updates chronological order and all dependent summaries.
- If free canvas editing cannot safely update the sidecar, cinema hosts are locked and the inspector provides the authoritative edit forms.
- Cross-layer tests prove that no accepted edit can leave host and sidecar titles or relationships inconsistent.

### P0-06 — Make planning recoverable and controllable

**Evidence**

- A ready proposal exists only in React state. Refreshing before acceptance loses the proposal and its provider spend.
- Abort plumbing exists, but there is no creator-facing **Cancel planning** button.
- Progress is a single generic message rather than research/planning/validation phase status.
- Provider errors are reduced to transient notices with no persistent diagnostics or one-click retry.
- The server creates a new random run for each request and has no per-scene idempotency key or duplicate-run guard.

**Acceptance criteria**

- A ready proposal and its source document fingerprint are stored locally and restored after reload.
- The creator can cancel during research or planning and sees a terminal cancelled state.
- Progress identifies the current phase without exposing prompt content.
- Retry creates a linked run, preserves the failed run record, and does not duplicate an already-completed request.
- The server accepts an idempotency key and rejects or reuses duplicate active work for the same scene/version.
- Error UI distinguishes configuration, authorization, rate limit, timeout, invalid model output, limited research, and offline failures with an appropriate next action.

### P0-07 — Separate generation budget from production feasibility

**Evidence**

- The brief calls the input **Production budget band**.
- The same optional ceiling is compared against **Expected generation cost**.
- Cost is a deterministic PHP/USD heuristic based on weighted seconds and risk, not current Parallel, Vertex, image, or video provider pricing.
- The creator previously clarified that the important cost is the possible cost to generate the scene.

The current UI is honestly labeled illustrative, but the concepts still overlap.

**Acceptance criteria**

- The creator chooses a planning mode: AI generation, live action, or hybrid.
- **AI generation budget** is separated from **physical production constraints**.
- Generation estimates name the assumed provider/model, resolution, clip duration, output count, retry count, pricing snapshot date, and whether research/planning costs are included.
- When no reliable provider rate exists, show credits/attempts or an unpriced estimate rather than an invented currency value.
- Physical-production bands affect feasibility decisions but are not compared directly with model-generation charges.

### P0-08 — Add a rights-aware visual-reference layer before image generation

**Evidence**

- Parallel currently returns text findings and URLs, not approved visual references.
- Generic image import is not attached to a character, prop, location, style, or shot record.
- An external source URL, an inspiration image, a character reference, a storyboard frame, and a first video frame are different concepts but do not yet have distinct lifecycle records.

**Acceptance criteria**

- A scene can own a **Reference Deck** containing uploaded local references and user-approved linked references.
- Every reference records type (`character`, `location`, `prop`, `style`, `composition`, `wardrobe`, or `other`), provenance, source URL when applicable, rights/usage note, creator approval, and downstream usages.
- Prompt inheritance can reference approved assets by stable IDs rather than copying visual descriptions blindly.
- Remote images are never silently downloaded or treated as licensed generation inputs.
- Storyboard frames, source images, and video start/end frames remain separate versioned artifact types.

## P1 findings — make the plan professionally useful

### P1-01 — Add a shot table and storyboard view

The canvas is excellent for relationships, but professionals also need a dense, sortable shot surface. Add a scene-level table/board switch with shot number, beat/purpose, framing, angle, movement, lens, duration, audio/dialogue cue, characters, location, props, risk, generation status, and notes. Allow drag reorder through validated domain commands.

### P1-02 — Group shots by setup as well as story order

Story order and production order are not the same. Add optional camera/lighting/location setups, estimated setup time, and a reversible production-order view. Keep the narrative sequence authoritative for generation and editing.

### P1-03 — Support selective revision and variants

After scene-level versions are safe, allow **Revise this shot**, **Generate A/B framing options**, **Keep continuity but change camera**, and **Regenerate prompt only**. Every operation should state what is preserved and what may change.

### P1-04 — Make continuity an inspectable contract

Add character/wardrobe, location, prop, palette, screen direction, time-of-day, and audio continuity summaries. Surface missing dependencies, conflicting changes, and which shots will be affected before an edit is accepted.

### P1-05 — Add production handoff exports

Add exports that preserve meaning outside the canvas:

- shot list CSV;
- printable storyboard/shot-list PDF;
- prompt package Markdown or JSON;
- sources and provenance report;
- generation-budget assumptions report.

Exports should identify project, scene, plan version, generated-at time, provider/model metadata, and illustrative-cost status.

### P1-06 — Add a safe provider preflight

The current status route reports mode and consent requirement, not whether Parallel authentication, Google ADC, project permissions, model availability, quota, or regional capability are healthy. Add a developer-facing preflight that reveals only safe status codes and never echoes secrets.

### P1-07 — Execute behavioral evaluations, not only schema tests

The repository has a good three-case evaluation dataset and config, but the app is not exposed as an Agents CLI-compatible target and no behavioral score report is part of the gate. Add a local evaluation adapter and score production usefulness, citation correctness, continuity, budget behavior, and instruction resistance across diverse genres.

Include at least:

- dialogue-led contemporary drama;
- no-dialogue suspense;
- documentary/reconstruction with factual caution;
- comedy with timing requirements;
- period scene with prop constraints;
- two-character continuity;
- limited/no research;
- prompt-injection text inside the scene;
- very low generation budget;
- professional equipment and beginner phone-only equipment.

### P1-08 — Persist a useful, private run trace

Store content-free local run events for phase timing, retries, provider/model, counts, warnings, safe error codes, usage, and proposal outcome. Give developers a local trace view and export. Do not enable cloud telemetry by default.

## P2 findings — expand only after the one-scene loop is closed

- Multiple scenes and project-wide continuity.
- Script/treatment import and beat extraction with explicit scene review.
- Reference-frame generation for one accepted shot, then shot-by-shot storyboard generation.
- First/end frame and video generation with provider-capability checks.
- Timeline/Scenebuilder for approved clips.
- Comments, review links, team roles, and cloud project storage.
- Authentication, billing, hosted secret management, rate limiting, abuse controls, retention controls, and deployment hardening.

These are not current defects; they are deliberately deferred product phases.

## Competitive inspiration: adopt the pattern, not the product

| Product | Official workflow signal | Appropriate Cineserye lesson |
| --- | --- | --- |
| [Higgsfield Cinema Studio](https://higgsfield.ai/blog/how-we-built-cinema-studio) | Guided camera/lens/focal-length controls, reusable Elements, metadata that carries with a frame, and an AI Director for newcomers. | Keep a simple mode for beginners, expose deeper cinema controls for professionals, and persist generation settings with every artifact. |
| [Higgsfield Canvas](https://higgsfield.ai/creator-hub/help-center/tools/how-do-i-use-canvas) | Prompt, image, video, edit, and audio nodes form reusable visual pipelines; credits are spent when generation runs. | Separate planning nodes from spend-triggering generation nodes and make cost confirmation happen at the generation boundary. |
| [StudioBinder Shot Lists](https://www.studiobinder.com/shot-list-storyboard/) | Script-side shot tagging, detailed shot specs, customizable layouts, setup grouping, storyboard view, comments, mobile tracking, and PDF/export. | Pair the relationship canvas with a professional shot table/board, production setup view, and portable reports. |
| [LTX Studio](https://ltx.io/studio) | Projects can start from a script, concept, image, or video; dynamic storyboards coexist with a timeline and reusable Characters, Objects, and Locations. | Preserve multiple entry points, make continuity elements reusable, and keep storyboard sequence editable rather than freezing the first result. |
| [ShotDeck](https://store.shotdeck.com/welcome/index) | Searchable, deeply tagged cinematic frames can be collected into shareable decks. | Make research visual and curatable: filters, decks, provenance, pin/remove, and explicit connection from reference to creative decision. |
| [Frame.io](https://updates.frame.io/) | Version stacks, comparison, metadata, review status, and anchored feedback make iteration explicit. | Treat plans, prompts, and future frames as versions with diff, approval, rejection notes, and rollback—not mutable anonymous outputs. |
| [Google Flow](https://support.google.com/flow/answer/16353334?co=GENIE.Platform%3DDesktop&hl=en) | Characters and visual “ingredients” are reusable; start/end frames, generation settings, variations, and scene sequencing are explicit. | Use a staged artifact path: approved reference → approved storyboard frame → optional start/end frame → video clip → sequence. |
| [Runway References](https://help.runwayml.com/hc/en-us/articles/52963720640275-Using-reference-media-to-guide-your-generations) | Images, video, and audio can be named, saved, reused, and referenced explicitly in prompts. | Add typed, named, reusable local references and show exactly which prompt consumes each one. |

## Recommended implementation sequence

### Increment A — Trust and first-run closure

Deliver P0-01 through P0-07 without adding media generation.

**Demo outcome:** a new creator starts a neutral scene, understands live/fixture mode and budget meaning, receives correctly cited research and a shot plan, can cancel/recover, edits it without sidecar drift, and creates a safe second revision.

### Increment B — Reference Deck

Deliver P0-08 plus source curation and continuity usage views.

**Demo outcome:** the creator pins or uploads character, location, prop, style, and composition references; every reference has provenance and visible downstream usage.

### Increment C — One approved storyboard frame

For one selected accepted shot only:

1. review its storyboard prompt and inherited references;
2. show model, capability, price/credit estimate, and content-transfer summary;
3. generate one or a small bounded set of still-frame variants;
4. preserve prompt, model, settings, references, provenance, and cost with each result;
5. approve one frame or reject all;
6. do not generate video yet.

### Increment D — Professional planning surfaces

Add the shot table/board, setup grouping, continuity matrix, and production exports.

### Increment E — Video gate

Only after approved frames and versioning are reliable, add a one-shot image-to-video experiment with explicit start/end frames, provider capability checks, credit confirmation, cancellation, history, and approval.

## Acceptance scenarios for the closure sprint

| Scenario | Expected result |
| --- | --- |
| New creator, blank project | The first useful action is obvious; sample-specific defaults do not appear. |
| Professional creator revises lens and duration | Domain data, canvas, outline, totals, prompts, backup, and undo remain synchronized. |
| Planner emits an unknown source ID | The claim is marked uncited; no fallback URL is attached. |
| Creator reloads a ready proposal | The exact proposal reopens without another provider call. |
| Creator cancels during research | The request aborts, a cancelled run is retained safely, and the saved canvas is unchanged. |
| Accepted plan needs a new direction | A linked revision is created; the previous accepted version remains recoverable. |
| AI-generation budget is low | The UI explains model/attempt assumptions and offers tradeoffs without calling it a physical production quote. |
| Phone viewport | New, backup, provider mode, plan, review, accept/reject, and recovery remain discoverable and operable. |
| Source or reference lacks rights clarity | It can inform review but is not silently used as a generation input. |
| Provider credentials are invalid | Safe preflight/error guidance appears without revealing the key or raw provider response. |

## Definition of readiness for storyboard generation

Cineserye is ready to generate its first reference frame when all of the following are true:

- one canonical first-run and plan-generation path works on desktop and mobile;
- a meaningful, neutral scene brief can be created without sample bias;
- citations never use unrelated fallbacks;
- accepted plans support safe revisions and consistent manual edits;
- ready proposals survive reload and can be cancelled or retried;
- AI-generation budget semantics are separate and transparent;
- visual references have type, provenance, rights note, approval state, and downstream usage;
- the behavioral evaluation suite has a recorded passing baseline;
- the generation action estimates spend and requires explicit approval;
- no video generation, authentication, deployment, or cloud collaboration has been introduced prematurely.

## Bottom line

The foundation should be preserved. The next build should close the one-scene loop, not replace the canvas or rush into a general AI studio. Cineserye's differentiator can be a trustworthy path from creator intent to cited production decisions to approved visual anchors. Its best sequence is:

```text
intent
  → curated research
  → editable, versioned shot plan
  → approved continuity references
  → approved storyboard frame
  → optional video generation
```

That sequence is modern enough to feel competitive with AI-video tools while remaining more deliberate, inspectable, and production-aware for an independent creator.
