# Hierarchy index simplification — attempt 1

Fresh critic **PASS, 9.23/10**; bounded optimization, not P0/P6/full-app acceptance. Candidate HEAD `abfa0fa` plus dirty work on `feature/simplified-flow`.

Three-file sorted path/NUL/bytes/NUL SHA256: `5200b00de9ff81f7401987e8d1117ce4d95cfa41529f0fa30803f92a7b81acab`:

```
app/editor/cinema-hierarchy.test.ts
app/editor/cinema-hierarchy.ts
app/editor/layer-structure.ts
```

Change: extract an indexed version of the existing hierarchy-edge predicate. Keep the array wrapper for existing callers. Batch classification and the layer-outline projection now build one current-document index instead of rebuilding all nodes for every edge. This changes index construction from O(edges × nodes) to O(nodes), with O(edges) lookups; it is not a claim that every other hierarchy operation is linear. No persisted data, node order, source fingerprint, layout policy or accepted/proposed state changes. No cross-edit cache.

H/P/D criteria: preserve legacy/explicit hierarchy semantics, ignore nonhierarchy edges correctly, preserve missing-endpoint behavior, pass unchanged 501-node/150ms budget, and avoid input mutation/stale role caching. New independently expected 80-combination test checks endpoint/relationship cases plus changed roles and removed endpoints. Existing attachment/reference/multiple-parent/cycle/layout/search tests remain intact.

Credential-free snapshot `/private/tmp/cineserye-full-flow-3W6tpD`: typecheck, lint, client-boundary and fixture production build passed. Full offline suite **524 passed / 0 failed / 5 intentional paid/live skips**, including native renderer tests. `artifacts/simplified-flow/hierarchy-index-attempt-1/units-524.json`. The outline test duration is 23.608ms including its fixture/assertions; the unchanged internal threshold passes. Prior full run was 522 pass / 1 fail / 5 live skips, with internal projection timing 171.48ms against 150ms; preserved in `document-controller-attempt-1/units-first.json`. These are different full-suite observations, not a controlled benchmark or user-study speedup claim. No budget/fixture reduction or retries.

Fresh critic `hierarchy_index_critic_1`: **H/P/D PASS, 9.23/10**, no blockers. Scores correctness 9.4, simplicity 9.3, usability 8.9, safety 9.4, evidence 9.0; weights 30/20/20/20/10. Independently verified source/snapshot digest, 19 focused tests and both retained full-unit reports. Insight: removing redundant work without cross-edit caching is simpler than cache invalidation; retain the array wrapper for occasional callers. Other local-index allocations need no abstraction absent profiling. Complete built native matrix is running separately; concurrent Worker compatibility, exact-SHA CI, actual visual/walkthrough approval and all 58 full-phase criteria remain open. No paid calls or remote writes.
