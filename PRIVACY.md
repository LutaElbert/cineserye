# Cineserye privacy baseline

Cineserye is local-first. The editable canvas, cinema sidecar, accepted prompts, normalized research sources, and history are stored in the browser's `cineserye-local` IndexedDB database. `.cineserye` backups and SVG exports are created only when the creator asks for a download.

## Fixture mode

Fixture mode is the default and makes no external provider requests. Its research, prompts, and generation-cost estimates are deterministic demonstration data and are labeled accordingly.

## Optional live planning

Live mode is server-configured and requires explicit consent in the one-scene preflight before each request. It transfers:

- the selected scene text, tone, location/period, production band, optional ceiling, target duration, and equipment list to Parallel Search;
- that scene brief plus normalized research titles, URLs, findings, and query purpose to Gemini on Google Vertex AI.

Cineserye does not send the full project file, imported images, IndexedDB contents, backups, API keys, Google access tokens, or unrelated scenes. Provider credentials remain server-only. Returned source links and generated prompt artifacts become part of the local project if the creator accepts the proposal, so they may also appear in a requested `.cineserye` backup.

Parallel and Google process live request content under their own service terms and configured cloud controls. This repository does not configure provider-side retention or deletion policies and should not be treated as suitable for confidential screenplay material without a separate organizational review.

## Telemetry and logs

Default Cineserye telemetry records only run identifiers, agent/policy versions, phase, duration, provider/model names, result counts, status, and safe error codes. It excludes raw scene text, full prompts, provider payloads, credentials, and research excerpts.

ADK prompt/response capture and completion upload are disabled by default. Cloud telemetry is opt-in through `CINESERYE_ENABLE_CLOUD_TELEMETRY=true`; enabling it requires a separate content handling, access, retention, and cost review. The application has not been deployed and no analytics SDK is installed.

## User control and limits

- Cancelling, timing out, failing, or rejecting creates no canvas history entry.
- A ready proposal is a locked ghost preview until explicit acceptance.
- Acceptance is one undoable operation.
- Clearing browser site data removes the local working copy; a downloaded `.cineserye` file is the recovery mechanism.
- No authentication, collaboration cloud, media generation, or automatic deployment is implemented.

If Cineserye is deployed later, the host may process normal HTTP delivery metadata such as IP address, user agent, URL, timing, and status. Application logs must continue to exclude canvas and screenplay content. This technical baseline is not a complete privacy policy for a deployed product.
