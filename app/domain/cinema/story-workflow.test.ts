import { describe, expect, it } from 'vitest';
import { acceptCinemaPlanRevision, createEmptyCinemaProjectData, removeCinemaRecordsForNodes, validateCinemaProjectData } from './project-data';
import { scopeCinemaProjectDataForRun } from './revision-scope';
import { MOCK_CINEMA_PROJECT_DATA } from './mock/reel-knows-tomorrow';
import {
  emptyStoryWorkflow, resolveStoryReferences, reviewStoryReferenceTransfer, reviseStoryReference,
  StoryCreativeBriefSchema, StoryReferenceVersionSchema, storySourceIsStale, updateStoryWorkflow, validateStoryWorkflow,
  reconcileStoryWorkflow, affectedStorySessions, hasUnresolvedStoryOutcome, type StoryReferenceVersion,
} from './story-workflow';

const note = (title = 'Direction'): StoryReferenceVersion => ({ version: 1, title, category: 'style',
  content: { kind: 'note', text: 'Use restrained cinematic lighting.' }, provenance: 'Authored locally',
  rights: 'creator-owned', approval: 'approved', allowedUses: ['story-development'], archived: false });
function sample() {
  const project = structuredClone(MOCK_CINEMA_PROJECT_DATA);
  return updateStoryWorkflow(project, 0, (draft) => {
    draft.references = ['a', 'b', 'c'].map((id) => ({ id, versions: [note(id)] }));
    draft.bindings = [{ owner: { kind: 'story', id: project.projectId }, rules: [{ action: 'add', referenceId: 'a' }] }];
  });
}
const hostIds = (project: ReturnType<typeof sample>) => new Set([
  ...(project.projectNodeId ? [project.projectNodeId] : []), ...Object.values(project.scenes).map((x) => x.nodeId),
  ...Object.values(project.shots).map((x) => x.nodeId), ...Object.values(project.characters).map((x) => x.nodeId),
  ...Object.values(project.assets).map((x) => x.nodeId), ...Object.values(project.agentRuns).map((x) => x.nodeId),
]);
const brief = () => StoryCreativeBriefSchema.parse({ version: 1, mode: 'expand', sourceDigest: 'a'.repeat(64),
  premise: 'An abandoned cinema shows tomorrow.', aspectRatio: '9:16', platform: 'short-form', durationSeconds: 60,
  durationScope: 'whole-story', tone: 'Suspense', ending: 'Ambiguous', constraints: ['No gore'], assumptions: [], status: 'approved', answers: [] });

describe('story foundation — versions and inheritance', () => {
  it.each(['running', 'outcome-unknown', 'cancelled'] as const)('keeps %s outcome and identity after deleting a Continue anchor and reloading', (stage) => {
    let project = sample();
    const anchor = Object.values(project.scenes)[0];
    project = updateStoryWorkflow(project, project.storyWorkflow!.revision, (draft) => {
      draft.briefs.push({ ...brief(), mode: 'continue', durationScope: 'new-material' });
      draft.sessions.push({ id: 'pending', operationId: 'saved-operation', mode: 'continue', anchorSceneId: anchor.id,
        stage, source: { sourceDigest: 'a'.repeat(64), briefVersion: 1, bindingRevision: draft.bindingRevision, references: [] },
        proposals: [], accepted: [], error: null });
    });
    const deleted = removeCinemaRecordsForNodes(project, new Set([anchor.nodeId]), new Set([...hostIds(project)].filter((id) => id !== anchor.nodeId)))!;
    const reloaded = validateCinemaProjectData(JSON.parse(JSON.stringify(deleted)), hostIds(deleted));
    const session = reloaded.storyWorkflow!.sessions[0];
    expect(session.stage).toBe(stage);
    expect(session.operationId).toBe('saved-operation');
    expect(session.anchorSceneId).toBe(anchor.id);
    expect(hasUnresolvedStoryOutcome(session)).toBe(true);
    // A recovered result can be marked creatively stale without erasing its provenance.
    const recovered = structuredClone(reloaded);
    recovered.storyWorkflow!.sessions[0].stage = 'proposal-review';
    expect(reconcileStoryWorkflow(recovered).storyWorkflow!.sessions[0].stage).toBe('stale');
  });
  it('keeps old project format and upgrades only when new data is written', () => {
    const old = createEmptyCinemaProjectData();
    expect(validateCinemaProjectData(old, new Set()).schemaVersion).toBe(2);
    expect(old.storyWorkflow).toBeUndefined();
    const next = updateStoryWorkflow(old, 0, (draft) => { draft.references.push({ id: 'note', versions: [note()] }); });
    expect(next.schemaVersion).toBe(3);
    const first = validateCinemaProjectData(next, new Set());
    expect(validateCinemaProjectData(first, new Set())).toEqual(first);
    expect(old.storyWorkflow).toBeUndefined();
  });
  it.each([1, 2, 4])('rejects silently downgrading or unsupported cinema format %s', (schemaVersion) => {
    const project = sample();
    expect(() => validateCinemaProjectData({ ...project, schemaVersion }, hostIds(project))).toThrow();
  });
  it('rejects unsupported nested data and executable extra fields', () => {
    const project = sample();
    expect(() => validateStoryWorkflow({ ...project.storyWorkflow, version: 2 }, project)).toThrow();
    expect(() => validateStoryWorkflow({ ...project.storyWorkflow, execute: 'fetch(secret)' }, project)).toThrow();
    expect(() => StoryReferenceVersionSchema.parse({ ...note(), content: { kind: 'html', text: '<script/>' } })).toThrow();
  });
  it('inherits story → scene → shot, supports replacement/exclusion and reset', () => {
    let project = sample(); const shot = Object.values(project.shots)[0];
    const target = { kind: 'shot' as const, id: shot.id };
    expect(resolveStoryReferences(project, target).map((x) => x.referenceId)).toEqual(['a']);
    project = updateStoryWorkflow(project, 1, (draft) => {
      draft.bindings.push({ owner: { kind: 'scene', id: shot.sceneId }, rules: [{ action: 'replace', referenceId: 'a', replacementId: 'b' }] });
      draft.bindings.push({ owner: target, rules: [{ action: 'exclude', referenceId: 'b' }, { action: 'add', referenceId: 'c' }] });
    });
    expect(resolveStoryReferences(project, target).map((x) => x.referenceId)).toEqual(['c']);
    expect(resolveStoryReferences(project, target)[0].inheritedFrom).toEqual(target);
    const reset = updateStoryWorkflow(project, 2, (draft) => { draft.bindings = draft.bindings.filter((x) => x.owner.kind !== 'shot'); });
    expect(resolveStoryReferences(reset, target).map((x) => x.referenceId)).toEqual(['b']);
    expect(reset.storyWorkflow!.references).toEqual(project.storyWorkflow!.references);
    expect(resolveStoryReferences(validateCinemaProjectData(reset, hostIds(reset)), target)).toEqual(resolveStoryReferences(reset, target));
  });
  it('rejects dangling owners, unrelated exclusions and duplicate inclusion', () => {
    const project = sample(); const scene = Object.keys(project.scenes)[0];
    expect(() => updateStoryWorkflow(project, 1, (d) => { d.bindings.push({ owner: { kind: 'scene', id: 'missing' }, rules: [] }); })).toThrow(/owner/);
    expect(() => updateStoryWorkflow(project, 1, (d) => { d.bindings.push({ owner: { kind: 'scene', id: scene }, rules: [{ action: 'exclude', referenceId: 'b' }] }); })).toThrow(/inherited/);
    expect(() => updateStoryWorkflow(project, 1, (d) => { d.bindings.push({ owner: { kind: 'scene', id: scene }, rules: [{ action: 'add', referenceId: 'a' }] }); })).toThrow(/already inherited/);
  });
  it('keeps research permission distinct and reports forbidden items without transferring them', () => {
    const project = sample(); const owner = { kind: 'story' as const, id: project.projectId };
    const limits = { maxImages: 8, maxBytes: 20_000, maxNoteCharacters: 20_000 };
    const review = reviewStoryReferenceTransfer(project, owner, 'shot-planning', limits);
    expect(review.included).toEqual([]); expect(review.excluded[0].reason).toContain('Not permitted');
    const changed = reviseStoryReference(project, 1, 'a', { allowedUses: ['research'] });
    expect(reviewStoryReferenceTransfer(changed, owner, 'story-development', limits).included).toEqual([]);
    for (const changes of [{ rights: 'unknown' as const }, { approval: 'revoked' as const }, { archived: true }]) {
      expect(reviewStoryReferenceTransfer(reviseStoryReference(project, 1, 'a', changes), owner, 'story-development', limits).included).toEqual([]);
    }
  });
  it('blocks capacity conflicts without silently trimming the included manifest', () => {
    const project = sample();
    const review = reviewStoryReferenceTransfer(project, { kind: 'story', id: project.projectId }, 'story-development', { maxImages: 0, maxBytes: 0, maxNoteCharacters: 2 });
    expect(review.ready).toBe(false); expect(review.included).toHaveLength(1);
  });
  it('preserves reference history, clears approval after replacement and detects stale revisions', () => {
    let project = sample();
    project = updateStoryWorkflow(project, 1, (d) => { d.briefs.push(brief()); });
    const source = { sourceDigest: 'a'.repeat(64), briefVersion: 1, bindingRevision: project.storyWorkflow!.bindingRevision, references: [{ id: 'a', version: 1 }] };
    expect(storySourceIsStale(project, source, source.sourceDigest)).toBe(false);
    const next = reviseStoryReference(project, 2, 'a', { content: { kind: 'note', text: 'New direction' }, approval: 'approved' });
    expect(next.storyWorkflow!.references[0].versions[0]).toEqual(note('a'));
    expect(next.storyWorkflow!.references[0].versions[1].approval).toBe('pending');
    expect(storySourceIsStale(next, source, source.sourceDigest)).toBe(true);
    expect(() => updateStoryWorkflow(next, 3, (d) => { d.references[0].versions.shift(); })).toThrow(/Historical/);
    expect(() => updateStoryWorkflow(next, 1, () => undefined)).toThrow(/changed/);
  });
  it('enforces continuation duration scope, question bounds and content limits', () => {
    expect(() => StoryCreativeBriefSchema.parse({ ...brief(), mode: 'continue' })).toThrow(/scope/);
    expect(() => StoryCreativeBriefSchema.parse({ ...brief(), answers: Array.from({ length: 5 }, (_, i) => ({ id: `q${i}`, values: [], customText: '' })) })).toThrow();
    expect(() => StoryReferenceVersionSchema.parse({ ...note(), content: { kind: 'note', text: 'a'.repeat(10_001) } })).toThrow();
    expect(() => StoryReferenceVersionSchema.parse({ ...note(), content: { kind: 'image', blobHash: 'a'.repeat(64), mimeType: 'image/png', width: 10_000, height: 10_000, byteSize: 10 } })).toThrow(/pixel/);
  });
  it('reconciles removed owners without deleting library history', () => {
    let project = sample(); const shot = Object.values(project.shots)[0];
    project = updateStoryWorkflow(project, 1, (d) => { d.bindings.push({ owner: { kind: 'shot', id: shot.id }, rules: [{ action: 'exclude', referenceId: 'a' }] }); });
    delete project.shots[shot.id];
    const reconciled = reconcileStoryWorkflow(project);
    expect(reconciled.storyWorkflow!.bindings).toHaveLength(1);
    expect(reconciled.storyWorkflow!.references).toEqual(project.storyWorkflow!.references);
  });
  it('rejects duplicate identities, reserved IDs and mutated historical briefs', () => {
    const project = sample();
    expect(() => updateStoryWorkflow(project, 1, (d) => { d.references.push(d.references[0]); })).toThrow(/Duplicate/);
    expect(() => validateStoryWorkflow({ ...emptyStoryWorkflow(), references: [{ id: '__proto__', versions: [note()] }] }, project)).toThrow();
    const next = updateStoryWorkflow(project, 1, (d) => { d.briefs.push(brief()); });
    expect(() => updateStoryWorkflow(next, 2, (d) => { d.briefs[0].tone = 'Comedy'; })).toThrow(/Historical brief/);
  });
  it('round-trips accepted proposal provenance and reports changes without rewriting it', () => {
    let project = sample();
    project = updateStoryWorkflow(project, 1, (draft) => {
      draft.briefs.push(brief());
      draft.sessions.push({ id: 'session', operationId: 'fixture-operation', mode: 'expand', anchorSceneId: null,
        stage: 'accepted', error: null,
        source: { sourceDigest: 'a'.repeat(64), briefVersion: 1, bindingRevision: draft.bindingRevision, references: [{ id: 'a', version: 1 }] },
        proposals: [{ id: 'proposal', title: 'Arrival', synopsis: 'A visitor enters.', purpose: 'Establish tension', durationSeconds: 15, selected: true }],
        accepted: [{ proposalId: 'proposal', sceneId: Object.keys(project.scenes)[0] }],
      });
    });
    const previous = structuredClone(project.storyWorkflow!.sessions);
    const revised = reviseStoryReference(project, 2, 'a', { archived: true });
    expect(affectedStorySessions(revised, 'a'.repeat(64))).toEqual(['session']);
    expect(validateCinemaProjectData(revised, hostIds(revised)).storyWorkflow!.sessions).toEqual(previous);
    expect(() => updateStoryWorkflow(revised, 3, (d) => { d.sessions[0].proposals[0].durationSeconds = 60; })).toThrow(/cannot be rewritten/);
    expect(() => updateStoryWorkflow(revised, 3, (d) => { d.sessions[0].accepted = []; })).toThrow(/provenance/);
  });
  it('preserves story data through existing shot-plan acceptance and scene-scoped rekeying', () => {
    let project = sample(); const shot = Object.values(project.shots)[0];
    project = updateStoryWorkflow(project, 1, (draft) => { draft.bindings.push({ owner: { kind: 'shot', id: shot.id }, rules: [{ action: 'exclude', referenceId: 'a' }] }); });
    const incoming = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    Object.values(incoming.agentRuns)[0].status = 'ready';
    const accepted = acceptCinemaPlanRevision(project, incoming, '2026-09-06T14:00:00Z');
    expect(accepted.storyWorkflow).toEqual(project.storyWorkflow);
    expect(validateCinemaProjectData(accepted, hostIds(accepted)).schemaVersion).toBe(3);
    const scoped = scopeCinemaProjectDataForRun(project, 'new-run');
    expect(scoped.schemaVersion).toBe(3);
    expect(scoped.storyWorkflow!.bindings.find((item) => item.owner.kind === 'shot')!.owner.id).not.toBe(shot.id);
    expect(scoped.storyWorkflow!.references).toEqual(project.storyWorkflow!.references);
  });
  it('existing layer deletion prunes live bindings but preserves recoverable reference history', () => {
    let project = sample(); const shot = Object.values(project.shots)[0];
    project = updateStoryWorkflow(project, 1, (draft) => { draft.bindings.push({ owner: { kind: 'shot', id: shot.id }, rules: [{ action: 'exclude', referenceId: 'a' }] }); });
    const remaining = hostIds(project); remaining.delete(shot.nodeId);
    const deleted = removeCinemaRecordsForNodes(project, new Set([shot.nodeId]), remaining);
    expect(deleted.storyWorkflow!.bindings).toHaveLength(1);
    expect(deleted.storyWorkflow!.references).toEqual(project.storyWorkflow!.references);
  });
});
