import { describe, expect, it } from 'vitest';
import { MOCK_CINEMA_PROJECT_DATA } from './mock/reel-knows-tomorrow';
import { scopeCinemaProjectDataForRun } from './revision-scope';

describe('cinema revision identity scope', () => {
  it('creates disjoint generated ids for separate planning runs while keeping scene hosts stable', () => {
    const first = scopeCinemaProjectDataForRun(MOCK_CINEMA_PROJECT_DATA, 'run-one-0001');
    const second = scopeCinemaProjectDataForRun(MOCK_CINEMA_PROJECT_DATA, 'run-two-0002');
    expect(first.activeSceneId).toBe(second.activeSceneId);
    expect(first.projectId).toBe(second.projectId);
    const firstGenerated = new Set([
      ...Object.keys(first.shots), ...Object.keys(first.characters), ...Object.keys(first.assets),
      ...Object.keys(first.prompts), ...Object.keys(first.sources), ...Object.keys(first.costs),
    ]);
    const secondGenerated = [
      ...Object.keys(second.shots), ...Object.keys(second.characters), ...Object.keys(second.assets),
      ...Object.keys(second.prompts), ...Object.keys(second.sources), ...Object.keys(second.costs),
    ];
    expect(secondGenerated.every((id) => !firstGenerated.has(id))).toBe(true);
    expect(Object.keys(first.revisions)).toHaveLength(0);
    expect(Object.keys(first.professionalPlanning!.shots)).toEqual(first.scenes[first.activeSceneId!].shotIds);
    expect(Object.values(first.professionalPlanning!.shots).every((shot) => shot.revisionId === null)).toBe(true);
    expect(Object.values(first.professionalPlanning!.setups).flatMap((setup) => setup.shotIds))
      .toEqual(expect.arrayContaining(first.scenes[first.activeSceneId!].shotIds));
  });
});
