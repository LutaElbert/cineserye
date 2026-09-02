# Cineserye scene-planning evaluations

This suite follows the Google Agents CLI evaluation dataset and configuration formats while Cineserye keeps its production agent runtime in TypeScript.

- Dataset: `datasets/cineserye-scene-planning.json`
- Policy: `contract-and-production-usefulness-v1`
- Agent version: `scene-planner-v1`
- Cases: period suspense, dialogue coverage, and genre-contrast intent fidelity

The deterministic Vitest suite remains the pull-request gate for schema validity, duration reconciliation, citation references, continuity, costs, command safety, and no-content telemetry. The opt-in Vertex smoke test proves the official TypeScript ADK path against local ADC.

`app/server/cinema/evaluation-adapter.ts` is the runtime-neutral bridge. It emits a versioned evaluation artifact with the dataset case, validated input/output, provider configuration, scoring policy, run ID, and a `no-content-v1` trace. Its deterministic contract test runs with:

```sh
npx vitest run app/server/cinema/evaluation-adapter.test.ts
```

Agents CLI `eval generate` expects an ADK-compatible HTTP API rather than Cineserye's browser-facing `/api/cinema/plan-scene` contract. When an ADK/A2A evaluation endpoint is intentionally added, run:

```sh
agents-cli eval run \
  --dataset tests/eval/datasets/cineserye-scene-planning.json \
  --config tests/eval/eval_config.yaml \
  --url "$CINESERYE_EVAL_ENDPOINT" \
  --app-name cineserye
```

The managed `agents-cli eval run` command is intentionally not part of the offline regression gate: it requires a running ADK-compatible endpoint and may invoke a model. Do not add a Python production service solely to satisfy the CLI, and do not enable cloud prompt/response logging for these fixtures. Keep `CINESERYE_ENABLE_CLOUD_TELEMETRY` unset unless content handling and retention have been reviewed explicitly.

Sprint 7 adds a deterministic local Agents CLI grade for the cross-scene continuity boundary. It verifies that a future copilot proposal identifies every affected scene and shot and remains uncommitted until explicit acceptance:

```sh
agents-cli eval grade \
  --traces tests/eval/datasets/cineserye-cross-scene-continuity-traces.json \
  --config tests/eval/cross_scene_eval_config.yaml \
  --output output/eval/sprint7
```

This custom metric executes locally in-process. It does not call an LLM, use Vertex credits, or send prompt content to a managed evaluation service.
