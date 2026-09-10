# P0 repair attempt 1 — INCOMPLETE, not accepted

2026-09-10. Private branch `codex/simplified-flow`, based on merged main `23af84303dd7571932e9faa94c80b2fd9b84d497`. Worktree `/private/tmp/cineserye-simplified-mzUBaY`. This packet is a WIP checkpoint, not a phase or implementation completion. The commit containing this packet freezes the described source; subsequent changes require fresh verification/review.

## Independent critic gate

Attempted to spawn **p0_repair_critic_1** for independent read-only inspection of all repair changes. Tool result: **`agent thread limit reached`**. The task already contains four completed critics from earlier planning/audits. Agent inventory confirmed that state; no close/release-agent tool is available. No fresh critic ran, and no implementation score exists. **Score: NOT AVAILABLE; verdict: NOT VERIFIED.** Previous planning scores cannot be reused.

The user must continue this branch in a fresh task (or otherwise restore fresh-agent capacity) before the required critic gate can run. Do not accept P0 or advance its dependent phases merely because some tests pass.

## Changes and rationale

- `e2e/helpers.ts`: actual pointer actionability/stability before measuring initial nodes and connector handles; no forced clicks, sleeps or weakened geometry tolerances.
- `package.json`/lock: scoped miniflare→sharp 0.35.4 override addresses high severity; retain 14 moderate entries with owner/closure criteria in `P0-dependency-audit.md`.
- Named `node-fixture` / `worker` test runtime configuration, built-server runner, separate output paths, retry count zero, JSON execution counts; ten magic-port suite skips became explicit native-runtime assertions.
- CI retains all existing checks, adds client-boundary and renderer prerequisites, native fixture matrix before Worker compatibility, same-branch cancellation, standard Linux runner. No artifact-upload action or paid/larger runner added. No CI run dispatched and no current billing-control recheck claimed.
- Storage integration uses a Vite bundle of the actual production modules served only by Playwright request interception. No test routes in production. Generated browser bundles alone are excluded from source linting.
- `StoryComposer` restores local note-only library access and text/direction discard using the existing callback and inline confirmation; `StoryAssistantLayer` restores secondary access to the existing full manual workflow panel. These changes need critic safety/parity inspection, especially operation ownership and locked/pending state across alternate entry points.
- Migrate obsolete shot-details / Story navigation / sample-duration selectors while retaining interaction, geometry, consent, undo, reference, reload and no-dispatch assertions. The sample 7-second shot now defaults to 8 seconds; setting-change coverage switches to 4 seconds deliberately.
- Native and Worker CSP permit **only self/blob media**; no remote media source allowance. Chromium built video preview subsequently passes. Firefox/WebKit remain unresolved.

## Executed verification

| Command / scope | Observed result | Evidence / limitations |
| --- | --- | --- |
| Focused original six cases, three engines × three repeats, `--retries=0` implicit config, `--workers=3 --repeat-each=3 --timeout=20000` | **54 passed** | Console run and `test-results-p0-recheck/`; before later Story/CSP changes. Must repeat on final P0 candidate. |
| `npm run check`, `typecheck`, `lint`, `check:client-boundary`, `build` | Passed during repair | Latest typecheck after Story changes passed; lint after bundle-only exclusion and boundary passed. Build retains existing >500kB chunk / static route-classification warnings. No claim these warnings are new or resolved. |
| `npm audit --audit-level=high` after fresh `npm ci` | Exit 0; **0 high/critical, 14 moderate affected entries** | Audit inventory; no forced major downgrade. |
| `CINESERYE_REQUIRE_RENDERER_TESTS=true` with all four live-smoke opt-ins forced `0`, `npm test -- --reporter=json --outputFile=artifacts/simplified-flow/unit.json` | **479 passed, 0 failed, 5 intentionally skipped paid/live tests** (484 total) | `artifacts/simplified-flow/unit.json`. All 15 tests across assembly, storyboard-media and video-media passed, including all 9 tool-dependent cases (3 renderer + 5 image decoder + 1 video decoder). Synthetic 60-second portrait silent MP4 verified; this is not provider proof. |
| First full built native discovery `npm run test:built:node -- --max-failures=12` | **121 passed, 12 failed, 2 interrupted, 345 not run** of 480 | Historical traces under `test-results/` and historical JSON `test-results/node-fixture.json`; discovery stop is NOT an acceptance pass. The old summary combined interrupted/not-run under skipped; do not count them as intended skips. Runner summary now separates statuses. Source/test repairs occurred after failures were captured; this was not a frozen final run. |
| Targeted six repaired suites, Chromium, 36 tests, `--timeout=20000 --max-failures=5` | **33 passed, 3 failed** | Remaining failures were video metadata readiness before CSP repair. Historical console, not the current JSON (later targeted run replaces it). |
| CSP repair: shot workbench at desktop/short/mobile in all engines, 9 tests, `--timeout=20000` | **3 Chromium passed, 6 Firefox/WebKit failed** | Current `artifacts/simplified-flow/node-fixture.json` and `test-results/node-fixture/` traces. Video `readyState` remained 0; some tests exhausted shortened diagnostic 20s total, others exhausted 8s metadata wait. Reproduce at normal timeout and inspect browser error/network/codec data; do not hide it with relaxed assertions. |
| `npm run test:built:worker -- e2e-worker/runtime.spec.ts` | **Startup failed closed; 0 browser cases executed** | `test-results/worker-server.log`; discovered response `{mode:'fixture', runtime:'local-node'}` instead of unsupported. Root cause requires correcting runtime identification; do not change the expected runtime to make the test pass. |
| `git diff --check` | Passed | No source-format whitespace errors. |

## Environment

Local: Node **22.23.2**, npm **10.9.8**, FFmpeg/ffprobe **8.1.2**, Playwright **1.62.1**. Lock SHA-256 `bf8206c5a429137ce03649d13ed3c2bc6a3821d2f6dbe084d7c2e172eaf522a3`. Browser catalog: Chromium **151.0.7922.34 / rev1234**, Firefox **153.0 / rev1538**, WebKit **26.5 / rev2336** (platform catalog overrides apply). `npm run check:test-environment` prints exact catalog, package and native-tool versions. CI config retains Node **22.13.0** and explicitly installs FFmpeg; CI environment and execution counts are **not yet verified**.

Existing intended browser skips: `story-assistant-stress.spec.ts` and the deterministic budget case in `stress.spec.ts` run once in Chromium, not Firefox/WebKit (4 skips in full three-engine suite). No other skip is authorized as a substitute for workflow coverage. Five unit skips are opt-in paid/live provider cases, intentionally out of scope.

## Acceptance traceability / open gates

| ID | Verdict | Remaining evidence |
| --- | --- | --- |
| P0.1 | NOT VERIFIED on final candidate | Original focused connector cases passed; repeat after all repairs and retain reload/undo evidence. |
| P0.2 | NOT VERIFIED on final candidate | Original focused checklist passed, no tolerance changes; repeat final. |
| P0.3 | NOT VERIFIED on final candidate | Original Story/mobile cases passed; later secondary-control changes require final matrix. |
| P0.4 | NOT VERIFIED | 54 historical focused passes; full repaired suite and final three repeats still required. |
| P0.5 | FAIL | Native matrix incomplete, Worker misidentified, final expected/executed/skipped/failed counts required. |
| P0.6 | PASS for executed dependency slice | High gate clear and moderate inventory present; re-audit final candidate. |
| P0.7 | FAIL | Required browser matrices have unresolved failures. |
| P0.8 | NOT VERIFIED | Native prerequisites and renderer counts recorded; CI and Worker proof pending. |
| P0.9 | NOT VERIFIED | Source/test retention map exists; five fixed-task measurements have not been captured. |

P1–P7: **not started, not accepted**. User visual approval remains required at P3; exact-SHA GitHub Actions remains required at P7.

## Highest-priority next actions

1. Restore fresh-critic capacity in a new task; inspect this repair batch independently, including whether restoring the full manual panel preserves consent/locks and avoids duplicate operation ownership. Do not repurpose previous critic approval.
2. Correct built-Worker runtime detection, then prove native-only operations fail closed. Discovery currently mistakes Node compatibility APIs for native execution; severity **high** until bounded.
3. Diagnose Firefox/WebKit built video metadata readiness with browser error and network evidence at the normal timeout; keep decode assertions. Chromium CSP success does not establish all-engine support.
4. Run clean full native/Worker matrices; repair remaining failures, repeat original six 3×3, freeze baseline task measurements and preservation map, and obtain fresh P0 critic verdict before P1.
5. Recheck $0 Actions stop-usage controls before any CI-triggering push/dispatch; no CI bypass, public changes, deployment, new credentials or paid provider tests.

## Safety and recovery

No public repository writes, deployment, resubmission, paid AI, credential updates, or GitHub Actions dispatch. No merge/push of these repairs. Existing user workspaces/artifacts remain unchanged. Initial task-owned fixture server PID79226/port3040 was stopped; built runners stop their own random-port servers. The branch is a private local WIP checkpoint, not a release. Revert only reviewed commits when authorized; never reset or delete unrelated user data/media.
