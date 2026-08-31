# Cineserye architecture and extension guide

Cineserye keeps the canvas engine generic, cinema meaning in a domain layer, and any future agent behind a validated proposal boundary.

```text
future copilot UI and provider adapter
                  |
        cinema domain workflows
                  |
   validated command proposals
                  |
 editor history, graph rules, and persistence
```

## Generic editor foundation

`app/editor` owns selection, viewport behavior, drag, resize, connections, ordering, undo/redo, graph integrity, IndexedDB persistence, checkpoints, backup/restore, SVG export, keyboard support, responsive panels, accessibility, and security limits.

Do not add provider prompts, credentials, generated-media URLs, or cinema business rules to this layer. Generic fixes should remain portable independently of Cineserye's product decisions.

## Cinema domain layer

`app/domain/cinema` owns the planned cinema vocabulary and payload models. Its registry reserves these extension points without activating renderers or changing the current document schema:

- `scene`: synopsis, dramatic purpose, status, estimated duration, and continuity notes;
- `shot`: parent scene, framing, movement, lens, duration, and generation status;
- `character`: story summary plus appearance, voice, and wardrobe references;
- `asset`: image, video, audio, or script reference with source and provenance;
- `agent-run`: proposal lifecycle, summary, command count, and timestamps.

Each descriptor has a versioned runtime validator and is currently marked `planned`. Activating a kind later requires a focused editor renderer, inspector controls, document parsing/migration, import/export behavior, accessibility coverage, and tests. Activation should happen one node kind at a time.

## Validated command boundary

`app/editor/canvas-commands.ts` is the only prepared mutation route for a future copilot. Version 1 supports creating nodes, updating a restricted node patch, connecting nodes, and deleting nodes.

The boundary:

- treats the proposal as untrusted input;
- limits batch size and validates proposal metadata;
- applies commands sequentially to a cloned document;
- respects locked nodes and current connection rules;
- rejects unsupported commands and invalid node-kind changes;
- validates the graph and document after every command;
- returns affected IDs and one complete result without mutating editor state.

The future UI should preview the returned document and affected IDs. If the user accepts, it should record the current snapshot once and commit the returned nodes and edges once, making the proposal one undoable operation. Rejection should discard the result.

## Deliberately absent

This foundation has no provider adapter, model selection, API key, authentication, cloud persistence, prompt UI, real `agent-run`, or media generation. Cloudflare configuration is buildable but no environment has been deployed.

## Recommended first copilot slice

Activate `scene` and `shot`, then add one local mocked workflow: select a scene, request a structured shot-list proposal, preview the proposed shot nodes and connectors, accept them as one command batch, and undo the whole batch once. Keep the provider mocked until the domain schema, proposal preview, acceptance, rejection, and undo behavior are proven end to end.
