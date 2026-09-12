# Bounded Linux CI diagnosis — not release acceptance

This private diagnostic branch starts from product commit `806144e24a19d53648f72510c4f78f861bbccaa4`. It adds only this directory and its separate push-triggered workflow. Do not merge this branch or use its result as the release gate. The release branch and its full CI remain unchanged.

Run 34676601008 passed static/security and Firefox (205 passed, two historical skips, both Final Cut checks and renderer assertion). Chromium passed 205 and failed the two initial 500-node restore notices. WebKit logged seven test timeouts before its 30-minute job timeout; full counts are unavailable. Worker was skipped and final verify failed.

Exact-product local diagnosis passed 13 executions: paired stress twice, sequential stress twice, CPU-throttled stress twice, and seven WebKit cases. No Linux cause or product fix has been established. All original assertions, retries and timeouts remain unchanged.

The diagnostic job builds once on one standard Ubuntu runner, then invokes isolated Chromium and WebKit servers sequentially. It selects two Chromium stress cases and seven WebKit cases at the existing three-worker configuration; two selected Chrome cases only exercise two active workers. It is capped at 20 minutes. WebKit still runs after a Chromium test failure, but not if build/browser setup failed or the job was cancelled. There are no uploads or package caches, no live providers, and no release verification claim.

Test and step begin/end events, remaining step IDs, timeouts, CPU/memory/pressure summaries, and Chromium restore DOM/read-only storage observations stream to the private job log. Generated Chromium copies prepend one observation hook without changing original statements. Probe and logging overhead can affect timing; passes here do not prove the full-suite environment is sound. Linux timing, graphics warnings or context cleanup failures alone must not be called an application cause.

The reporter's `reportedTimeoutMs` is the coordinator's current reported value, not an independently measured remaining budget: it can still show the initial 60-second configuration after the Chromium body sets its original 90-second limit. There is no per-process CPU/RSS attribution, exact long-task measurement, or WebKit request-lifecycle observer in this first diagnostic.

Before pushing: validate selection and diagnostic wiring locally, obtain a fresh critic, and reverify authenticated GitHub Actions $0 budget with Stop usage enabled. Do not rerun unchanged without a new discriminating hypothesis. Full exact-head native, renderer, Worker and static acceptance are still mandatory after a real repair.
