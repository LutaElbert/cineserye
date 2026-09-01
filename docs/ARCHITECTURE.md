# Cineserye architecture and extension guide

Cineserye keeps the canvas engine generic, cinema meaning in a domain layer, and any future agent behind a validated proposal boundary.

```text
mock scene-planner UI        future provider adapter
          |                            |
          +---- cinema domain workflows
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

The current UI prototype does not activate those persistent types. `app/domain/cinema/prompt-artifacts.ts` defines typed prompt, source, presentation, and illustrative cost artifacts. `app/domain/cinema/mock/reel-knows-tomorrow.ts` supplies a validated sidecar project and a normal canvas-command proposal. Existing concept nodes act only as visual hosts, allowing the experience to be tested without prematurely changing the portable project schema.

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

The mock UI previews the returned document and affected IDs as locked ghost nodes. Acceptance records the current snapshot once and commits the returned nodes and edges once, making the proposal one undoable operation. Rejection discards the result without modifying the saved canvas.

When cinema metadata is active, `app/features/project-outline/outline-model.ts` projects the current preview or saved canvas into an automatic production hierarchy. It classifies sidecar entries into Planning, Characters, Locations, Props, Visual Elements, and Shots, and orders shots using the validated project shot sequence. The outline stores only local collapse state; selection, visibility, locking, node existence, and proposal status continue to come from the canvas document. Generic documents retain the original Layers view.

## Deliberately absent

This foundation has no real provider adapter, model invocation, API key, authentication, cloud persistence, persistent cinema payloads, real `agent-run`, or media generation. Its prompt, research, and cost interfaces are driven only by visibly labeled local mock data. Cloudflare configuration is buildable but no environment has been deployed.

## Implemented mock slice

The UI now supports one local workflow: select a scene, request a structured prompt-first shot proposal, inspect character and asset continuity, prompts, sources, and cost, preview affected nodes and connectors, accept them as one command batch, reject without mutation, and undo the accepted batch once.

The next architectural slice should promote the approved sidecar fields into a versioned persistent cinema payload with backup migration and restore validation. Parallel and Gemini/Vertex adapters should remain separate later steps.
