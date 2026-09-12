# Native baseline after quote-freshness repair

September 11, 2026. **Complete native matrix passed: 531 expected / 527 passed / 4 pre-existing skips / 0 failed / 0 interrupted / 0 not run / 0 flaky, retries disabled**, 10.4 minutes. Command: `npm run test:built:node -- --max-failures=3` in credential-free `/private/tmp/cineserye-full-flow-3W6tpD`. This is local native fixture evidence, not Worker/CI/live-provider or full-phase acceptance.

Frozen source: branch `feature/simplified-flow`, HEAD `abfa0fab2fb26c775f639358521d9a29c3a6b640` plus dirty changes. All 306 source/test/config files match the safe snapshot before and after the run. Sorted path/NUL/bytes/NUL digest `27b3a15c2f40238ab83341e85b365ff1119fb6debbf1159b7208ef95035f5346`. Manifest and complete report retained under `artifacts/simplified-flow/native-after-quote-freshness/`: `source-manifest.json`, `browser-527.json`, and actual screenshots under `screenshots/`.

The four skips are unchanged in HEAD: `story-assistant-stress.spec.ts` and `stress.spec.ts` each explicitly limit their large-canvas budget to Chromium, skipping Firefox and WebKit. Both Chromium cases passed. Do not claim cross-engine scale proof. This corrects older wording in the quote-toolbar packet.

The same candidate also passed fixture production build, typecheck, lint, client-boundary check, and **527 offline tests / 5 intentional paid/live opt-in skips** (`quote-freshness-attempt-2/units.json`). The quote/source-freshness repair passed fresh critic **9.16/10**, with its exact before-fix reproduction and 54 repeated focused checks; see `quote-freshness-attempt-2.md`. That verdict accepts Q1–Q4 only, not the complete app. Earlier 313-pass native failure evidence is retained, not overwritten.

This complete run covers manual and advanced controls, nonlinear Story/Continue/Surprise/revision history, atomic acceptance/undo/reload, single-writer and failed-load recovery, reference permissions and media recovery, accessibility/viewport checks, and the fixture scene-to-shot-to-downloaded-video journey. It does not prove a complete Final Cut browser render/download or every acceptance-tracker obligation.

## Remaining implementation and gates

1. Finish adopting the existing shared capability contract: research/local uploads, accurate configuration versus verification, common diagnostics/feature reasons, and consistent request freshness. Endpoint-specific spending/source approval remains authoritative.
2. Finish validated document commit/ref ownership and project-replacement races; consolidate operational tracking/recovery outside reversible creative history.
3. Complete stage-state projection, five-step journey/three workspaces, measured navigation comparison, advanced-feature inventory, media/Final Cut and empty-store restore evidence.
4. Resolve the retained concurrent Worker compatibility failure; exact-candidate GitHub Actions with verified $0 Stop usage; actual user visual/walkthrough approval and all 58-criterion traceability.

No paid/provider requests, remote writes, CI dispatch, deployment or billing changes. The test runner stopped its temporary server. The older fixture preview on port 3040 was not replaced by this validation run. Full simplification remains **in progress**.
