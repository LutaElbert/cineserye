# Canvas-only planning entry

## Scope

Removed the context-dependent planning/generation button from the desktop top bar and the planning item from the mobile project menu. The existing Assistant navigation shortcut remains. Story Generate and scene Review shot plan controls remain inside their actual canvas nodes. Project-menu backup, export and new-project actions are preserved.

This does not implement the newly proposed conversational review or multi-scene Plan shots action. Those remain design proposals. Existing scene planning, cancellation, proposal acceptance and revision controls are retained.

## Acceptance criteria and verification

- No Generate shot plan, Develop this story, Review shot plan or Create revision action in the top bar, including its mobile overflow menu.
- Scene planning remains reachable through the actual scene editor; opening it creates no generation request or editor popup.
- The global Assistant shortcut remains available with an idea, regardless of whether a scene is selected.
- Mobile Backup/Export/New controls retain keyboard focus and Escape behavior.
- Existing fixture planning, acceptance, revision history, multi-scene continuity, scoped consent and Assistant recovery continue to pass.

Results: 17 existing Chromium regression cases passed (16 in the clean combined run plus one corrected mobile-entry recheck), plus 2 independent desktop/mobile critic cases. Typecheck, targeted lint and whitespace checks passed. Critic scores: desktop 8.8, narrow 8.7, eligible for human review only. No paid calls were made.

Earlier failures are retained separately. Some assertions depended on removed toolbar controls and were migrated to canvas/inspector entry points. Initial test traces written inside the watched workspace also triggered Vite HTML reloads and CSS rescans; final runs wrote outside the project and their evidence was moved back only after the fixture server stopped. The mobile recheck explicitly selects the scene after Escape, which clears selection.

## Evidence and cleanup

- `artifacts/canvas-planning-entry-final/regression/`
- `artifacts/canvas-planning-entry-final/mobile-recheck/`
- [Desktop critic screenshot](../artifacts/canvas-planning-entry-final/critic/canvas-planning-entry-plan-998dc--remain-available-at-1440px-chromium/canvas-assistant-1440.png)
- [Mobile critic screenshot](../artifacts/canvas-planning-entry-final/critic/canvas-planning-entry-plan-9b673-s-remain-available-at-390px-chromium/canvas-assistant-390.png)

Task-owned port 3040 stopped; port 3000 left running. Temporary test directory moved into the evidence folder; no user data, media or project source removed. No push or deployment.
