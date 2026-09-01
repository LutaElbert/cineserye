# Cineserye privacy baseline

Cineserye is local-first. The editable canvas, cinema sidecar, accepted prompts, normalized research sources, source-curation state, reference rights/usage records, content-addressed reference and storyboard blobs, illustrative cost profiles, checkpoints, pending proposal reviews, content-free agent traces, and last-non-empty recovery copy are stored in the browser's `cineserye-local` IndexedDB database. Session undo/redo remains in memory. `.cineserye` backups, SVG exports, and trace JSON exports are created only when the creator asks for a download. Version-6 project backups embed the local media required by reference and storyboard records and verify every SHA-256 hash during restore.

## Fixture mode

Fixture mode is the default and makes no external provider requests. Its research, prompts, and generation-cost estimates are deterministic demonstration data and are labeled accordingly.

## Optional live planning

Live mode is server-configured and requires explicit consent in the one-scene preflight before each request. It transfers:

- the selected scene text and the confirmed one-scene brief—including creation mode, format, tone, location, duration, beats, content constraints, generation budget, production band, and equipment—to Parallel Search;
- that scene brief plus normalized research titles, URLs, findings, and query purpose to Gemini on Google Vertex AI.

Cineserye does not send the full project file, imported images, IndexedDB contents, backups, API keys, Google access tokens, or unrelated scenes. Provider credentials remain server-only. Returned source links and generated prompt artifacts become part of the local project if the creator accepts the proposal, so they may also appear in a requested `.cineserye` backup.

Parallel and Google process live request content under their own service terms and configured cloud controls. This repository does not configure provider-side retention or deletion policies and should not be treated as suitable for confidential screenplay material without a separate organizational review.

## Optional live storyboard stills

Storyboard generation is a separate approval and spend boundary available only for an accepted shot plan. Immediately before a request, Cineserye shows the exact storyboard prompt, selected output count, aspect ratio, provider profile, and eligible references. Only locally stored references that have explicit non-unknown rights, image-generation permission, creator approval, and shot attachment are included. Inspiration-only links are never fetched or sent.

Live storyboard mode sends the confirmed prompt and approved reference pixels to Google Vertex AI. It does not send unrelated project nodes, rejected references, backups, API keys, or browser storage. The server refuses live storyboard calls until a unit-price snapshot, maximum estimated spend, and maximum output count are configured. Ordinary tests use the offline fixture; the live smoke is opt-in and bounded to one non-confidential image.

## Telemetry and logs

Default Cineserye telemetry records only run identifiers, agent/policy versions, phase, duration, provider/model names, result counts, status, and safe error codes. It excludes raw scene text, full prompts, provider payloads, credentials, research excerpts, and source URLs. The browser keeps at most 50 of these local traces. The diagnostics panel and its optional JSON export use the same `no-content-v1` contract.

ADK prompt/response capture and completion upload are disabled by default. Cloud telemetry is opt-in through `CINESERYE_ENABLE_CLOUD_TELEMETRY=true`; enabling it requires a separate content handling, access, retention, and cost review. The application has not been deployed and no analytics SDK is installed.

## User control and limits

- Cancelling, timing out, failing, or rejecting creates no canvas history entry.
- A ready proposal is a locked ghost preview until explicit acceptance.
- A ready proposal is saved locally before review so a reload does not repeat a provider call. It contains generated planning content and is restored only when its source-document fingerprint still matches; pending reviews are not included in SVG or `.cineserye` backup exports.
- Restoring an accepted revision is an entirely local operation. It does not contact Parallel, Vertex AI, or another provider; the selected immutable snapshot is re-scoped into a new local revision after explicit confirmation.
- Source pins, support states, and removals made during review affect only the pending preview until acceptance.
- Reference uploads default to unknown rights, research-only use, and pending approval. None of those states is inferred from a filename, URL, or upload action.
- External inspiration links are stored as creator-provided metadata and are never fetched automatically.
- Cancelling or failing storyboard generation records a content-free run state but stores no incomplete frame. A provider safety rejection produces no approvable artifact.
- Only one storyboard frame can be the approved anchor for a shot at a time; approving another candidate demotes the previous anchor without changing the accepted shot plan.
- Displayed citations are limited to explicit, valid planner-to-source relationships; missing source IDs do not receive substitutes.
- Generation-cost figures are illustrative planning estimates, not provider quotes or billing records. A plan can also be expressed in credits or marked unpriced.
- Acceptance is one undoable operation.
- Deleting the final unlocked layers requires confirmation. Before applying it, Cineserye stores one local last-non-empty recovery document; restoring it does not contact a provider.
- The recovery document is overwritten by the next confirmed full-canvas deletion and removed after a successful recovery. It is not a substitute for a portable backup.
- Clearing browser site data removes the local working copy; a downloaded `.cineserye` file is the recovery mechanism.
- No authentication, collaboration cloud, video generation, or automatic deployment is implemented. Storyboard still generation is the bounded media exception described above.

If Cineserye is deployed later, the host may process normal HTTP delivery metadata such as IP address, user agent, URL, timing, and status. Application logs must continue to exclude canvas and screenplay content. This technical baseline is not a complete privacy policy for a deployed product.
