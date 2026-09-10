import { describe, expect, it } from 'vitest';
import { initialDocument } from './initial-document';
import { ensureStoryProject, changeStory, setStorySceneAllocation } from './story-development-commands';
import { buildScopedShotInput, acceptScopedShotPlans, scopedSceneEligibility } from './scoped-shot-commands';
import { fixtureWorkflowDependencies, runCinemaPlanningWorkflow } from '../server/cinema/workflow';
import type { ScopedShotState } from '../domain/cinema/scoped-shot-planning';
import { richTextFromPlainText } from './rich-text';
import { validateEditorDocument } from './document-file';
import { applyCinemaDomainCommand } from './cinema-domain-commands';
import { bindReviewedContinuity, continuityCatalogFromContext, continuityReuseSummary } from '../domain/cinema/continuity-identity';

async function fixture(sceneCount = 1) {
  let document = ensureStoryProject(structuredClone(initialDocument));
  document.cinema!.scenes['scene-01'].brief = { version: 2, creationMode: 'ai-generated', aspectRatio: '9:16', targetPlatform: 'other', genreTone: 'Horror',
    locationPeriod: 'One room', dialogueAudioIntent: 'silent', targetDurationSeconds: 20, requiredBeats: [], mustInclude: ['Everyone survives'], mustAvoid: [],
    generationBudget: { pricingMode: 'unpriced', currency: null, ceiling: null, maxAttempts: 1 }, productionConstraints: { budgetBand: 'micro', currency: 'PHP', budgetCeiling: null, availableEquipment: [] } };
  const host = document.nodes.find((node) => node.id === 'scene-01')!;
  if (host.data.kind === 'concept') host.data.body = richTextFromPlainText('Friends escape a cursed board game.');
  if (sceneCount === 2) {
    document = applyCinemaDomainCommand(document, { type: 'add-scenes', scenes: [{ id: 'scene-02', title: 'The final turn', synopsis: 'The friends choose to escape together.', dramaticPurpose: 'Resolution' }] });
    document.cinema!.scenes['scene-02'].brief = structuredClone(document.cinema!.scenes['scene-01'].brief);
  }
  const input = await buildScopedShotInput(document, document.cinema!.sceneOrder);
  const jobs: ScopedShotState['jobs'] = await Promise.all(input.scenes.map(async (scene) => {
    const runId = crypto.randomUUID();
    const result = await runCinemaPlanningWorkflow(scene.brief, fixtureWorkflowDependencies(() => {}), new AbortController().signal, runId, scene.planningContext);
    return { sceneId: scene.sceneId, title: scene.title, runId, sourceDigest: scene.sourceDigest, status: 'ready' as const, result, error: null };
  }));
  const state: ScopedShotState = { version: 1, requestId: crypto.randomUUID(), projectId: input.projectId, input, inputDigest: 'a'.repeat(64), quoteId: 'b'.repeat(64),
    mode: 'fixture', model: 'fixture-planner-v1', estimatedCost: 0, actualCost: null, status: 'review', acceptedSceneIds: [],
    jobs };
  return { state, document: changeStory(document, (workflow) => { workflow.shotPlanning = state; }) };
}
describe('scoped shot acceptance', () => {
  it('ignores canvas selection and keeps every original node position/text unchanged', async () => {
    const { state, document } = await fixture(); const original = structuredClone(document);
    const accepted = await acceptScopedShotPlans(document, state, ['scene-01']);
    expect(document).toEqual(original);
    for (const node of document.nodes) expect(accepted.nodes.find((value) => value.id === node.id)).toEqual(node);
    expect(accepted.cinema?.scenes['scene-01'].shotIds).toHaveLength(6);
    expect(accepted.cinema?.storyWorkflow?.shotPlanning?.acceptedSceneIds).toEqual(['scene-01']);
    expect(validateEditorDocument(accepted)).toEqual(accepted);
    await expect(acceptScopedShotPlans(accepted, accepted.cinema!.storyWorkflow!.shotPlanning!, ['scene-01'])).rejects.toThrow(/already accepted/);
  });
  it('rejects locked or stale scope without mutation', async () => {
    const { state, document } = await fixture();
    document.nodes.find((node) => node.id === 'scene-01')!.data.locked = true;
    expect(scopedSceneEligibility(document, 'scene-01')).toMatch(/Unlock/);
    await expect(acceptScopedShotPlans(document, state, ['scene-01'])).rejects.toThrow(/Unlock/);
    document.nodes.find((node) => node.id === 'scene-01')!.data.locked = false;
    document.cinema!.scenes['scene-01'].brief!.targetDurationSeconds = 30;
    await expect(acceptScopedShotPlans(document, state, ['scene-01'])).rejects.toThrow(/changed/);
  });
  it('uses an explicit manual allocation even without generated direction or a scene brief', async () => {
    const manual = ensureStoryProject(structuredClone(initialDocument));
    const host = manual.nodes.find((node) => node.id === 'scene-01')!;
    if (host.data.kind === 'concept') host.data.body = richTextFromPlainText('Four friends discover that the board game controls their room.');
    expect(scopedSceneEligibility(manual, 'scene-01')).toMatch(/Allocate/);
    const allocated = setStorySceneAllocation(manual, 'scene-01', 30);
    expect(scopedSceneEligibility(allocated, 'scene-01')).toBeNull();
    expect((await buildScopedShotInput(allocated, ['scene-01'])).scenes[0].brief.targetDurationSeconds).toBe(30);
    allocated.cinema!.scenes['scene-01'].brief = (await fixture()).document.cinema!.scenes['scene-01'].brief;
    expect((await buildScopedShotInput(allocated, ['scene-01'])).scenes[0].brief.targetDurationSeconds).toBe(30);
  });
  it('invalidates an approved scoped request after an explicit allocation change', async () => {
    const { state, document } = await fixture();
    const edited = setStorySceneAllocation(document, 'scene-01', 25);
    await expect(acceptScopedShotPlans(edited, state, ['scene-01'])).rejects.toThrow(/changed/);
  });
  it('invalidates cross-scene context when an unselected sibling changes', async () => {
    const { state, document } = await fixture(2);
    const host = document.nodes.find((node) => node.id === 'scene-02')!;
    if (host.data.kind === 'concept') host.data.body = richTextFromPlainText('A different ending with only one survivor.');
    await expect(acceptScopedShotPlans(document, state, ['scene-01'])).rejects.toThrow(/changed/);
  });
  it('permits later acceptance of a ready sibling without invalidating on its own new continuity entities', async () => {
    const { state, document } = await fixture(2);
    const first = await acceptScopedShotPlans(document, state, ['scene-01']);
    expect(Object.keys(first.cinema!.characters).length).toBeGreaterThan(0);
    const second = await acceptScopedShotPlans(first, first.cinema!.storyWorkflow!.shotPlanning!, ['scene-02']);
    // Both fixture scenes use the title Mara, but have no explicit shared binding.
    expect(Object.values(second.cinema!.characters)).toHaveLength(2);
    expect(new Set(Object.values(second.cinema!.characters).map((item) => item.title)).size).toBe(1);
    expect(second.cinema!.storyWorkflow!.shotPlanning!.acceptedSceneIds).toEqual(['scene-01', 'scene-02']);
    expect(second.cinema!.scenes['scene-01'].shotIds).toEqual(first.cinema!.scenes['scene-01'].shotIds);
    for (const id of first.cinema!.scenes['scene-01'].shotIds) expect(second.cinema!.shots[id]).toEqual(first.cinema!.shots[id]);
  });
  it('invalidates an edit to a reviewed existing continuity entity', async () => {
    const initial = await fixture(2);
    const first = await acceptScopedShotPlans(initial.document, initial.state, ['scene-01']);
    const input = await buildScopedShotInput(first, ['scene-02']);
    const state = { ...initial.state, input, jobs: [initial.state.jobs[1]], acceptedSceneIds: [] };
    state.jobs[0] = { ...state.jobs[0], sourceDigest: input.scenes[0].sourceDigest };
    const current = changeStory(first, (workflow) => { workflow.shotPlanning = state; });
    Object.values(current.cinema!.characters)[0].title = 'An unrelated replacement identity';
    await expect(acceptScopedShotPlans(current, state, ['scene-02'])).rejects.toThrow(/changed/);
  });
  it('reuses exact locked character/prop identities across separately accepted siblings without mutating their hosts or references', async () => {
    const seed = await fixture(2);
    let current = await acceptScopedShotPlans(seed.document, seed.state, ['scene-01']);
    current = applyCinemaDomainCommand(current, { type: 'add-scenes', scenes: [{ id: 'scene-03', title: 'The return', synopsis: 'The same friends return.', dramaticPurpose: 'Epilogue' }] });
    current.cinema!.scenes['scene-03'].brief = structuredClone(current.cinema!.scenes['scene-02'].brief);
    const character = Object.values(current.cinema!.characters)[0];
    const asset = Object.values(current.cinema!.assets).find((item) => item.category === 'prop')!;
    asset.uri = 'https://example.test/user-approved-reference.png'; asset.source = 'external';
    const originalHosts = current.nodes.filter((node) => [character.nodeId, asset.nodeId].includes(node.id));
    expect(originalHosts.every((node) => node.data.locked)).toBe(true);
    const originalRecords = structuredClone({ character, asset, media: current.cinema!.visualPreproduction,
      prompts: Object.values(current.cinema!.prompts).filter((prompt) => [character.nodeId, asset.nodeId].includes(prompt.ownerNodeId)) });
    const input = await buildScopedShotInput(current, ['scene-02', 'scene-03']);
    const jobs: ScopedShotState['jobs'] = await Promise.all(input.scenes.map(async (scope) => {
      const runId = crypto.randomUUID();
      const result = await runCinemaPlanningWorkflow(scope.brief, fixtureWorkflowDependencies(() => {}), new AbortController().signal, runId, scope.planningContext);
      const catalog = continuityCatalogFromContext(scope.planningContext);
      Object.values(result.cinema.characters)[0].continuityBinding = bindReviewedContinuity(catalog, 'character', character.id);
      Object.values(result.cinema.assets).find((item) => item.category === 'prop')!.continuityBinding = bindReviewedContinuity(catalog, 'asset', asset.id, 'prop');
      expect(continuityReuseSummary(result.cinema).reused).toHaveLength(2);
      return { sceneId: scope.sceneId, title: scope.title, runId, sourceDigest: scope.sourceDigest, status: 'ready', result, error: null };
    }));
    const state = { ...seed.state, requestId: crypto.randomUUID(), input, jobs, acceptedSceneIds: [] };
    current = changeStory(current, (workflow) => { workflow.shotPlanning = state; });
    const first = await acceptScopedShotPlans(current, state, ['scene-02']);
    const second = await acceptScopedShotPlans(first, first.cinema!.storyWorkflow!.shotPlanning!, ['scene-03']);
    for (const host of originalHosts) expect(second.nodes.find((node) => node.id === host.id)).toEqual(host);
    expect(second.cinema!.characters[character.id]).toEqual({ ...originalRecords.character, sceneIds: ['scene-01', 'scene-02', 'scene-03'] });
    expect(second.cinema!.assets[asset.id]).toEqual({ ...originalRecords.asset, sceneIds: ['scene-01', 'scene-02', 'scene-03'] });
    expect(second.cinema!.visualPreproduction).toEqual(originalRecords.media);
    expect(Object.values(second.cinema!.prompts).filter((prompt) => [character.nodeId, asset.nodeId].includes(prompt.ownerNodeId))).toEqual(originalRecords.prompts);
    expect(Object.values(second.cinema!.characters)).toHaveLength(1);
    for (const sceneId of ['scene-02', 'scene-03']) {
      expect(second.cinema!.scenes[sceneId].shotIds.some((id) => second.cinema!.shots[id].continuityNodeIds.includes(character.nodeId))).toBe(true);
      expect(second.edges.some((edge) => edge.source === sceneId && edge.target === character.nodeId)).toBe(true);
    }
    expect(validateEditorDocument(second)).toEqual(second);
  });
  it('invalidates reuse approval after locking or editing the reviewed canonical host, while dragging remains allowed', async () => {
    const seed = await fixture(2);
    const first = await acceptScopedShotPlans(seed.document, seed.state, ['scene-01']);
    const input = await buildScopedShotInput(first, ['scene-02']);
    const state = { ...seed.state, input, jobs: [{ ...seed.state.jobs[1], sourceDigest: input.scenes[0].sourceDigest }], acceptedSceneIds: [] };
    const current = changeStory(first, (workflow) => { workflow.shotPlanning = state; });
    const entity = Object.values(current.cinema!.characters)[0];
    const host = current.nodes.find((node) => node.id === entity.nodeId)!;
    host.position.x += 30;
    await expect(acceptScopedShotPlans(current, state, ['scene-02'])).resolves.toBeDefined();
    host.data.locked = !host.data.locked;
    await expect(acceptScopedShotPlans(current, state, ['scene-02'])).rejects.toThrow(/changed/);
  });
});
