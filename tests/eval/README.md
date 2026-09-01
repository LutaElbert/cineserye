# Cineserye scene-planning evaluations

This suite follows the Google Agents CLI evaluation dataset and configuration formats while Cineserye keeps its production agent runtime in TypeScript.

- Dataset: `datasets/cineserye-scene-planning.json`
- Policy: `contract-and-production-usefulness-v1`
- Agent version: `scene-planner-v1`
- Cases: period suspense, dialogue coverage, and genre-contrast intent fidelity

The deterministic Vitest suite remains the pull-request gate for schema validity, duration reconciliation, citation references, continuity, costs, command safety, and no-content telemetry. The opt-in Vertex smoke test proves the official TypeScript ADK path against local ADC.

Agents CLI `eval generate` expects an ADK-compatible HTTP API rather than Cineserye's browser-facing `/api/cinema/plan-scene` contract. When an ADK/A2A evaluation endpoint is intentionally added, run:

```sh
agents-cli eval run \
  --dataset tests/eval/datasets/cineserye-scene-planning.json \
  --config tests/eval/eval_config.yaml \
  --url "$CINESERYE_EVAL_ENDPOINT" \
  --app-name cineserye
```

Do not add a Python production service solely to satisfy the CLI, and do not enable cloud prompt/response logging for these fixtures. Keep `CINESERYE_ENABLE_CLOUD_TELEMETRY` unset unless content handling and retention have been reviewed explicitly.
