# P0 dependency audit — 2026-09-10

Owner: Cineserye private-repository maintainer (implementation agent prepares fixes; Elbert reviews dependency policy). No force downgrade, new provider, deployment, or live test is authorized.

`npm ci` on the merge baseline reported 4 high and 14 moderate affected package entries. The high chain was `@cloudflare/vite-plugin → wrangler → miniflare → sharp 0.35.2`. The patched native dependency `sharp 0.35.4` is selected via a scoped `miniflare` override. It incorporates patched libheif; see [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c). This is development/Worker image tooling, not a claim that untrusted media decoding is risk-free.

Fresh `npm ci` and `npm audit --audit-level=high` after the override: exit 0, **0 high/critical; 14 moderate affected entries**. Build/typecheck/lint passed; native/Worker matrices remain in progress. Lockfile hash at this audit: `bf8206c5a429137ce03649d13ed3c2bc6a3821d2f6dbe084d7c2e172eaf522a3`.

| Moderate root and dependency path | Affected runtime / current boundary | Owner and closure criterion |
| --- | --- | --- |
| `@google/adk → @opentelemetry/* → core <2.8.0`, unbounded W3C baggage allocation ([advisory](https://github.com/advisories/GHSA-8988-4f7v-96qf)) | Server agent/telemetry dependencies. Fixture jobs disable cloud telemetry and pass no credentials; this does not prove the dependency unreachable in every live path. | Maintainer: adopt an ADK-compatible patched telemetry release, keep matching SDK/exporter versions, then rerun boundary/adapter/unit/build suites before live release. Do not force ADK 1.2.0 downgrade suggested by audit. |
| `@google/adk → adm-zip 0.6.0`, extraction follows destination symlinks ([advisory](https://github.com/advisories/GHSA-vwc7-r8mq-g2x9)) | ADK tooling extraction dependency. Cineserye portable project import uses its own validated envelope, not this extraction API. Existing override is retained, not represented as a fix for this advisory. | Maintainer: require patched upstream extraction or prove/remove the affected import path before any untrusted archive extraction feature. Keep adversarial backup tests. |
| `gaxios 6.7.1 → uuid 9.0.1`, caller-buffer bounds in v3/v5/v6 ([advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq)) | Server HTTP/auth dependency; audit does not establish a reachable Cineserye exploit. | Maintainer: resolve a compatible gaxios/uuid upgrade in a dedicated dependency slice with HTTP/auth adapter tests; do not force a major UUID override on an incompatible consumer. |

Remaining risks are explicitly open, not waived as zero risk. Re-audit exact candidate before P0 and P7 completion and before separately authorized live/hosted release. CI retains the high-severity gate.
