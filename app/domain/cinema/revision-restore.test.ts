import { describe, expect, it } from 'vitest';
import { MOCK_CINEMA_PROJECT_DATA } from './mock/reel-knows-tomorrow';
import { acceptCinemaPlanRevision } from './project-data';
import { prepareCinemaRevisionRestore } from './revision-restore';
import { scopeCinemaProjectDataForRun } from './revision-scope';

describe('cinema revision restoration', () => {
  it('restores an immutable snapshot as a fresh successor with disjoint generated ids', () => {
    const revisionOneId = MOCK_CINEMA_PROJECT_DATA.activeRevisionId ?? '';
    const revisionOne = MOCK_CINEMA_PROJECT_DATA.revisions[revisionOneId];
    const secondProposal = scopeCinemaProjectDataForRun(MOCK_CINEMA_PROJECT_DATA, 'revision-two-run');
    const secondRun = Object.values(secondProposal.agentRuns)[0];
    secondRun.status = 'ready';
    const secondShot = secondProposal.shots[secondProposal.scenes['scene-01'].shotIds[0]];
    secondShot.title = 'Changed entrance';
    secondShot.durationSeconds = 9;
    const current = acceptCinemaPlanRevision(
      MOCK_CINEMA_PROJECT_DATA,
      secondProposal,
      '2026-09-01T04:00:00.000Z',
    );

    const restoredProposal = prepareCinemaRevisionRestore(
      current,
      revisionOneId,
      'restore-revision-one-run',
      '2026-09-01T05:00:00.000Z',
    );
    const restoredRun = restoredProposal.agentRuns['restore-revision-one-run'];
    const restoredShot = restoredProposal.shots[restoredProposal.scenes['scene-01'].shotIds[0]];
    expect(restoredRun).toMatchObject({ status: 'ready', summary: expect.stringContaining('Restored from revision 1') });
    expect(restoredShot.title).toBe(Object.values(revisionOne.snapshot.shots)[0].title);
    expect(Object.keys(restoredProposal.shots)).not.toContain(secondShot.id);
    expect(Object.keys(revisionOne.snapshot.shots)).not.toContain(restoredShot.id);
    expect(restoredProposal.revisions).toEqual({});

    const restored = acceptCinemaPlanRevision(current, restoredProposal, '2026-09-01T05:00:00.000Z');
    const active = restored.revisions[restored.activeRevisionId ?? ''];
    expect(active).toMatchObject({ number: 3, predecessorRevisionId: current.activeRevisionId, status: 'active' });
    expect(restored.revisions[revisionOneId].snapshot).toEqual(revisionOne.snapshot);
    expect(Object.keys(restored.revisions)).toHaveLength(3);
  });

  it('rejects restoring the current or an unknown revision', () => {
    expect(() => prepareCinemaRevisionRestore(
      MOCK_CINEMA_PROJECT_DATA,
      MOCK_CINEMA_PROJECT_DATA.activeRevisionId ?? '',
      'restore-current-run',
      '2026-09-01T05:00:00.000Z',
    )).toThrow('already current');
    expect(() => prepareCinemaRevisionRestore(
      MOCK_CINEMA_PROJECT_DATA,
      'missing-revision',
      'restore-missing-run',
      '2026-09-01T05:00:00.000Z',
    )).toThrow('missing');
  });
});
