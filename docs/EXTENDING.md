# Extending Canvas Starter

The safest reuse boundary is: keep canvas mechanics generic, keep product meaning in a domain layer, and let agents act through validated commands.

```text
product UI / copilot
        |
domain workflows and provider adapters
        |
validated canvas commands
        |
editor state, graph rules, persistence, import/export
```

## Foundation layer

Keep these behaviors generic so fixes can be carried between apps:

- selection, viewport, drag, resize, connect, reconnect, and ordering;
- undo/redo and mutation history;
- graph integrity and import validation;
- IndexedDB persistence, checkpoints, backup/restore, and SVG export;
- keyboard, responsive panels, accessibility, and security limits.

Avoid putting product prompts, provider keys, generated-media URLs, or business rules in this layer.

## Domain layer

A derived app owns its node vocabulary and workflow. Add a discriminated node-data type in `app/editor/types.ts`, its renderer and inspector fields, its validation and migration rules, and focused tests.

For Cineserye, the first useful domain types could be:

- `scene`: synopsis, dramatic purpose, status, duration, and continuity notes;
- `shot`: framing, camera movement, lens, duration, and generation status;
- `character`: appearance reference, voice, wardrobe, and scene membership;
- `asset`: image, clip, audio, or script reference with provenance;
- `agent-run`: proposed actions, progress, outputs, error, and cancellation state.

Do not add all of them at once. A strong hackathon slice is `scene -> shot -> generated asset`, with one copilot capable of proposing a shot list from a selected scene.

## Agent boundary

Agents should not mutate React state directly. Give them a small command surface whose inputs are validated and whose mutations use the same history path as pointer and keyboard actions. A practical first command set is:

```ts
type CanvasCommand =
  | { type: 'create-node'; node: ProposedNode }
  | { type: 'update-node'; id: string; patch: ProposedPatch }
  | { type: 'connect-nodes'; source: string; target: string }
  | { type: 'select-nodes'; ids: string[] }
  | { type: 'fit-view'; ids?: string[] };
```

Agent responses should be proposals first. Show the affected nodes and edges, then let the user apply or reject the change as one undoable operation. Keep provider calls cancellable and store credentials only in server-side secrets.

## Cineserye first pass

1. Change `APP_CONFIG` to Cineserye and use a new database name and backup extension.
2. Replace the example document with three connected fixtures: Story Premise, Scene 01, and Shot 01.
3. Implement a `scene` node and a `shot` node before adding any other domain type.
4. Add a right-side Copilot panel that reads the selected scene and returns a structured shot-list proposal.
5. Apply accepted proposals through the command boundary and make the whole proposal one undo step.
6. Mock the provider response for the demo path before connecting a real model or cinema API.
7. Add one end-to-end test for select scene -> ask copilot -> preview -> apply -> undo.

This produces a visibly agentic cinema workflow while preserving the reliable canvas foundation.
