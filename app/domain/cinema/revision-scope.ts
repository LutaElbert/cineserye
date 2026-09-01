import {
  validateCinemaProjectData,
  type CinemaProjectData,
} from './project-data';

function padded(index: number) {
  return String(index + 1).padStart(2, '0');
}

function remapList(values: readonly string[], map: ReadonlyMap<string, string>) {
  return values.map((value) => map.get(value) ?? value);
}

/** Gives every generated entity and visual host a run-scoped identity. */
export function scopeCinemaProjectDataForRun(
  project: CinemaProjectData,
  runId: string,
): CinemaProjectData {
  const token = runId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const nodeIds = new Map<string, string>();
  const recordIds = new Map<string, string>();
  const runIds = new Map<string, string>();
  const sourceIds = new Map<string, string>();
  const promptIds = new Map<string, string>();
  const costIds = new Map<string, string>();

  Object.values(project.characters).sort((a, b) => a.id.localeCompare(b.id)).forEach((record, index) => {
    const nextId = `cine-${token}-character-${padded(index)}`;
    recordIds.set(record.id, nextId);
    nodeIds.set(record.nodeId, nextId);
  });
  Object.values(project.assets).sort((a, b) => a.id.localeCompare(b.id)).forEach((record, index) => {
    const nextId = `cine-${token}-asset-${padded(index)}`;
    recordIds.set(record.id, nextId);
    nodeIds.set(record.nodeId, nextId);
  });
  Object.values(project.shots).sort((a, b) => a.order - b.order).forEach((record, index) => {
    const nextId = `cine-${token}-shot-${padded(index)}`;
    recordIds.set(record.id, nextId);
    nodeIds.set(record.nodeId, nextId);
  });
  Object.values(project.agentRuns).sort((a, b) => a.id.localeCompare(b.id)).forEach((record, index) => {
    const nextRunId = record.id === runId ? runId : `${runId}-run-${padded(index)}`;
    runIds.set(record.id, nextRunId);
    nodeIds.set(record.nodeId, `cine-${token}-agent-run-${padded(index)}`);
  });
  Object.values(project.sources).sort((a, b) => a.id.localeCompare(b.id)).forEach((record, index) => {
    sourceIds.set(record.id, `cine-${token}-source-${padded(index)}`);
  });
  Object.values(project.prompts).sort((a, b) => a.id.localeCompare(b.id)).forEach((record, index) => {
    promptIds.set(record.id, `cine-${token}-prompt-${padded(index)}`);
  });
  Object.values(project.costs).sort((a, b) => a.id.localeCompare(b.id)).forEach((record, index) => {
    costIds.set(record.id, `cine-${token}-cost-${padded(index)}`);
  });

  const next: CinemaProjectData = {
    ...structuredClone(project),
    schemaVersion: 2,
    projectId: project.projectId || `cineserye-${project.projectNodeId ?? project.activeSceneId ?? 'local-project'}`,
    activeRevisionId: null,
    revisions: {},
    scenes: Object.fromEntries(Object.entries(project.scenes).map(([id, scene]) => [id, {
      ...structuredClone(scene),
      shotIds: remapList(scene.shotIds, recordIds),
    }])),
    shots: Object.fromEntries(Object.values(project.shots).map((shot) => {
      const id = recordIds.get(shot.id) ?? shot.id;
      return [id, {
        ...structuredClone(shot),
        id,
        nodeId: nodeIds.get(shot.nodeId) ?? shot.nodeId,
        continuityNodeIds: remapList(shot.continuityNodeIds, nodeIds),
      }];
    })),
    characters: Object.fromEntries(Object.values(project.characters).map((character) => {
      const id = recordIds.get(character.id) ?? character.id;
      return [id, { ...structuredClone(character), id, nodeId: nodeIds.get(character.nodeId) ?? character.nodeId }];
    })),
    assets: Object.fromEntries(Object.values(project.assets).map((asset) => {
      const id = recordIds.get(asset.id) ?? asset.id;
      return [id, { ...structuredClone(asset), id, nodeId: nodeIds.get(asset.nodeId) ?? asset.nodeId }];
    })),
    agentRuns: Object.fromEntries(Object.values(project.agentRuns).map((run) => {
      const id = runIds.get(run.id) ?? run.id;
      return [id, {
        ...structuredClone(run),
        id,
        nodeId: nodeIds.get(run.nodeId) ?? run.nodeId,
        sourceIds: remapList(run.sourceIds, sourceIds),
        promptIds: remapList(run.promptIds, promptIds),
      }];
    })),
    prompts: Object.fromEntries(Object.values(project.prompts).map((prompt) => {
      const id = promptIds.get(prompt.id) ?? prompt.id;
      return [id, {
        ...structuredClone(prompt),
        id,
        ownerNodeId: nodeIds.get(prompt.ownerNodeId) ?? prompt.ownerNodeId,
        runId: runIds.get(prompt.runId) ?? prompt.runId,
        continuityNodeIds: remapList(prompt.continuityNodeIds, nodeIds),
        researchSourceIds: remapList(prompt.researchSourceIds, sourceIds),
      }];
    })),
    sources: Object.fromEntries(Object.values(project.sources).map((source) => {
      const id = sourceIds.get(source.id) ?? source.id;
      return [id, { ...structuredClone(source), id, runId: runIds.get(source.runId) ?? source.runId }];
    })),
    costs: Object.fromEntries(Object.values(project.costs).map((cost) => {
      const id = costIds.get(cost.id) ?? cost.id;
      return [id, { ...structuredClone(cost), id, runId: runIds.get(cost.runId) ?? cost.runId }];
    })),
  };
  const hostNodeIds = new Set<string>([
    ...(next.projectNodeId ? [next.projectNodeId] : []),
    ...Object.values(next.scenes).map((record) => record.nodeId),
    ...Object.values(next.shots).map((record) => record.nodeId),
    ...Object.values(next.characters).map((record) => record.nodeId),
    ...Object.values(next.assets).map((record) => record.nodeId),
    ...Object.values(next.agentRuns).map((record) => record.nodeId),
  ]);
  return validateCinemaProjectData(next, hostNodeIds);
}
