# End-to-end closure plan — September 8, 2026

## Scope and authority

Finish the existing canvas-native premise → Assistant → scenes → shots → images → videos → assembly workflow. Preserve zoom, drag, editing, locking, connections, undo/redo, saved projects, reference identity and explicit generation approvals. Do not replace the editor, change configured models, or introduce a second runtime.

The approved USD 0.05 single analysis ran once and completed (see `artifacts/assistant-live-analysis-2026-09-08/README.md`). Implementation/regression work does not approve additional paid requests. Each following live stage needs its reviewed configuration/estimate and explicit approval. Fixture tests and local synthetic MP4 renders are not proof of real generated video quality.

## Work stages and acceptance

| Stage | Work and acceptance criteria | Evidence/gate |
| --- | --- | --- |
| Assistant | Grounded one-room/no-dialogue/survival limits retained when literal and unambiguous; negation and user overrides remain safe. Brief retains original premise. No claim that a narrow parser understands arbitrary constraints. | Deterministic saved-response regressions; subsequent live quality evaluation still needed. |
| Questions | Required/Optional labels visible; skipping optional questions proceeds once, never repeats them or falsely records the recommendation as a user answer. Required runtime/format/conflict questions cannot be skipped. Keep plain concise model question guidance. | Domain tests, rendered UI tests, independent browser critic. |
| Scenes | Review real outline before acceptance; 12-second example remains 12 seconds; protect existing scene IDs and unselected proposals, stale-source rejection and revision history. | Existing unit/browser regressions; next separately approved live stage. |
| Shots | Assistant selects exact scene IDs independent of current canvas selection; accepted shot durations cover scene budget; no silently rounded story duration. For the proposed small test request exactly 3×4s. | Scoped planning regressions, explicit output review before purchase. |
| Images | Decode actual returned PNG/JPEG/WebP dimensions and reject invalid raster bytes; no fabricated seeds; preserve old numeric-seed records. Review and download a real image only after separate approval. | Native decoder/unit contracts, pricing/consent tests; live image not yet purchased. |
| Video | Default to sufficient supported clip duration where possible. Before purchase disclose too-short footage or paid extra footage; keep planned shot duration unchanged. Preserve approved-frame identity, stale-input guards and new-request approval. | Video safety tests; real 4s clip requires separate approval/configuration. |
| Export | Every planned shot must have a current approved take. Narrative ordering, 720p/24fps silent export, valid frame/runtime metadata and real download. No claim of full-story export for only one selected shot. | Native assembly tests; complete real-story export pending real media. |
| Final regression | Unit/integration suite, typecheck, lint, client boundary, build, browser regressions; independent screenshot review; close owned servers/tabs and retain identified evidence. | Report results and remaining paid gates honestly. |

## Minimal complete live scenario

One 12-second vertical scene, three 4-second shots: discover board → room changes → all friends survive. No dialogue, one room, four friends, Horror + Mystery. First review the generated outline and shot plan. Then independently approve each image/video request. Completion needs three approved images and three approved 4-second clips, followed by the assembled 12-second MP4. A single image/clip is only a media smoke test.

Runtime is whole-story allocation, not automatically each scene. Veo's current 4/6/8-second generation choices do not change the story timeline. Longer or unsupported allocations require explicit review/replanning or trimming; do not imply support for arbitrary continuous long-form rendering.

## Cases not to miss

- Optional questions left blank; one answered, others skipped; required question omitted; unknown/duplicate answer IDs.
- One-room limit omitted by model, already present, negated, conditional, from a different source, or in conflict with explicit controls.
- Existing projects with numeric seeds continue to load; unspecified seed is null, not a random fabricated value.
- Corrupt/truncated/oversized images; true dimensions different from requested ratio; decoder unavailable before purchase.
- 4s footage versus 6s planned shot; 8s footage versus 12s shot; longer footage trimmed without changing the planned duration silently.
- Changed frame/reference/prompt/settings clear approval; no duplicate paid dispatch after reload or uncertain failure.
- Partial scene/shot/media coverage cannot be exported as a complete movie.
- Original user localhost:3000 session is not replaced by testing fixtures.

## Limitations that remain explicit

Current local assembly: silent MP4, 720p, 24fps, maximum 24 clips/120 seconds and 200 MB input. No audio mix, hosted multi-user authorization, or 50–60-minute render is implied. Exported MP4 must be downloaded; it is not embedded in project backup. Do not widen these limits to pass a test.
