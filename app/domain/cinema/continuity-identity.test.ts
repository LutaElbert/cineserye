import { describe, expect, it } from 'vitest';
import { bindReviewedContinuity, buildContinuityCatalog, continuityCatalogFromContext, continuityEntityIdentity, continuityReuseSummary, resolveContinuityBindings, validatePlanContinuityCatalog } from './continuity-identity';
import { MOCK_CINEMA_PROJECT_DATA } from './mock/reel-knows-tomorrow';
import { scopeCinemaProjectDataForRun } from './revision-scope';
import { acceptCinemaPlanRevision } from './project-data';

describe('explicit reviewed continuity identity', () => {
  it('never treats equal titles as the same character or prop', () => {
    const current = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    const incoming = scopeCinemaProjectDataForRun(current, 'new-independent-identity');
    expect(resolveContinuityBindings(current, incoming).size).toBe(0);
    expect(continuityReuseSummary(incoming).reused).toEqual([]);
    expect(continuityReuseSummary(incoming).newEntities).toHaveLength(Object.keys(incoming.characters).length + Object.keys(incoming.assets).length);
  });
  it('uses exact IDs even when two reviewed characters have the same title', () => {
    const current = structuredClone(MOCK_CINEMA_PROJECT_DATA), original = Object.values(current.characters)[0];
    current.characters['different-person'] = { ...original, id: 'different-person', nodeId: 'different-person', appearanceReference: 'An unrelated person' };
    const catalog = buildContinuityCatalog(current);
    const binding = bindReviewedContinuity(catalog, 'character', 'different-person')!;
    expect(binding.entityId).toBe('different-person');
    expect(binding.sourceIdentity).toContain('An unrelated person');
    expect(() => bindReviewedContinuity(catalog, 'character', original.title)).toThrow(/unknown/);
  });
  it('rejects unknown IDs, wrong kinds/categories, and duplicate target bindings', () => {
    const current = structuredClone(MOCK_CINEMA_PROJECT_DATA), catalog = buildContinuityCatalog(current);
    const character = Object.values(current.characters)[0], asset = Object.values(current.assets)[0];
    expect(() => bindReviewedContinuity(catalog, 'character', asset.id)).toThrow(/incompatible/);
    expect(() => bindReviewedContinuity(catalog, 'asset', asset.id, asset.category === 'prop' ? 'location' : 'prop')).toThrow(/incompatible/);
    const incoming = scopeCinemaProjectDataForRun(current, 'duplicate-binding');
    const proposed = Object.values(incoming.characters)[0];
    proposed.continuityBinding = bindReviewedContinuity(catalog, 'character', character.id);
    incoming.characters['duplicate-proposal'] = { ...proposed, id: 'duplicate-proposal', nodeId: 'duplicate-proposal' };
    expect(() => validatePlanContinuityCatalog(incoming, catalog)).toThrow(/duplicated/);
  });
  it('preserves canonical binding IDs through generated run remapping and migration', () => {
    const current = structuredClone(MOCK_CINEMA_PROJECT_DATA), character = Object.values(current.characters)[0];
    const proposed = structuredClone(current);
    Object.values(proposed.characters)[0].continuityBinding = bindReviewedContinuity(buildContinuityCatalog(current), 'character', character.id);
    const scoped = scopeCinemaProjectDataForRun(proposed, 'independent-run');
    const after = Object.values(scoped.characters)[0];
    expect(after.id).not.toBe(character.id);
    expect(after.continuityBinding).toMatchObject({ entityId: character.id, nodeId: character.nodeId });
    expect(resolveContinuityBindings(current, scoped).get(after.nodeId)).toBe(character.nodeId);
  });
  it('does not stale on additive scene membership, but detects identity changes', () => {
    const current = structuredClone(MOCK_CINEMA_PROJECT_DATA), character = Object.values(current.characters)[0];
    const before = continuityEntityIdentity(character);
    character.sceneIds.push('new-scene');
    expect(continuityEntityIdentity(character)).toBe(before);
    character.wardrobeNotes += ' A different costume.';
    expect(continuityEntityIdentity(character)).not.toBe(before);
  });
  it('legacy manual text grants no implicit reuse and invalid explicit catalogs fail closed', () => {
    expect(continuityCatalogFromContext('Use Mara again')).toEqual({ version: 1, entities: [] });
    expect(continuityCatalogFromContext('{"continuity":[{"id":"mara"}]}').entities).toEqual([]);
    expect(() => continuityCatalogFromContext('{"continuityCatalog":{"version":9}}')).toThrow();
  });
  it('keeps existing reference source plans intact instead of silently replacing their media identity', () => {
    const current = structuredClone(MOCK_CINEMA_PROJECT_DATA), character = Object.values(current.characters)[0];
    const proposed = scopeCinemaProjectDataForRun(current, 'replace-source');
    Object.values(proposed.characters)[0].continuityBinding = bindReviewedContinuity(buildContinuityCatalog(current), 'character', character.id);
    Object.values(proposed.agentRuns).forEach((run) => { run.status = 'ready'; });
    expect(() => acceptCinemaPlanRevision(current, proposed, new Date().toISOString())).toThrow(/source plan/);
  });
});
