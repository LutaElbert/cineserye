# Cineserye privacy baseline

Cineserye currently processes imported images and editable story-canvas documents on the user's device. Image vectorization is disabled in the default interface. The planned copilot and cinema-domain node types are not active.

## Current data handling

- Imported images, editable paths, project names, and canvas state are stored in that browser's `cineserye-local` IndexedDB database.
- Cineserye does not send images, story content, character data, prompts, or project documents to a server or AI provider.
- There are no API keys, user accounts, authentication flows, analytics SDKs, agent executions, or media-generation requests in this baseline.
- `.cineserye` project backups and SVG exports are created only after the user requests a download.
- Clearing browser site data removes the locally saved project for that origin. A downloaded `.cineserye` backup is the recovery mechanism.

## Hosting metadata

If Cineserye is deployed later, the hosting provider may process standard HTTP request metadata needed to deliver the application, such as IP address, user agent, requested URL, timing, and error status. Application logs must never include imported media, SVG path data, project names, scripts, prompts, character details, or canvas contents.

## Requirements before a copilot or cloud feature

Document each provider, the exact fields sent, the purpose of the transfer, retention and deletion behavior, regional processing, user controls, and cost limits. Obtain explicit consent before the first content transfer. Agent proposals must remain previewable and rejectable, provider work must be cancellable, and secrets must remain server-side.

This technical baseline is not a complete privacy policy for a deployed product.
