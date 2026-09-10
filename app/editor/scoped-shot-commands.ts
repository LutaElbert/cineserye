import { requestDigest } from '../domain/cinema/request-digest';
import { reviewStoryReferenceTransfer } from '../domain/cinema/story-workflow';
import { storyGenreTone } from '../domain/cinema/story-genres';
import { validateScenePlanningBrief } from '../domain/cinema/scene-brief';
import { acceptCinemaPlanRevision } from '../domain/cinema/project-data';
import { ScopedShotInputSchema, validateScopedPlan, scopedPlanMatchesInput, type ScopedShotState } from '../domain/cinema/scoped-shot-planning';
import { changeStory, inheritedStoryDirection, storyPremise, storySceneContext, storySceneAllocation } from './story-development-commands';
import { richTextToPlainText } from './rich-text';
import { applyCanvasCommandProposal } from './canvas-commands';
import { prepareCinemaPlanProposal, cinemaProposalCanvasSource, layoutCinemaProposalNodes, compileCinemaCanvasProposal } from './cinema-plan-proposal';
import { validateEditorDocument } from './document-file';
import { avoidAssistantOverlap } from './story-assistant-projection';
import type { EditorDocument } from './types';
import { buildContinuityCatalog, continuityCatalogFromContext, continuityEntityIdentity, resolveContinuityBindings } from '../domain/cinema/continuity-identity';

export function scopedSceneEligibility(document: EditorDocument, sceneId: string): string | null {
  const scene = document.cinema?.scenes[sceneId];
  const host = document.nodes.find((node) => node.id === scene?.nodeId);
  if (!scene || !host || host.data.kind !== 'concept') return 'Scene is no longer available.';
  const premise = document.nodes.find((node) => node.id === storyPremise(document)?.nodeId);
  if (host.data.locked || premise?.data.locked) return 'Unlock this scene and its Story first.';
  const duration = storySceneAllocation(document, sceneId);
  if (duration === null || duration < 6 || duration > 180) return `Allocate 6–180 seconds in the scene first${duration !== null ? ` (currently ${duration}s)` : ''}.`;
  // Replacing an accepted plan is possible only with its locked hosts explicitly unlocked.
  const owned = [...Object.values(document.cinema!.shots).filter((item) => item.sceneId === sceneId),
    ...Object.values(document.cinema!.agentRuns).filter((item) => item.sceneId === sceneId),
    ...Object.values(document.cinema!.characters).filter((item) => item.sceneIds.length === 1 && item.sceneIds[0] === sceneId),
    ...Object.values(document.cinema!.assets).filter((item) => item.sceneIds.length === 1 && item.sceneIds[0] === sceneId)];
  if (owned.some((item) => document.nodes.find((node) => node.id === item.nodeId)?.data.locked)) return 'Unlock the existing plan layers before requesting a replacement.';
  return null;
}
export function scopedSceneIdentity(document: EditorDocument, sceneId: string, continuityIds?: readonly string[]) {
  const cinema = document.cinema!, scene = cinema.scenes[sceneId];
  const node = document.nodes.find((item) => item.id === scene?.nodeId);
  const direction = inheritedStoryDirection(document, sceneId);
  const entities = [...Object.values(cinema.characters), ...Object.values(cinema.assets)];
  // Frozen input IDs exclude only entities produced by this planning batch.
  // Every reviewed existing entity remains checked, including deletion.
  const continuity = (continuityIds ?? entities.map((item) => item.id)).map((id) => {
    const entity = entities.find((item) => item.id === id);
    // Keep reviewed identity/lock changes observable, but do not invalidate a
    // sibling because this batch added a scene membership or the user panned it.
    return entity ? { id, identity: continuityEntityIdentity(entity), host: document.nodes.find((host) => host.id === entity.nodeId)?.data ?? null } : { id, missing: true };
  });
  return { projectId: cinema.projectId, premise: storyPremise(document), sceneId,
    host: node?.data, brief: scene?.brief, shotIds: scene?.shotIds, direction, allocation: storySceneAllocation(document, sceneId),
    storyScenes: storySceneContext(document), continuity,
    activeRevision: Object.values(cinema.revisions).find((item) => item.sceneId === sceneId && item.status === 'active')?.id ?? null,
    // Reference rights/version changes invalidate approval even if labels stay unchanged.
    references: cinema.storyWorkflow?.references ?? [], bindings: cinema.storyWorkflow?.bindings ?? [] };
}
export async function buildScopedShotInput(document: EditorDocument, sceneIds: string[]) {
  if (!document.cinema || !storyPremise(document)) throw Error('A Story project is required.');
  const cinema = document.cinema;
  const continuityIds = [...Object.keys(cinema.characters), ...Object.keys(cinema.assets)];
  const scenes = await Promise.all(sceneIds.map(async (sceneId) => {
    const reason = scopedSceneEligibility(document, sceneId); if (reason) throw Error(reason);
    const scene = cinema.scenes[sceneId], node = document.nodes.find((item) => item.id === scene.nodeId)!;
    if (node.data.kind !== 'concept') throw Error('Only scenes can be planned.');
    const inherited = inheritedStoryDirection(document, sceneId), existing = scene.brief;
    const manifest = reviewStoryReferenceTransfer(cinema, { kind: 'scene', id: sceneId }, 'shot-planning', { maxImages: 8, maxBytes: 12 * 1024 * 1024, maxNoteCharacters: 10000 });
    if (!manifest.ready) throw Error(manifest.blockers.join(' '));
    const context = { story: storyPremise(document), scenes: storySceneContext(document),
      confirmedDirection: inherited?.brief ?? null,
      continuity: [...Object.values(cinema.characters), ...Object.values(cinema.assets)].map((item) => ({ id: item.id, title: item.title, sceneIds: item.sceneIds })),
      continuityCatalog: buildContinuityCatalog(cinema),
      references: manifest.included.filter((item) => item.current.content.kind === 'note').map((item) => ({ id: item.referenceId, version: item.current.version, title: item.current.title, content: item.current.content })) };
    const brief = validateScenePlanningBrief({
      version: 2, sceneNodeId: scene.nodeId,
      sceneText: richTextToPlainText(node.data.body).trim() || scene.synopsis || node.data.label,
      creationMode: existing?.creationMode ?? 'ai-generated', aspectRatio: existing?.aspectRatio ?? inherited?.brief.aspectRatio ?? '9:16',
      targetPlatform: existing?.targetPlatform ?? inherited?.brief.platform ?? 'other', genreTone: existing?.genreTone ?? (inherited ? storyGenreTone(inherited.brief) : 'Follow the scene'),
      locationPeriod: existing?.locationPeriod ?? 'Keep the story setting consistent; propose unspecified details explicitly.',
      dialogueAudioIntent: existing?.dialogueAudioIntent ?? (inherited?.brief.constraints.some((item) => /no dialogue/i.test(item)) ? 'sound-design-led' : 'mixed'),
      targetDurationSeconds: storySceneAllocation(document, sceneId),
      requiredBeats: existing?.requiredBeats ?? [], mustInclude: existing?.mustInclude ?? inherited?.brief.constraints ?? [], mustAvoid: existing?.mustAvoid ?? [],
      generationBudget: existing?.generationBudget ?? { pricingMode: 'unpriced', currency: null, ceiling: null, maxAttempts: 1 },
      productionConstraints: existing?.productionConstraints ?? { budgetBand: 'micro', currency: 'PHP', budgetCeiling: null, availableEquipment: [] },
    });
    return { sceneId, title: node.data.label, sourceDigest: await requestDigest(scopedSceneIdentity(document, sceneId, continuityIds)), brief,
      planningContext: JSON.stringify(context), continuityIds };
  }));
  return ScopedShotInputSchema.parse({ version: 1, projectId: cinema.projectId, premiseNodeId: storyPremise(document)!.nodeId, scenes });
}

/** Build the whole selected acceptance in a clone. Caller commits once after all
 * validation succeeds, so a later-scene failure leaves the canvas untouched. */
export async function acceptScopedShotPlans(document: EditorDocument, state: ScopedShotState, sceneIds: string[]): Promise<EditorDocument> {
  if (document.cinema?.projectId !== state.projectId || !sceneIds.length || new Set(sceneIds).size !== sceneIds.length) throw Error('Invalid acceptance scope.');
  for (const sceneId of sceneIds) {
    const job = state.jobs.find((item) => item.sceneId === sceneId);
    if (!job || !job.result || job.status !== 'ready' || state.acceptedSceneIds.includes(sceneId)) throw Error('This scene proposal is unavailable or already accepted.');
    const reason = scopedSceneEligibility(document, sceneId); if (reason) throw Error(reason);
    if (await requestDigest(scopedSceneIdentity(document, sceneId, state.input.scenes.find((item) => item.sceneId === sceneId)?.continuityIds)) !== job.sourceDigest) throw Error('Scene context changed. Review a new scoped plan.');
  }
  let next = structuredClone(document);
  for (const sceneId of sceneIds) {
    const job = state.jobs.find((item) => item.sceneId === sceneId)!;
    const result = validateScopedPlan(job.result);
    const input = state.input.scenes.find((item) => item.sceneId === sceneId);
    if (!input || !scopedPlanMatchesInput(result, input, state.mode, job.runId)) throw Error('Provider result does not match the reviewed duration, aspect or scope.');
    const scene = next.cinema!.scenes[sceneId];
    if (result.cinema.activeSceneId !== scene.id || result.cinema.scenes[scene.id]?.nodeId !== scene.nodeId) throw Error('Provider result targets the wrong scene.');
    const current = { ...next.cinema!, activeSceneId: sceneId };
    const continuityRemap = resolveContinuityBindings(current, result.cinema, continuityCatalogFromContext(input.planningContext));
    const reusedHosts = new Set(continuityRemap.values());
    // Recompile validated domain data locally. Never execute a stored/raw model
    // command list; omit the legacy compiler's Story text/position update.
    const compiled = compileCinemaCanvasProposal(result.runId, result.cinema);
    compiled.commands = compiled.commands.filter((command) => !(command.type === 'update-node' && command.id === result.cinema.projectNodeId));
    const prepared = prepareCinemaPlanProposal(next, current, compiled);
    prepared.commands = prepared.commands.map((command) => command.type === 'delete-nodes'
      ? { ...command, ids: command.ids.filter((id) => !reusedHosts.has(id)) } : command)
      .filter((command) => command.type !== 'delete-nodes' || command.ids.length > 0);
    // The provider's command list cannot alter siblings, manual nodes, or the Story.
    const source = { ...next, cinema: current };
    const previousIds = new Set(next.nodes.map((node) => node.id));
    const allowedUpdates = new Set([scene.nodeId]);
    if (prepared.commands.some((command) => command.type === 'update-node' && previousIds.has(command.id) && !allowedUpdates.has(command.id))) throw Error('Proposal attempted to change an unrelated layer.');
    const applied = applyCanvasCommandProposal(cinemaProposalCanvasSource(source), prepared);
    const cinema = acceptCinemaPlanRevision(next.cinema, result.cinema, new Date().toISOString());
    // Stable scene text and ID remain user-owned; accepted plan gets its brief.
    cinema.scenes[sceneId].title = scene.title; cinema.scenes[sceneId].synopsis = scene.synopsis;
    const referenced = new Set([cinema.projectNodeId, ...Object.values(cinema.scenes).map((item) => item.nodeId), ...Object.values(cinema.shots).map((item) => item.nodeId),
      ...Object.values(cinema.characters).map((item) => item.nodeId), ...Object.values(cinema.assets).map((item) => item.nodeId), ...Object.values(cinema.agentRuns).map((item) => item.nodeId)]);
    const orphaned = new Set(applied.affectedNodeIds.filter((id) => !referenced.has(id) && !previousIds.has(id)));
    const laidOut = layoutCinemaProposalNodes(applied.document.nodes.filter((node) => !orphaned.has(node.id)), result.cinema);
    const nodes = laidOut.map((node) => previousIds.has(node.id) ? next.nodes.find((old) => old.id === node.id) ?? node : node);
    const preserved = nodes.filter((node) => previousIds.has(node.id));
    for (const node of nodes.filter((node) => !previousIds.has(node.id))) {
      node.position = avoidAssistantOverlap({ ...next, nodes: preserved }, node, node.position);
      preserved.push(node);
    }
    const edges = applied.document.edges.map((edge) => ({ ...edge,
      source: continuityRemap.get(edge.source) ?? edge.source, target: continuityRemap.get(edge.target) ?? edge.target,
    })).filter((edge) => !orphaned.has(edge.source) && !orphaned.has(edge.target));
    next = validateEditorDocument({ ...next, cinema, nodes, edges });
  }
  return changeStory(next, (workflow) => {
    if (workflow.shotPlanning?.requestId !== state.requestId) throw Error('The active shot review changed.');
    workflow.shotPlanning.acceptedSceneIds = [...new Set([...state.acceptedSceneIds, ...sceneIds])];
  });
}
