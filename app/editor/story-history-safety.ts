import type { CinemaProjectData } from '../domain/cinema/project-data';
import { canonicalRequest } from '../domain/cinema/request-digest';
import { hasUnresolvedStoryOutcome } from '../domain/cinema/story-workflow';

export const STORY_HISTORY_BLOCKED = 'Check the existing Story request before undoing past its start. Undo cannot cancel provider work.';

/** Temporary fail-closed boundary while operation tracking is extracted from
 * document history. Ordinary edits remain undoable, but a snapshot must not
 * erase an unresolved request or rewind its locally observed outcome.
 * No stacks or source records are mutated on rejection. */
export function restoreStoryHistory(current: CinemaProjectData | undefined, target: CinemaProjectData | undefined) {
  const pending = current?.storyWorkflow?.sessions.filter(hasUnresolvedStoryOutcome) ?? [];
  if (current?.projectId !== target?.projectId || !target?.storyWorkflow) {
    if (pending.length) throw Error(STORY_HISTORY_BLOCKED);
    return target;
  }
  const sessions = target.storyWorkflow.sessions.map((session) => structuredClone(session));
  // Provider observations are not creative undo. Carry a known result into an
  // older in-flight snapshot, but preserve that snapshot's acceptance mappings:
  // restoring history never inserts or re-accepts generated scenes. Re-review
  // the carried result against the restored creative source before adoption.
  for (const previous of sessions.filter(hasUnresolvedStoryOutcome)) {
    const latest = current?.storyWorkflow?.sessions.find((session) => session.id === previous.id);
    if (!latest || hasUnresolvedStoryOutcome(latest)) continue;
    if (latest.operationId !== previous.operationId || canonicalRequest(latest.source) !== canonicalRequest(previous.source)) {
      throw Error('This history step has different generation tracking. Review saved drafts before restoring it.');
    }
    const accepted = previous.accepted; const presentation = previous.presentation;
    Object.assign(previous, structuredClone(latest), { accepted, presentation,
      stage: latest.stage === 'failed' || latest.stage === 'rejected' ? latest.stage : 'stale' });
  }
  for (const operation of pending) {
    const previous = sessions.find((session) => session.id === operation.id);
    // Source and proposals are needed for safe result reconciliation. Do not
    // graft them into unrelated creative history or resurrect an old approval.
    if (!previous || !hasUnresolvedStoryOutcome(previous)
      || canonicalRequest({ ...previous, stage: null, error: null, revision: previous.revision && { ...previous.revision, status: null, resolvedAt: null } })
        !== canonicalRequest({ ...operation, stage: null, error: null, revision: operation.revision && { ...operation.revision, status: null, resolvedAt: null } })) {
      throw Error(STORY_HISTORY_BLOCKED);
    }
    previous.stage = operation.stage;
    previous.error = operation.error;
    if (operation.revision) previous.revision = structuredClone(operation.revision);
  }
  return { ...target, storyWorkflow: { ...target.storyWorkflow, sessions } };
}
