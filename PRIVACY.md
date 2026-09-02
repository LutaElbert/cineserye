# Cineserye privacy baseline

Cineserye is local-first. The editable canvas, multi-scene order, scoped continuity variants/exceptions, cinema sidecar, accepted prompts, normalized research sources, source-curation state, reference rights/usage records, content-addressed reference/storyboard/video blobs, illustrative cost profiles, checkpoints, pending proposal reviews, content-free agent traces, and last-non-empty recovery copy are stored in the browser's `cineserye-local` IndexedDB database. Session undo/redo remains in memory. `.cineserye` backups, SVG exports, trace JSON exports, clip MP4 downloads, and clip metadata exports are created only when the creator asks for a download. Version-6 project backups embed the local images required by reference and storyboard records and verify every SHA-256 hash during restore; video metadata is portable, but MP4 bytes are intentionally excluded to avoid silently huge backups.

## Fixture mode

Fixture mode is the default and makes no external provider requests. Its research, prompts, and generation-cost estimates are deterministic demonstration data and are labeled accordingly.

## Optional live planning

Live mode is server-configured and requires explicit consent in the one-scene preflight before each request. It remains blocked unless the local live switch, required `elbertluta@gmail.com` account assertion, project and ADC quota project `cineserye`, and a positive operator per-run ceiling all match. Consent is bound to a digest of the exact selected scene payload and ceiling. It transfers:

- the selected scene text and the confirmed one-scene brief—including creation mode, format, tone, location, duration, beats, content constraints, generation budget, production band, and equipment—to Parallel Search;
- that scene brief plus normalized research titles, URLs, findings, and query purpose to Gemini on Google Vertex AI.

Cineserye does not send the full project file, imported images, IndexedDB contents, backups, API keys, Google access tokens, or unrelated scenes. Provider credentials remain server-only. Returned source links and generated prompt artifacts become part of the local project if the creator accepts the proposal, so they may also appear in a requested `.cineserye` backup.

Parallel and Google process live request content under their own service terms and configured cloud controls. This repository does not configure provider-side retention or deletion policies and should not be treated as suitable for confidential screenplay material without a separate organizational review.

## Optional live storyboard stills

Storyboard generation is a separate approval and spend boundary available only for an accepted shot plan. Immediately before a request, Cineserye shows the exact storyboard prompt, selected output count, aspect ratio, provider profile, and eligible references. Only locally stored references that have explicit non-unknown rights, image-generation permission, creator approval, and shot attachment are included. Inspiration-only links are never fetched or sent.

Live storyboard mode sends the confirmed prompt and approved reference pixels to Google Vertex AI. It does not send unrelated project nodes, rejected references, backups, API keys, or browser storage. The server refuses live storyboard calls until a unit-price snapshot, maximum estimated spend, and maximum output count are configured. Ordinary tests use the offline fixture; the live smoke is opt-in and bounded to one non-confidential image.

## Optional one-shot live video

Video is a separate approval, content-transfer, and spend boundary available only after one storyboard frame is approved. The preflight shows the exact motion prompt, negative constraints, approved start frame, model capability, duration, aspect ratio, resolution, silent-audio setting, one-output ceiling, and estimated spend. Live mode sends only that confirmed prompt and approved start/end frame pixels to the environment-selected Vertex Veo model. Separate reference images are not sent in the start-frame workflow, and unrelated nodes, rejected frames, browser storage, API keys, and Google credentials remain excluded.

The server blocks unsupported formats and settings before provider work and requires current per-second pricing plus a per-request spend ceiling. A clip is stored locally by content hash and remains a candidate until explicit approval. Cancelling fixture mode stops local work without cost. The current Google GenAI TypeScript SDK exposes Veo polling but no service-side cancellation method; cancelling live mode therefore stops local tracking and warns that provider processing and billing may continue. Ordinary tests never call Veo, and the live smoke is an explicit one-output opt-in.

## Telemetry and logs

Default Cineserye telemetry records only run identifiers, agent/policy versions, phase, duration, provider/model names, result counts, status, and safe error codes. It excludes raw scene text, full prompts, provider payloads, credentials, research excerpts, and source URLs. An allowlist removes undeclared fields. The browser keeps at most 500 trace events or 30 days, whichever limit is reached first. The diagnostics panel and its optional JSON export use the same `no-content-v1` contract.

ADK prompt/response capture and completion upload are disabled by default. Cloud telemetry is opt-in through `CINESERYE_ENABLE_CLOUD_TELEMETRY=true`; enabling it requires a separate content handling, access, retention, and cost review. The application has not been deployed and no analytics SDK is installed.

The Sprint 7 and Sprint 10 Agents CLI evaluations use hand-authored synthetic traces and local in-process code metrics. The Sprint 10 corpus separates 18 development cases from six sealed holdouts. These grades send no prompt, scene, or project content to Vertex Evaluation Service, invoke no judge model, and spend no provider credits. Cloud Trace, completion upload, and BigQuery Agent Analytics are not enabled.

## User control and limits

- Cancelling, timing out, failing, or rejecting creates no canvas history entry.
- A ready proposal is a locked ghost preview until explicit acceptance.
- A ready proposal is saved locally before review so a reload does not repeat a provider call. It contains generated planning content and is restored only when its source-document fingerprint still matches; pending reviews are not included in SVG or `.cineserye` backup exports.
- Restoring an accepted revision is an entirely local operation. It does not contact Parallel, Vertex AI, or another provider; the selected immutable snapshot is re-scoped into a new local revision after explicit confirmation.
- Treatment import parses local text into editable scene-boundary proposals. It creates no scene, calls no provider, and mutates no accepted project until the creator explicitly accepts the review.
- Sharing a character or asset first displays the locally derived affected scenes and shots. Scoped variants and continuity exceptions are stored only after explicit acceptance through the validated command boundary.
- A continuity audit reads only the selected project/scene/entity metadata projection, returns at most five findings, and makes no provider call in Fixture mode. Dismissal does not alter continuity records; accepting an intentional exception rechecks the project fingerprint and is one undoable command.
- Source pins, support states, and removals made during review affect only the pending preview until acceptance.
- Reference uploads default to unknown rights, research-only use, and pending approval. None of those states is inferred from a filename, URL, or upload action.
- External inspiration links are stored as creator-provided metadata and are never fetched automatically.
- Cancelling or failing storyboard generation records a content-free run state but stores no incomplete frame. A provider safety rejection produces no approvable artifact.
- Only one storyboard frame can be the approved anchor for a shot at a time; approving another candidate demotes the previous anchor without changing the accepted shot plan.
- Every video operation records its shot, revision, exact prompt version, start/end frame identities, provider/model capability snapshot, settings, estimate, timestamps, status, and retry link. A completed clip remains unapproved until creator review.
- Video bytes stay in local IndexedDB and are protected from orphan cleanup while referenced. `.cineserye` backups preserve clip provenance and approval but do not embed MP4 bytes; creators must download clips separately.
- Displayed citations are limited to explicit, valid planner-to-source relationships; missing source IDs do not receive substitutes.
- Generation-cost figures are illustrative planning estimates, not provider quotes or billing records. A plan can also be expressed in credits or marked unpriced.
- Acceptance is one undoable operation.
- Deleting the final unlocked layers requires confirmation. Before applying it, Cineserye stores one local last-non-empty recovery document; restoring it does not contact a provider.
- The recovery document is overwritten by the next confirmed full-canvas deletion and removed after a successful recovery. It is not a substitute for a portable backup.
- Clearing browser site data removes the local working copy; a downloaded `.cineserye` file is the recovery mechanism.
- No authentication, collaboration cloud, autonomous copilot, multi-shot video generation, automatic timeline assembly, or automatic deployment is implemented. Storyboard stills and one approved-frame-to-clip experiment are the bounded media exceptions described above.

If Cineserye is deployed later, the host may process normal HTTP delivery metadata such as IP address, user agent, URL, timing, and status. Application logs must continue to exclude canvas and screenplay content. This technical baseline is not a complete privacy policy for a deployed product.
