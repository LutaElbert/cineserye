# Worker baseline investigation — unresolved

2026-09-10, private `feature/simplified-flow`. No deployment, paid provider call, CI dispatch or dependency-manifest change.

The mandatory three-worker concurrency test still fails. Serial results and partial runs do not satisfy P0.5/P0.7. Do not weaken assertions or reduce concurrency to declare acceptance.

## Reproduction and observations

Credential-free copy: `/private/tmp/cineserye-full-flow-3W6tpD`. Original preview on port 3040 was left untouched.

- Wrangler 4.127.1 debug diagnostics reveal `TypeError: Can't read from request stream after response has been sent`, followed by Miniflare `Network connection lost` and local server exit.
- A minimal Worker returning JSON 400 without inspecting the body survives 300 concurrent POSTs without static assets. Adding static assets reproduces failure without Cineserye or vinext: 23 expected responses, 4 HTTP 500s and 3 connection failures in the fresh-start probe.
- The error class matches [Cloudflare issue 15203](https://github.com/cloudflare/workers-sdk/issues/15203). The associated [PR 15207](https://github.com/cloudflare/workers-sdk/pull/15207) was open when checked. This identifies an upstream reproduction, not proof that every application failure has an identical cause.
- [Selective Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) survives a 300-request minimal probe, but not the actual app. An early native-mutation guard, that guard plus API-first routing, and cancelling the rejected body also fail the actual concurrent suite.
- Latest released Wrangler 4.130.0 was tested through an isolated `npm exec --package` invocation: 255 expected rejections and 45 HTTP 500s in a 300-request probe. It kept running, but errors remained. No upgrade was retained or represented as a fix.
- All unsuccessful routing/early-guard/body-cancellation application experiments were removed. Existing direct-route runtime guards from attempt 2 remain. No unbounded request-body buffering or dependency patch was introduced.

Final restored-source concurrent run: **72 expected; 7 passed, 2 failed, 2 interrupted, 61 not run; no skips/retries**. Evidence in the credential-free copy: `artifacts/simplified-flow/worker.json`, `test-results/worker-server.log`. Earlier reports retained as `worker-before-admission.json` and `worker-cancel-workaround-failed.json`.

Raw Wrangler debug logs contain ephemeral local proxy tokens. Do not copy or publish those logs. Only the error text above is retained here. Diagnostic servers on 3051/3052 were stopped after testing.

## Decision boundary

2026-09-11 source recheck: the [upstream PR](https://github.com/cloudflare/workers-sdk/pull/15207) is still open (now shows 11 commits); the [original issue](https://github.com/cloudflare/workers-sdk/issues/15203) still describes the assets/body proxy failure. No unreleased PR package was installed or treated as a verified fix. Current native/controller work does not close this separate Worker gate.

September 11 actionbar continuation: rechecked both official upstream pages above; PR 15207 remains open with 11 commits. No new upstream release/fix is established by this check, and no package or dependency change was made. The native toolbar repair does not close this Worker gate.

P0 is still not accepted, and dependent phases cannot be accepted. The user's later “proceed, use your best judgements” permits implementation out of strict phase order while keeping all acceptance gates; it does not waive Worker compatibility. Baseline measurement, full native/Worker matrices, exact-SHA CI, actual-screen and walkthrough approval remain mandatory. Local tests are not a CI pass.
