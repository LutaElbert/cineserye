# Cineserye × HyperFrames: Agentic Cinema demo plan

Research and repository audit completed 9 September 2026. Devpost facts were checked against the live Agentic Cinema hackathon data at 14:14 UTC; implementation findings are based on the current local worktree.

## Executive decision

Use HyperFrames to make a **120-second evidence-led product demo**, not a cinematic trailer.

The existing 87-second Cineserye cut already has a coherent visual system, clean pacing, and useful screen captures. It should be treated as a source library, not the final submission. Its persistent `FIXTURE DEMO · NO LIVE AI` label and fixture-only footage do not prove the two runtime integrations the Parallel track evaluates.

The revised demo should make one causal chain unmistakable:

> Creator intent → Parallel Search → inspectable sources → Gemini/ADK plan → human review → accepted production handoff

The most important new capture is one successful live run in which the viewer can see:

1. the creator's specific scene intent;
2. Cineserye dispatching research to Parallel;
3. source cards with titles, publishers, URLs, purposes, and findings;
4. those source IDs attached to the generated scene/shot/prompt artifacts;
5. the creator reviewing and accepting the proposal rather than the agent mutating the project autonomously.

HyperFrames is a good editorial and rendering layer for this job because it turns HTML/CSS/media and seekable animation into deterministic video. It does **not** count as Cineserye's Google Cloud or Parallel integration; it should package and clarify proof that the product itself already generated.

## Submission urgency and readiness

The official deadline is **9 September 2026 at 2:00 PM Pacific Time**, which is **10 September 2026 at 5:00 AM in Manila**. At the 10:15 PM Manila audit, roughly 6 hours 45 minutes remained. Recheck the live [Agentic Cinema page](https://agentic-cinema.devpost.com/) before relying on this countdown.

| Requirement or risk | Current evidence | Assessment | Required action |
|---|---|---:|---|
| New project during contest | First commit and GitHub repository creation: 31 August 2026; contest began 27 July 2026 | Likely pass | Preserve commit history and explain that Cineserye was created during the contest |
| Google AI runtime | `@google/adk`, `@google/genai`, Vertex-backed Gemini planner | Strong code evidence | Record a successful live Gemini/ADK plan |
| Parallel runtime | Direct `POST https://api.parallel.ai/v1/search` adapter | Strong code evidence | Record a successful live Parallel run and expose its citations visibly |
| Functional demo | Existing recordings are fixture-only | Fail for submission proof | Replace the core run with live footage; fixtures may appear only as supporting B-roll if labeled |
| Hosted project URL | README says the app has not been deployed | Blocker | Deploy a judge-accessible build whose live path can run consistently |
| Public source repository | GitHub repository is private | Blocker | Make the repository public after secrets/assets review |
| Detectable open-source license | No top-level license file; GitHub reports no license | Blocker | Add an OSI-approved license selected by the owner |
| Video | Existing 87.3s and 177s demo variants | Partial | Produce an English or English-subtitled functional demo under three minutes and publish it publicly |
| Allowed AI tooling | App dependencies are Google AI only; video production workflow must also remain compliant | Needs care | Do not use non-Google AI models/APIs to create submission content; use human narration, licensed music, or an allowed Google Cloud voice path |

The official rules say, “Projects must be newly created by the entrant during the Contest Period.” They also say, “Referencing Parallel in your README alone does not satisfy this requirement.” Review the complete [official rules](https://agentic-cinema.devpost.com/rules) before submission; this report is a product audit, not legal advice.

### Organizer reminder cross-check

A final-day Devpost community reminder shared by the project owner repeats the same submission gates and adds two useful operational warnings:

- The partner service must be called at runtime; a README mention is insufficient.
- If the video exceeds three minutes, only its first three minutes will be evaluated.

It also specifically asks entrants to verify that the repository license is detected in the repository's About section. Treat this as a secondary checklist derived from the organizer post; the official rules remain authoritative. The shared submission-draft shortcut is [https://bit.ly/agenticcinema26d](https://bit.ly/agenticcinema26d), and the official discussion forum is available at [Agentic Cinema forum topics](https://agentic-cinema.devpost.com/forum_topics).

### Final submission checklist

Add the `[DONE]` tag only after the stated verification passes.

- [ ] Final public demo is no longer than three minutes. **Status:** pending final render and signed-out playback check.
- [ ] Parallel is called successfully at runtime. **Status:** adapter exists; live end-to-end execution and recorded proof remain pending.
- [ ] Repository is public. **Status:** GitHub currently reports `PRIVATE`.
- [ ] Complete open-source license appears in GitHub's About section. **Status:** no top-level license is currently detected.
- [ ] Hosted project URL works and the Devpost submission form is completed. **Status:** README says the app is not deployed; Devpost completion has not been verified.
- [DONE] Deadline confirmed: **10 September 2026 at 5:00 AM Manila time**.

## What HyperFrames is and why it fits

HyperFrames is an Apache-2.0, HTML-native video framework. A composition is an HTML document whose elements declare start time, duration, track, dimensions, and media behavior through `data-*` attributes. Animation timelines are paused and explicitly seeked for every rendered frame. Headless Chrome captures those frames and FFmpeg encodes them into video. The same frozen inputs can therefore produce the same output, especially in Docker mode.

Its practical advantages for this demo are:

- **Native UI footage:** the existing WebM recordings can remain the hero media instead of being reconstructed as fake UI.
- **Controlled attention:** source cards, provider badges, run IDs, and architecture labels can be enlarged around the real capture without modifying the product recording.
- **Reproducible timing:** every proof beat can be reviewed as a snapshot at exact timestamps.
- **Plain source:** a small HTML composition is easier to repair under deadline pressure than a large nonlinear-editor project.
- **Separation of proof and polish:** the product supplies the evidence; HyperFrames supplies framing, captions, callouts, crops, and transitions.

Important operating constraints:

- Give the root an explicit size and duration.
- Keep media local and frozen before rendering; do not fetch live data at render time.
- Use one paused, registered seekable timeline per composition.
- Let HyperFrames own audio/video playback.
- Avoid wall-clock state, unseeded randomness, and infinite animation.
- Run lint/check, inspect timestamp snapshots, preview the complete cut, then render.
- Use Docker rendering for the final if time allows and the environment is already healthy; do not jeopardize the deadline on a late infrastructure detour.

The official [HyperFrames repository](https://github.com/heygen-com/hyperframes) describes the framework, CLI, core renderer, catalog, skills, and Apache-2.0 license. Its [rendering guide](https://hyperframes.heygen.com/guides/rendering) explains the lint/check/render loop and the local and deterministic Docker paths. The [introduction](https://hyperframes.heygen.com/introduction) explains its editable, exact-frame authoring model.

## Samples and patterns reviewed

The official examples and local HyperFrames skill library point to a consistent pattern: start from real product media, then use reusable motion blueprints to express state changes rather than presenting a sequence of decorative slides. Relevant patterns for Cineserye include:

| HyperFrames pattern | Use in Cineserye |
|---|---|
| `titlecard-reveal` | Eight-second opening problem/claim |
| `prompt-type-submit-generate` | Creator enters the Manila scene intent and starts planning |
| `agent-progress-theater` | Parallel research → Gemini planning → validation → proposal, with completed states tied to the real run |
| `cursor-ui-demo` | Focus the actual buttons and source-card interactions |
| `panel-edit-live-sync` | Show the proposal preview and the creator's explicit acceptance |
| `comparison-split` | Optional two-second contrast: disconnected notes versus one linked production graph |
| `video-text-pivot` | Transition from live product proof into continuity and handoff |
| `cta-morph-press` | Close on hosted app, repository, and “Built with Gemini + Parallel” |

The available design presets include Blue Professional, Code Editorial, Cobalt Grid, Bold Poster, Biennale Yellow, and others. Cineserye should **not** adopt a new house style now. Preserve its white/gray surfaces and restrained violet accent; borrow only Code Editorial's proof-oriented labels and typography hierarchy. The visual objective is legibility, not spectacle.

The upstream project also exposes showcase, catalog, product-launch, data-visualization, and site-tour examples from its [main documentation](https://github.com/heygen-com/hyperframes#what-you-can-build). The useful lesson is structural: each motion beat should reveal a change in product state or evidence, not merely animate a heading.

## Audit of the existing Cineserye sample

`videos/cineserye-demo/` contains a useful capture archive rather than a complete editable HyperFrames source project. The original `index.html`, project manifest, brief, storyboard, script, and frame-design source are no longer present at its root. Rebuild the final cut in a new self-contained composition; do not try to reverse-engineer cache thumbnails as source.

### What is already good

- Four capture scenarios passed.
- The 1600×900 recordings are long enough to supply clean handles: create/organize, project continuity, visual/video, and production export total roughly 97 seconds.
- Twenty-four 3200×1800 screenshots cover the full workflow from blank canvas to production handoff.
- The existing 87.3-second edit is much more suitable than the approximately 177-second walkthrough.
- The design is coherent and product-first: clean neutral surfaces, violet accents, direct language, and restrained motion.
- The narrative already understands Cineserye's differentiator: plan, review, approve, and hand off without losing continuity.

### What weakens the hackathon case

- Every frame advertises `FIXTURE DEMO · NO LIVE AI`.
- The cut is a feature overview, not evidence of the agent's runtime trajectory.
- Parallel and Gemini are not visible as distinct, sequential providers.
- No real source URL, query, result metadata, or citation-to-prompt relationship is readable.
- The UI is often scaled too small for a judge watching an embedded player.
- Continuity and export receive more screen time than the partner integration.
- The embedded sample MP4 is a broken/tiny placeholder (160×90 and about 0.14 seconds); do not use it as proof of video generation.
- The longer walkthrough repeats concepts and exceeds the attention budget even though it remains below the formal three-minute limit.

### Existing assets worth retaining

Use the captured states for brief support and transitions:

- plan brief, review plan, accepted plan;
- shared Mara, shared flashlight, wardrobe, audit, exception;
- shot prompt, rights-approved reference, storyboard variants, video preflight, approved clip;
- shot table, setup, production board, handoff, backup.

Do not use the fixture plan/review/accept sequence as the central runtime demonstration. Capture that sequence again in live mode.

## Is Parallel genuinely reference-driven?

### Short answer

**Partially.** Cineserye is already intent-seeded, source-carrying, citation-constrained, and creator-reviewable. It is not yet strong enough to guarantee—or visibly prove—that the retrieved inspirations are the most relevant references for each user's exact creative intent.

### What the implementation gets right

The Parallel request is generated from the validated scene brief. Its objective includes:

- full scene text;
- location and period;
- genre and tone;
- aspect ratio and platform;
- target duration and creation mode;
- a filmmaking-specific request for cinematography, production design, props, spatial continuity, and budget-aware coverage.

The adapter submits three queries covering setting/production design, tone/cinematography/lighting, and format/composition. It accepts only HTTP(S) source URLs, deduplicates them, caps the response, preserves title/publisher/finding metadata, and marks every live result `needs-verification` rather than pretending it is approved.

Gemini receives the source IDs, URLs, findings, and query purposes. Its planner instruction forbids invented citations. The compiler filters source IDs against the available set, links citations to scene direction, character sheets, asset references, storyboard prompts, and video prompts, and retains source metadata in the project. The UI exposes a Sources tab where a creator can inspect, support, pin, mark irrelevant, or remove a source.

That is a credible reference-aware pipeline, and it directly supports the user's earlier requirement that inspiration should be relevant to intent.

### Where the current claim is too strong

1. **The search queries compress away important intent.** Each query keeps only a few early keywords. Required beats, must-include details, must-avoid constraints, available equipment, and physical budget do not become dedicated queries.
2. **The objective is richer than the query set.** Parallel may use the objective, but the demo cannot currently show which exact facet caused each source to appear.
3. **All normalized results reach Gemini before creator curation.** They start as `needs-verification`, yet planning proceeds immediately. Post-plan curation can clean records but cannot prove the first plan was based only on relevant sources.
4. **There is no deterministic relevance gate or reranker.** URL validity and excerpt presence are checked; semantic alignment, authority, recency, diversity, and duplicate claims are not scored.
5. **`queryPurpose` is generic.** Every source receives the same purpose string instead of the specific query/facet that retrieved it.
6. **Citation validity is structural, not evidentiary.** The model can only cite known source IDs, which prevents fabricated IDs, but there is no claim-level check that a source excerpt actually supports the generated creative choice.
7. **The ordinary verification suite does not perform a live Parallel call.** The adapter is unit-tested with mocks, while the documented live Vertex smoke explicitly avoids Parallel.

### Minimum hardening before recording

If code changes are still feasible, prioritize these in order:

1. Add one opt-in live end-to-end smoke that performs Parallel research and Gemini planning and asserts `researchProvider === "parallel-search"`, a nonzero source count, real non-mock URLs, and at least one generated artifact with a valid `researchSourceId`.
2. Persist the exact query or query facet on each returned source instead of assigning one generic purpose.
3. Generate a small query matrix from the user's intent: setting/period, tone/lighting, must-include prop or character, production constraints/equipment, and platform/composition. Keep it bounded.
4. Add a pre-planning relevance screen or deterministic threshold so irrelevant sources do not reach Gemini automatically. If time is too short, require the creator to approve selected sources before planning.
5. Show source-to-output provenance in the UI: “This production-design choice used Sources 1 and 3.”
6. Record a trace/export artifact that proves provider, run ID, source count, source IDs, model, and acceptance status without exposing credentials or full private prompts.

If code changes are not feasible, the video must be honest: call the current system **intent-seeded, cited web research with creator verification**, not “perfectly relevant inspiration.”

## Recommended 120-second demo

### Editorial rule

At least 65% of the runtime should be real Cineserye interaction. Motion graphics should orient the viewer, enlarge proof, and compress waiting time. Never animate a state the product did not actually reach.

| Time | Picture | Narration / on-screen claim | Evidence requirement |
|---:|---|---|---|
| 0–7s | Fast title reveal, then actual Cineserye canvas | “Film ideas fragment across notes, references, prompts, and production boards.” | Product appears by second 3 |
| 7–17s | One compact architecture flow | “Cineserye turns one scene into a cited, reviewable production plan.” | Parallel and Gemini shown as different steps, not a vague AI cloud |
| 17–31s | Live scene brief | Enter a specific Manila microdrama scene, tone, location/period, format, duration, one must-include detail, and one production constraint | User intent must be readable at 1080p |
| 31–45s | Start live planning; compress only dead wait | “Parallel researches production design, cinematography, props, and composition from that brief.” | Visible live-mode/provider status; never show fixture badge |
| 45–62s | Sources tab, zoomed | “Every result keeps its URL, publisher, purpose, finding, and verification state.” | Show at least three real URLs and mark one supported or pin it |
| 62–78s | Generated scene and shots | “Gemini on Vertex AI turns those sources into a structured, continuity-aware shot proposal.” | Show Gemini/ADK provider, run/source count, and at least one cited prompt |
| 78–91s | Proposal review and accept action | “Nothing silently changes the project. The creator reviews the delta and accepts it.” | Capture the actual review → accept transition |
| 91–103s | Shared Mara/prop and continuity audit | “Accepted identities remain linked across scenes, and changes produce explicit continuity warnings.” | Reuse the best existing continuity capture if still truthful |
| 103–112s | Production board and export handoff | “The same approved data becomes a shot table, setup plan, continuity matrix, and handoff.” | Reuse board/handoff capture |
| 112–120s | Stack and links | “Cineserye: reference-grounded pre-production with Gemini, Google ADK, Vertex AI, and Parallel Search.” | Hosted URL, public repository, license, partner track |

Suggested opening line: **“What if every creative decision stayed connected to its source—and every AI change waited for the filmmaker?”**

Suggested closing line: **“Cineserye turns a filmmaker's intent into a sourced production plan they can inspect, approve, and shoot.”**

## HyperFrames build blueprint

Create a fresh project alongside the capture archive, for example `videos/cineserye-devpost-demo/`, with:

- `BRIEF.md`: judge audience, 120-second cap, evidence-first goal, 16:9 1080p output;
- `frame.md`: current Cineserye tokens adapted for large-screen video;
- `SCRIPT.md`: narration plus exact on-screen captions;
- `STORYBOARD.md`: the timestamp table above with source media and proof checkpoints;
- `index.html`: root composition and timeline;
- `compositions/`: title, architecture, live-run, sources, approval, continuity, handoff, close;
- `assets/recordings/`: frozen real captures;
- `assets/stills/`: selected source cards, plan details, and provider badges;
- `assets/audio/`: human narration or rule-compliant Google-generated narration, licensed music, and subtle interface SFX;
- `PROOF.md`: run ID, capture date, providers, URLs intentionally shown/redacted, and which shots are live versus supporting fixture footage.

Use large editorial crops. A judge should be able to read the active input, provider name, source title, citation relationship, and acceptance action without pausing the video. Keep the application chrome visible often enough to prove the footage is one coherent product.

### Motion language

- 280–450 ms UI callout entrances; 600–900 ms section transitions.
- Camera motion only to move attention between intent, provider progress, sources, and accepted output.
- Use short violet connector lines to trace source → prompt → shot relationships.
- Use a persistent top-left chapter label, not a persistent disclaimer banner.
- Use truthful state chips: `LIVE`, `PARALLEL SEARCH`, `GEMINI · VERTEX AI`, `NEEDS VERIFICATION`, `SUPPORTED`, `ACCEPTED`.
- Avoid film-grain spectacle, fake terminals, synthetic dashboards, and decorative particle systems.

### Audio

Use concise narration and embedded English captions. Keep music low and neutral; the proof needs to be understood without sound. Because the contest restricts non-Google AI/agent tooling, do not default to HyperFrames' optional third-party TTS/media providers. A human voice recording is the lowest-risk choice.

## Production sequence under the deadline

### Gate 1 — submission blockers first

1. Select and add the repository license.
2. Review the repository and asset history for secrets or unlicensed material.
3. Make the repository public.
4. Deploy a judge-accessible app and verify the hosted URL in a signed-out browser.

Do not spend the final hours perfecting motion while any of these remains open.

### Gate 2 — capture one undeniable live run

1. Run the repository gcloud preflight.
2. Configure server-only Parallel and Google Cloud credentials without recording or exposing them.
3. Use a concise, visually distinctive Manila scene brief.
4. Record at 1600×900 or 1920×1080 with the browser zoom chosen for readable text.
5. Show provider status, source cards, cited output, and creator acceptance.
6. Save a backup recording before editing.

### Gate 3 — assemble the 120-second cut

1. Freeze the approved recordings and stills locally.
2. Write narration against the exact successful run.
3. Build the HyperFrames composition using the current Cineserye look.
4. Use existing fixture footage only for secondary continuity/handoff beats and avoid any misleading live implication.
5. Replace every placeholder clip and remove the `NO LIVE AI` treatment from the new live section; label fixture B-roll when used.

### Gate 4 — verify and publish

1. Lint and run HyperFrames checks.
2. Snapshot at 0, 17, 31, 45, 62, 78, 91, 103, 112, and 119 seconds.
3. Verify no blank frames, clipped captions, tiny URLs, exposed secrets, or false provider states.
4. Preview the whole video once at normal speed and once muted.
5. Render 1920×1080, 30 fps, H.264 MP4.
6. Upload to public YouTube or Vimeo and verify playback while signed out.
7. Complete the Devpost form with the Parallel track selected, hosted app URL, public repository, license, Google Cloud products, and other data sources.
8. Confirm the final duration is below three minutes; anything after 3:00 will not be evaluated according to the organizer's final-day reminder.

## Acceptance test for the final demo

The cut is ready only if a first-time viewer can answer all six questions after one viewing:

1. What filmmaking bottleneck does Cineserye solve?
2. What exact user intent initiated the agent run?
3. Where did Parallel run, and what sources did it return?
4. Where did Gemini/Google ADK transform those sources into production data?
5. What did the human review and approve?
6. Where can judges run the app and inspect the public source?

If any answer is unclear, shorten feature coverage and enlarge the missing proof.

## Final positioning

The strongest claim is not “Cineserye makes a movie for you.” It is:

> **Cineserye is a filmmaker-controlled planning agent that turns creative intent and web-grounded references into cited, continuity-aware production decisions.**

That framing fits all four judging dimensions:

- **Technological implementation:** real Parallel Search, Gemini/Vertex AI, Google ADK, validation, trace, and explicit acceptance.
- **Design:** a coherent journey from scene intent to production handoff rather than a disconnected proof of concept.
- **Potential impact:** less pre-production fragmentation, fewer continuity errors, faster handoff for small filmmaking teams.
- **Quality of idea:** web grounding is applied to production choices and provenance, not generic question answering.

## Sources

- [Agentic Cinema hackathon](https://agentic-cinema.devpost.com/) — official overview and current status.
- [Official rules](https://agentic-cinema.devpost.com/rules) — eligibility, permitted AI tooling, required integrations, project-age rule, and submission requirements.
- [Parallel resources](https://agentic-cinema.devpost.com/details/parallel-resources) — partner-specific resources linked by the organizer.
- [Agentic Cinema discussion forum](https://agentic-cinema.devpost.com/forum_topics) — official participant discussion surface linked in the final-day reminder.
- [HyperFrames official repository](https://github.com/heygen-com/hyperframes) — architecture, CLI, examples, catalog, and license.
- [HyperFrames examples](https://hyperframes.heygen.com/examples) — finished videos, inspectable projects, and working templates.
- [HyperFrames rendering guide](https://hyperframes.heygen.com/guides/rendering) — lint/check/render loop plus local and Docker paths.
- Local implementation evidence: `app/server/cinema/parallel-research-provider.ts`, `app/server/cinema/workflow.ts`, `app/server/cinema/vertex-adk-shot-planner.ts`, `app/server/cinema/planner-output.ts`, `app/features/scene-planner/CinemaInspector.tsx`, `README.md`, and `videos/cineserye-demo/`.
