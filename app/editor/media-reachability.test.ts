import { describe, expect, it } from 'vitest';
import { MOCK_CINEMA_PROJECT_DATA } from '../domain/cinema/mock/reel-knows-tomorrow';
import { collectMediaHashes, unreferencedMediaHashes } from './media-reachability';
import type { CinemaReferenceRecord } from '../domain/cinema/visual-preproduction';

function root(hash: string) {
  const cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);
  // The traversal deliberately needs only the content pointer, not policy eligibility.
  cinema.visualPreproduction!.references = { ref: { blobHash: hash } as CinemaReferenceRecord };
  return { cinema };
}

describe('SAFE-07 recovery media reachability', () => {
  it('preserves references in every supplied history, checkpoint, pending and recovery root', () => {
    const roots = ['current', 'undo', 'redo', 'checkpoint', 'pending', 'recovery', 'inflight'].map(root);
    expect([...collectMediaHashes(roots)]).toHaveLength(7);
    expect(unreferencedMediaHashes(['undo', 'recovery', 'pending', 'orphan'], roots)).toEqual(['orphan']);
  });
  it('rechecks candidates after confirmation, protecting a newly attached existing blob', () => {
    const candidates = unreferencedMediaHashes(['orphan', 'newly-used'], [root('current')]);
    expect(unreferencedMediaHashes(candidates, [root('current'), root('newly-used')])).toEqual(['orphan']);
  });
  it('retains revoked or archived references regardless of generation eligibility', () => {
    expect(unreferencedMediaHashes(['protected'], [null, undefined, root('protected')])).toEqual([]);
  });
});
