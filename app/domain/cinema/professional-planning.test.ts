import { describe, expect, it } from 'vitest';
import { MOCK_CINEMA_PROJECT_DATA } from './mock/reel-knows-tomorrow';
import {
  affectedShotsForContinuityEntity,
  assignShotsToSetup,
  buildContinuityMatrix,
  createDefaultProfessionalPlanningData,
  productionOrderedShots,
  reorderProductionShot,
  validateProfessionalPlanningData,
} from './professional-planning';

function fixture() {
  const project = structuredClone(MOCK_CINEMA_PROJECT_DATA);
  return { project, planning: createDefaultProfessionalPlanningData(project) };
}

describe('professional planning', () => {
  it('S5-UT-01 validates narrative and production order independently', () => {
    const { project, planning } = fixture();
    const scene = project.scenes[project.activeSceneId!];
    const lastShotId = scene.shotIds.at(-1)!;
    const reordered = reorderProductionShot(planning, scene.shotIds, lastShotId, 0);

    expect(scene.shotIds[0]).not.toBe(lastShotId);
    expect(productionOrderedShots(project, reordered, scene.id)[0].id).toBe(lastShotId);
    expect(validateProfessionalPlanningData(reordered, project)).toEqual(reordered);
  });

  it('S5-UT-02 setup moves preserve every shot exactly once', () => {
    const { project, planning } = fixture();
    const scene = project.scenes[project.activeSceneId!];
    const setupId = `setup-${scene.id}-insert`;
    planning.setups[setupId] = {
      id: setupId,
      sceneId: scene.id,
      name: 'Insert setup',
      camera: 'Phone camera',
      lens: '2× lens',
      lighting: 'Projector practical',
      location: 'Auditorium',
      equipment: ['tripod'],
      notes: '',
      estimatedSetupMinutes: 10,
      shotIds: [],
    };
    const moved = assignShotsToSetup(planning, [scene.shotIds[1], scene.shotIds[2]], setupId);
    const assigned = Object.values(moved.setups).flatMap((setup) => setup.shotIds);

    expect(assigned).toHaveLength(scene.shotIds.length);
    expect(new Set(assigned).size).toBe(scene.shotIds.length);
    expect(validateProfessionalPlanningData(moved, project)).toEqual(moved);
  });

  it('S5-UT-03 identifies missing and conflicting continuity states and honors explicit exceptions', () => {
    const { project, planning } = fixture();
    const scene = project.scenes[project.activeSceneId!];
    const sharedNodeId = Object.values(project.assets).find((asset) =>
      scene.shotIds.filter((shotId) => project.shots[shotId].continuityNodeIds.includes(asset.nodeId)).length > 1,
    )!.nodeId;
    const shots = scene.shotIds.filter((shotId) => project.shots[shotId].continuityNodeIds.includes(sharedNodeId));
    planning.continuityStates[shots[0]][sharedNodeId] = '';
    planning.continuityStates[shots[1]][sharedNodeId] = 'screen-left';
    const missing = buildContinuityMatrix(project, planning, scene.id);
    expect(missing.issues.some((issue) => issue.kind === 'missing')).toBe(true);

    planning.continuityStates[shots[0]][sharedNodeId] = 'screen-right';
    shots.slice(1).forEach((shotId) => { planning.continuityStates[shotId][sharedNodeId] = 'screen-left'; });
    const conflict = buildContinuityMatrix(project, planning, scene.id);
    expect(conflict.issues.some((issue) => issue.kind === 'conflict')).toBe(true);
    planning.continuityExceptions['exception-01'] = {
      id: 'exception-01', sceneId: scene.id, entityNodeId: sharedNodeId,
      fromShotId: shots[0], toShotId: shots[1], rationale: 'Mara crosses the axis on screen.',
    };
    expect(buildContinuityMatrix(project, planning, scene.id).issues.some((issue) => issue.kind === 'conflict')).toBe(false);
    expect(affectedShotsForContinuityEntity(project, sharedNodeId)).toEqual(shots);
  });

  it('rejects duplicate setup assignments and non-contiguous production order', () => {
    const { project, planning } = fixture();
    const scene = project.scenes[project.activeSceneId!];
    planning.setups[`setup-${scene.id}-duplicate`] = {
      ...structuredClone(Object.values(planning.setups)[0]),
      id: `setup-${scene.id}-duplicate`,
      name: 'Duplicate',
      shotIds: [scene.shotIds[0]],
    };
    expect(() => validateProfessionalPlanningData(planning, project)).toThrow('exactly once');

    const fresh = createDefaultProfessionalPlanningData(project);
    fresh.shots[scene.shotIds[0]].productionOrder = 9;
    expect(() => validateProfessionalPlanningData(fresh, project)).toThrow('production order');
  });
});
