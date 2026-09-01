import { scopeCinemaProjectDataForRun } from './revision-scope';
import type { CinemaProjectData } from './project-data';

/**
 * Rehydrates an immutable accepted snapshot as a fresh ready proposal.
 * Historical IDs are never reused: every generated record and host is scoped
 * to the restore run before it can reach the canvas command boundary.
 */
export function prepareCinemaRevisionRestore(
  project: CinemaProjectData,
  revisionId: string,
  restoreRunId: string,
  restoredAt: string,
): CinemaProjectData {
  const revision = project.revisions[revisionId];
  if (!revision) throw new Error('The selected plan revision is missing.');
  if (revision.id === project.activeRevisionId) throw new Error('The selected plan revision is already current.');
  const sourceRun = revision.snapshot.agentRuns[revision.runId];
  if (!sourceRun) throw new Error('The selected plan revision has no restorable run.');

  const sceneId = revision.sceneId;
  const sourceIds = new Set(sourceRun.sourceIds);
  const promptIds = new Set(sourceRun.promptIds);
  const scene = structuredClone(revision.snapshot.scene);
  const candidate: CinemaProjectData = {
    schemaVersion: 2,
    projectId: project.projectId,
    activeRevisionId: null,
    revisions: {},
    projectNodeId: project.projectNodeId,
    activeSceneId: sceneId,
    sceneOrder: [sceneId],
    scenes: { [sceneId]: scene },
    shots: structuredClone(revision.snapshot.shots),
    characters: Object.fromEntries(Object.entries(revision.snapshot.characters).map(([id, character]) => [id, {
      ...structuredClone(character),
      sceneIds: character.sceneIds.includes(sceneId) ? [sceneId] : [],
    }])),
    assets: Object.fromEntries(Object.entries(revision.snapshot.assets).map(([id, asset]) => [id, {
      ...structuredClone(asset),
      sceneIds: asset.sceneIds.includes(sceneId) ? [sceneId] : [],
    }])),
    agentRuns: {
      [restoreRunId]: {
        ...structuredClone(sourceRun),
        id: restoreRunId,
        status: 'ready',
        summary: `Restored from revision ${revision.number}: ${sourceRun.summary}`,
        startedAt: restoredAt,
        completedAt: null,
        sourceIds: sourceRun.sourceIds.filter((id) => sourceIds.has(id)),
        promptIds: sourceRun.promptIds.filter((id) => promptIds.has(id)),
      },
    },
    prompts: Object.fromEntries(Object.entries(revision.snapshot.prompts)
      .filter(([id, prompt]) => prompt.runId === revision.runId && promptIds.has(id))
      .map(([id, prompt]) => [id, { ...structuredClone(prompt), runId: restoreRunId }])),
    sources: Object.fromEntries(Object.entries(revision.snapshot.sources)
      .filter(([id, source]) => source.runId === revision.runId && sourceIds.has(id))
      .map(([id, source]) => [id, { ...structuredClone(source), runId: restoreRunId }])),
    costs: Object.fromEntries(Object.entries(revision.snapshot.costs)
      .filter(([, cost]) => cost.runId === revision.runId && cost.sceneId === sceneId)
      .map(([id, cost]) => [id, { ...structuredClone(cost), runId: restoreRunId }])),
  };
  return scopeCinemaProjectDataForRun(candidate, restoreRunId);
}
