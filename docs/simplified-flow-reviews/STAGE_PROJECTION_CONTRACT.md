# Stage projection contract — revision 1

Frozen design input before further navigation changes, September 11, 2026. This is a transition specification, not implemented behavior or P3 acceptance. Existing opt-in preview remains unchanged. Canonical scope and exclusions remain in `../SIMPLIFIED_FLOW_IMPLEMENTATION_PLAN.md`.

## Authority and scope

Derive the next action from the current document, separately owned operation observations, local-media availability, and the shared capability contract. Navigation is session state. Selecting Story, Shots, Edit, a scene, a shot, or a saved revision never dispatches, adopts, deletes, or changes an approval. There is no independently persisted stage-progress database.

Each action has an explicit stable project/scene/shot/session target; use visible target labels and a scope picker when there is more than one eligible target. Never infer dispatch scope from an invisible canvas selection. Keep browsing other stages possible, even when the next production action is blocked. A user-selected target wins over suggested ordering. Suggestions use narrative order, not production-board order.

## Projection and primary action table

| State | Workspace / task | One contextual primary action | Required explanation / transition |
| --- | --- | --- | --- |
| Empty project or missing premise | Story / Idea | Write your idea | Opens the existing local composer; manual scene creation stays secondary. No analysis on open or typing. |
| Saved premise, no reviewed direction | Story / Idea | Review direction | Shows exact source and any necessary local corrections before separate explicit request approval. |
| Direction reviewed, no scene proposals | Story / Plan | Review scene request | Opens scope, transfer, model and estimate review; it is not a generate shortcut. |
| Proposed scenes | Story / Plan | Review proposed scenes | Existing selection/reorder/allocation checks; accept exactly selected proposals in one transaction. |
| Partially accepted scenes | Story / Plan | Review remaining drafts | Accepted scene identities remain intact. Remaining proposals, history and revisions stay available; no automatic reinsertion. |
| Accepted scenes with missing shot plan | Shots / Plan | Review shot plan for [scene] | Shows explicit eligible scene/shot scope, including locked exclusions. Manual planning remains available. |
| Proposed shots | Shots / Plan | Review proposed shots | Preserve selected acceptance and unselected drafts; a batch has one undo origin. |
| Accepted shots, missing current reference | Shots / References | Review references for [shot] | Show inherited/local ownership, missing bytes, rights and intended transfer. Local upload is distinct from generation consent. |
| Reference candidates awaiting review | Shots / References | Review image candidates | Explicit approve/reject; stale/unsafe/missing bytes cannot be treated as current input. |
| Current approved reference, no current take | Shots / Video | Review video request for [shot] | Exact source/reference versions, model, requested duration, estimate/ceiling and transfer before explicit dispatch. |
| Current take candidate with usable local bytes | Shots / Video | Review take | Show actual decoded footage and requested settings separately; no automatic approval. |
| Partial set of approved takes | Shots / Video | Review next missing take | Visible count and stable target; retained approved footage is never regenerated automatically. Edit remains inspectable. |
| All included takes approved and current | Edit / Final Cut | Review sequence | Explicit order, trims and every missing/stale/short clip; no silent omissions. |
| Sequence validated, no current rendered cut | Edit / Final Cut | Render silent MP4 | Local renderer limits and runtime block visible; render only after the existing explicit action. |
| Current rendered cut available | Edit / Final Cut | Download movie | Preview and decode evidence remain visible. State that project backup excludes rendered files and individual video bytes. |
| Stale upstream source/output | Owning task | Review changed source | Name the changed source; keep old assets and lineage inspectable. Require fresh scoped approval, never auto-regenerate or delete. |
| Capability unknown, malformed, offline or blocked | Owning task | Applicable manual/recovery action, otherwise Refresh status | Adjacent shared reason and safe next step. Existing work stays editable. A refresh is read-only, never a probe or dispatch. |
| Request awaiting explicit consent | Owning task | Confirm reviewed request | One dispatch action in the review surface; suppress a competing stage-level primary button. Any scoped change invalidates approval. |
| Queued / running / local finalization | Owning task | View existing request | Stable operation ID, last observation, truthful indeterminate progress unless real totals exist. No new dispatch. |
| Disconnected / outcome unknown | Owning task | Check existing request | Retain operation identity, warn that provider work/billing may continue, and exclude it from fresh retry until reconciled. |
| Expired / pruned / unavailable result | Owning task | Review unavailable result | Non-replayable explanation and original identity. No fake recovery button; only verified retrieval or separately approved eligible new work. |
| Known terminal failure | Owning task | Review retry eligibility | Preserve successful scope and lineage; changed source/cost requires fresh approval. No retry on opening this state. |
| Local tracking stopped | Owning task | Review existing request | Distinguish stopping observation from provider cancellation/refund. Do not infer safe retry from the local stop. |
| Saved media metadata but missing bytes | References / Video / Edit | Review missing media | Images included in valid backup can restore; video metadata cannot. Offer original browser/download only when supported, never invented relinking. |

Operation uncertainty takes precedence over a suggestion to generate again for the same scope. A project-wide unrelated operation does not block local edits or unrelated eligible target inspection. Save failure and read-only admission remain visible beside stage guidance; neither is overridden by capability readiness.

## Invalidation and navigation rules

- Selection, stage, panel, focus, camera and transient operation progress do not alter creative fingerprints, undo stacks or generation consent.
- Premise, accepted plan, timing, scope, rights, source reference version, model, configuration or price changes invalidate only applicable pending approvals and mark dependent outputs stale. Existing assets remain retained.
- Project replacement, including an older backup with the same project ID, changes the document-owner epoch and rejects old asynchronous receivers. Durable server records remain authoritative for dispatch identity.
- Back/forward/reload restore session navigation without mutations; if a target no longer exists, show an honest empty state and a visible way to choose a surviving target.
- When the current workbench already owns the primary action, the guide becomes descriptive with secondary navigation only. Advanced planning/export/diagnostics retain their inventory entries and cannot create another state owner.

## Evidence required before acceptance

Run the five identical tasks in the P0 preservation inventory on a frozen repaired baseline and candidate at 1440×900. Keep raw action logs, separate navigation from editing/consent, record competing CTAs and hidden selection prerequisites, and report next-action timings as automation measurements only. Do not substitute complete-suite runtime for task timing.

Also cover empty, partial, stale, blocked, unknown/expired and restored projects; 877×559, 390×844, 200% zoom, reduced motion, keyboard focus, automated accessibility and 20 transitions with request/listener counts. Show actual five-stage screenshots and the measured walkthrough to the user for explicit review. This document supplies no visual approval and does not waive the Worker or exact-SHA CI gates.
