# Interim Story safety / layout repair — attempt 3

Fresh critic `story_history_boundary_critic_3`: **PASS for bounded repair, 9.10/10**. This is not a completed P0/P2/P4 phase or full simplification. Candidate HEAD `abfa0fa` plus dirty work; same 15-file list as attempt 2; verified sorted path/NUL/bytes/NUL digest `4b6d248437463868b7ea619533c48abe7396dd54fbe39c08ba0ad4468e39ab57`.

H1 (anchor deletion/reload), H2 (history stack safety), H3 (resolved and accepted history), H4 (original-ID recovery), D1 (durable project scope fence), D2 (shared fixture/stream/live durability), L1 (short-height layout) and L2 (mobile reachability): **PASS**. The embedded-NUL bypass is rejected before claims or dispatch. Pending/unknown malformed-record tests prove no second claim and no provider call; route test proves initial invalid scope does not dispatch either. Legitimate Unicode/nested/literal repository IDs remain supported; ASCII-only GET recovery mismatch remains explicitly open below.

Scores: correctness 9.2, simplicity 9.1, usability 8.9, safety 9.2, evidence 9.0; weights 30/20/20/20/10. Confidence high for bounded repair. Critic independently ran 73 focused tests, checked source/snapshot equality and reviewed prior 72-browser evidence. No new blocker/high finding.

Freshness addendum after the critic's initial verdict: current-candidate fixture production build and typecheck passed; **72/72 current-candidate browser checks passed**, three engines × three repetitions, three workers, no retries/skips/flakes. Current full offline run: **515 passed / 0 failed / 5 intentional paid/live skips**; includes 5 characterization tests for an unwired document-history module outside this bounded review. These reports have been supplied to the same critic as an evidence addendum, without changing the frozen candidate. `artifacts/simplified-flow/history-boundary-attempt-3/browser-final-72.json`, `units-515.json`, and `screenshots/` retain the evidence.

Commands in credential-free `/private/tmp/cineserye-full-flow-3W6tpD`:

```
CINESERYE_E2E_FIXTURE=true CINESERYE_PROVIDER_MODE=fixture CINESERYE_LIVE_ENABLED=false CINESERYE_ENABLE_CLOUD_TELEMETRY=false npm run build
npm run typecheck
npm run test:built:node -- e2e/story-development.spec.ts e2e/assistant-short-height.spec.ts e2e/canvas-planning-entry.spec.ts --grep 'cancelled story request|resolved Story result|local direction and reference|very short|planning is canvas-only' --repeat-each=3 --max-failures=3
CINESERYE_REQUIRE_RENDERER_TESTS=true CINESERYE_RUN_VIDEO_SMOKE=0 CINESERYE_RUN_STORYBOARD_SMOKE=0 CINESERYE_RUN_VERTEX_SMOKE=0 CINESERYE_RUN_STORY_LIVE_SMOKE=0 npm test -- --reporter=json --outputFile=artifacts/simplified-flow/history-boundary-final-units.json
```

Broader native matrix (attempt-2 build, not this final candidate): **510 expected / 281 passed / 3 failed / 2 interrupted / 224 not run**. Remaining failures: obsolete zero-details assertion in `story-assistant.spec.ts`; Firefox Zod eval-probe CSP warning in rich-text persistence test; Firefox initial `page.goto` timeout in hierarchy reorder test. Retained in attempt-2 `full-native-281-pass.json`. No broad-green claim. Initial Worker gate remains unresolved.

Disposition/next: prior history resurrection and NUL findings fixed; earlier failed attempts retained. Continue document/history/save extraction with characterization tests, keep all media roots and writer-lock protection, and finish capabilities/operation presentation. The interim undo boundary deliberately refuses to erase unresolved work; do not turn this into the final history architecture. POST/GET project-identity mismatch, old-backup recovery UI, other operation types, complete native/Worker matrices, exact-SHA CI, measured journey comparison and user visual approval remain mandatory/open. No remote writes, paid calls, CI dispatch, deployment, budget changes or changes to the existing 3040 preview.
