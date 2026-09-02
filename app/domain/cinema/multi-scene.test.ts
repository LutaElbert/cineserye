import { describe, expect, it } from 'vitest';
import { applyCanvasCommandProposal } from '../../editor/canvas-commands';
import { applyCinemaDomainCommand } from '../../editor/cinema-domain-commands';
import { initialDocument } from '../../editor/initial-document';
import { fixtureWorkflowDependencies, runCinemaPlanningWorkflow } from '../../server/cinema/workflow';
import { MOCK_CINEMA_PROJECT_DATA, MOCK_SHOT_PLAN_PROPOSAL } from './mock/reel-knows-tomorrow';
import {
  analyzeContinuityImpact,
  buildProjectSequence,
  calculateProjectTotals,
  proposeSceneBoundaries,
  validateMultiSceneData,
} from './multi-scene';
import { acceptCinemaPlanRevision, type CinemaProjectData } from './project-data';
import type { ScenePlanningBrief } from './scene-brief';

function acceptedDocument() {
  const canvas = applyCanvasCommandProposal(initialDocument, MOCK_SHOT_PLAN_PROPOSAL).document;
  return { ...canvas, cinema: structuredClone(MOCK_CINEMA_PROJECT_DATA) };
}

function brief(sceneNodeId: string, text: string): ScenePlanningBrief {
  return {
    version: 2,
    sceneNodeId,
    sceneText: text,
    creationMode: 'ai-generated',
    aspectRatio: '9:16',
    targetPlatform: 'short-form',
    genreTone: 'Grounded suspense',
    locationPeriod: 'Present-day Manila',
    dialogueAudioIntent: 'mixed',
    targetDurationSeconds: 24,
    requiredBeats: ['Arrival', 'Reveal'],
    mustInclude: ['Practical prop'],
    mustAvoid: ['Gore'],
    generationBudget: { pricingMode: 'unpriced', currency: null, ceiling: null, maxAttempts: 2 },
    productionConstraints: { budgetBand: 'micro', currency: 'PHP', budgetCeiling: 20_000, availableEquipment: ['phone camera'] },
  };
}

async function fixturePlan(sceneId: string, text: string) {
  const result = await runCinemaPlanningWorkflow(
    brief(sceneId, text),
    fixtureWorkflowDependencies(() => undefined),
    new AbortController().signal,
    `run-${sceneId}`,
  );
  return result.cinema;
}

describe('Sprint 7 multi-scene project model', () => {
  it('S7-UT-01 migrates a single-scene project into the additive multi-scene structure', () => {
    const legacy = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    delete legacy.multiScene;
    expect(validateMultiSceneData(undefined, legacy)).toEqual({
      version: 1,
      sceneOrder: legacy.sceneOrder,
      sharedEntityVariants: {},
      continuityExceptions: {},
    });
  });

  it('S7-IT-01 proposes treatment boundaries without mutating the accepted document', () => {
    const source = acceptedDocument();
    const before = structuredClone(source);
    const proposals = proposeSceneBoundaries('SCENE 1: Arrival\nMara enters.\n\nSCENE 2: Reveal\nThe screen answers.');
    expect(proposals.map((proposal) => proposal.title)).toEqual(['Arrival', 'Reveal']);
    expect(source).toEqual(before);
    const accepted = applyCinemaDomainCommand(source, {
      type: 'add-scenes',
      scenes: proposals.map((proposal) => ({
        id: `new-${proposal.id}`,
        title: proposal.title,
        synopsis: proposal.synopsis,
        dramaticPurpose: proposal.beatSummary,
      })),
    });
    expect(accepted.cinema?.sceneOrder).toHaveLength(3);
    expect(accepted.nodes.some((node) => node.id === 'new-scene-boundary-2')).toBe(true);
  });

  it('S7-UT-02 preserves explicit scene order, shared usage, scoped variants, and exceptions', () => {
    let document = applyCinemaDomainCommand(acceptedDocument(), {
      type: 'add-scenes',
      scenes: [
        { id: 'scene-02', title: 'Second scene', synopsis: 'The pursuit.', dramaticPurpose: 'Escalate.' },
        { id: 'scene-03', title: 'Third scene', synopsis: 'The choice.', dramaticPurpose: 'Resolve.' },
      ],
    });
    document = applyCinemaDomainCommand(document, { type: 'reorder-scene', sceneId: 'scene-03', toIndex: 1 });
    const entityNodeId = Object.values(document.cinema!.characters)[0].nodeId;
    document = applyCinemaDomainCommand(document, {
      type: 'set-shared-entity-scenes', entityNodeId, sceneIds: ['scene-01', 'scene-02', 'scene-03'],
    });
    document = applyCinemaDomainCommand(document, {
      type: 'upsert-shared-entity-variant',
      variant: {
        id: 'variant-scene-02', entityNodeId, sceneId: 'scene-02', wardrobe: 'Rain coat',
        ageOrCondition: 'Exhausted', timeOfDay: 'Night', locationVariant: 'Exterior', notes: 'Wet continuity',
      },
    });
    document = applyCinemaDomainCommand(document, {
      type: 'add-project-continuity-exception',
      exception: {
        id: 'exception-scene-01', entityNodeId, sceneId: 'scene-01',
        shotIds: [document.cinema!.scenes['scene-01'].shotIds[0]],
        rationale: 'Intentional costume damage after the midpoint.',
      },
    });
    expect(document.cinema?.sceneOrder).toEqual(['scene-01', 'scene-03', 'scene-02']);
    expect(document.cinema?.multiScene?.sharedEntityVariants['variant-scene-02']).toMatchObject({ wardrobe: 'Rain coat' });
    expect(document.cinema?.multiScene?.continuityExceptions['exception-scene-01'].rationale).toContain('Intentional');
  });

  it('S7-IT-02 plans three scenes independently and revising one preserves the others byte-for-byte', async () => {
    let outlinedDocument = applyCinemaDomainCommand(acceptedDocument(), {
      type: 'add-scenes',
      scenes: [
        { id: 'scene-02', title: 'The warning', synopsis: 'A warning arrives.', dramaticPurpose: 'Escalate.' },
        { id: 'scene-03', title: 'The escape', synopsis: 'Mara chooses.', dramaticPurpose: 'Resolve.' },
      ],
    });
    const sharedCharacter = Object.values(outlinedDocument.cinema!.characters)[0];
    outlinedDocument = applyCinemaDomainCommand(outlinedDocument, {
      type: 'set-shared-entity-scenes',
      entityNodeId: sharedCharacter.nodeId,
      sceneIds: ['scene-01', 'scene-02', 'scene-03'],
    });
    const outlined = outlinedDocument.cinema!;
    const firstSceneBefore = structuredClone({
      scene: outlined.scenes['scene-01'],
      shots: Object.fromEntries(outlined.scenes['scene-01'].shotIds.map((shotId) => [shotId, outlined.shots[shotId]])),
      revisions: Object.fromEntries(Object.entries(outlined.revisions).filter(([, revision]) => revision.sceneId === 'scene-01')),
    });
    const secondAccepted = acceptCinemaPlanRevision(outlined, await fixturePlan('scene-02', 'A warning appears on the projector.'), '2026-09-02T03:00:00.000Z');
    const thirdAccepted = acceptCinemaPlanRevision(secondAccepted, await fixturePlan('scene-03', 'Mara exits before the doors close.'), '2026-09-02T04:00:00.000Z');
    expect(thirdAccepted.sceneOrder).toEqual(['scene-01', 'scene-02', 'scene-03']);
    expect(thirdAccepted.sceneOrder.every((sceneId) => thirdAccepted.scenes[sceneId].shotIds.length > 0)).toBe(true);
    expect({
      scene: thirdAccepted.scenes['scene-01'],
      shots: Object.fromEntries(thirdAccepted.scenes['scene-01'].shotIds.map((shotId) => [shotId, thirdAccepted.shots[shotId]])),
      revisions: Object.fromEntries(Object.entries(thirdAccepted.revisions).filter(([, revision]) => revision.sceneId === 'scene-01')),
    }).toEqual(firstSceneBefore);
    expect(Object.values(thirdAccepted.revisions).filter((revision) => revision.status === 'active')).toHaveLength(3);
    expect(Object.values(thirdAccepted.characters).filter((character) => character.title === sharedCharacter.title)).toHaveLength(1);
    expect(thirdAccepted.characters[sharedCharacter.id].sceneIds).toEqual(['scene-01', 'scene-02', 'scene-03']);
    expect(thirdAccepted.scenes['scene-03'].shotIds.some((shotId) => (
      thirdAccepted.shots[shotId].continuityNodeIds.includes(sharedCharacter.nodeId)
    ))).toBe(true);
  });

  it('S7-IT-03 lists every affected scene and shot before a shared continuity change', () => {
    const project = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    const entity = Object.values(project.characters)[0];
    project.scenes['scene-02'] = { ...structuredClone(project.scenes['scene-01']), id: 'scene-02', nodeId: 'scene-02', title: 'Later', shotIds: [] };
    project.sceneOrder.push('scene-02');
    project.multiScene!.sceneOrder.push('scene-02');
    entity.sceneIds.push('scene-02');
    const impact = analyzeContinuityImpact(project, entity.nodeId);
    expect(impact.affectedSceneIds).toEqual(['scene-01', 'scene-02']);
    expect(impact.affectedShotIds.length).toBeGreaterThan(0);
  });

  it('S7-UT-03 project totals equal the sum of scene totals and sequence exposes both orders', () => {
    const project = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    const totals = calculateProjectTotals(project);
    expect(totals.durationSeconds).toBe(Object.values(project.shots).reduce((sum, shot) => sum + shot.durationSeconds, 0));
    expect(totals.shots).toBe(Object.keys(project.shots).length);
    const sequence = buildProjectSequence(project);
    expect(sequence.every((entry) => entry.shotNumber !== null && entry.productionOrder !== null)).toBe(true);
  });

  it('S7-PERF-01 derives a 10-scene, 100-shot, 50-reference overview without reading media blobs', () => {
    const project = structuredClone(MOCK_CINEMA_PROJECT_DATA) as CinemaProjectData;
    const baseScene = project.scenes['scene-01'];
    const baseShot = project.shots[baseScene.shotIds[0]];
    project.scenes = {};
    project.shots = {};
    project.sceneOrder = [];
    project.revisions = {};
    project.visualPreproduction!.references = {};
    for (let sceneIndex = 0; sceneIndex < 10; sceneIndex += 1) {
      const sceneId = `perf-scene-${sceneIndex + 1}`;
      const shotIds = Array.from({ length: 10 }, (_, shotIndex) => `perf-shot-${sceneIndex + 1}-${shotIndex + 1}`);
      project.sceneOrder.push(sceneId);
      project.scenes[sceneId] = { ...structuredClone(baseScene), id: sceneId, nodeId: sceneId, title: `Scene ${sceneIndex + 1}`, shotIds };
      shotIds.forEach((shotId, shotIndex) => { project.shots[shotId] = { ...structuredClone(baseShot), id: shotId, nodeId: shotId, sceneId, order: shotIndex + 1 }; });
    }
    for (let index = 0; index < 50; index += 1) {
      project.visualPreproduction!.references[`ref-${index}`] = {
        id: `ref-${index}`, sceneId: project.sceneOrder[index % 10], title: `Reference ${index}`, type: 'style', origin: 'external-link', mimeType: null,
        width: null, height: null, byteSize: null, blobHash: null, sourceUrl: `https://example.test/${index}`, provenance: 'Performance fixture', rightsStatus: 'unknown',
        allowedUses: ['research'], approvalStatus: 'pending', notes: '', shotIds: [], pinned: false, createdAt: '2026-09-02T00:00:00.000Z',
      };
    }
    const started = performance.now();
    expect(calculateProjectTotals(project)).toMatchObject({ scenes: 10, shots: 100, durationSeconds: baseShot.durationSeconds * 100 });
    expect(buildProjectSequence(project)).toHaveLength(100);
    expect(performance.now() - started).toBeLessThan(100);
  });
});
