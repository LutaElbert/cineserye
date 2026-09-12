import { canonicalRequest, requestDigest } from '../domain/cinema/request-digest';
import { updateStoryWorkflow, storySourceIsStale, hasUnresolvedStoryOutcome, type StoryWorkflowData } from '../domain/cinema/story-workflow';
import { applyCinemaDomainCommand } from './cinema-domain-commands';
import { planCinemaDraftInsertion } from './cinema-workspace-placement';
import { validateEditorDocument } from './document-file';
import { conceptTitleFromPlainText, richTextFromPlainText, richTextToPlainText } from './rich-text';
import type { EditorDocument } from './types';
import { createEmptyCinemaProjectData } from '../domain/cinema/project-data';
import { avoidAssistantOverlap } from './story-assistant-projection';

export function ensureStoryProject(document: EditorDocument): EditorDocument {
  const premise = storyPremise(document);
  if (!premise) throw Error('Create a story premise first.');
  const mappedNodes = new Set(Object.values(document.cinema?.scenes ?? {}).map((scene) => scene.nodeId));
  const missing = document.nodes.filter((node) => node.data.kind === 'concept'
    && node.data.domainType === 'cinema.scene' && !mappedNodes.has(node.id));
  if (document.cinema && !missing.length) return document;
  const cinema = document.cinema ? structuredClone(document.cinema) : createEmptyCinemaProjectData(crypto.randomUUID());
  cinema.projectNodeId ??= premise.nodeId;
  for (const node of missing) if (node.data.kind === 'concept') {
    if (cinema.scenes[node.id]) throw Error('A manual scene conflicts with an existing scene id. Restore unique layer ids first.');
    cinema.scenes[node.id] = { id: node.id, nodeId: node.id, title: node.data.label,
      synopsis: richTextToPlainText(node.data.body), dramaticPurpose: '', status: 'draft', continuityNotes: '', brief: null, shotIds: [] };
    cinema.sceneOrder.push(node.id);
  }
  if (cinema.multiScene) cinema.multiScene.sceneOrder = [...cinema.sceneOrder];
  return validateEditorDocument({ ...document, cinema });
}

/** Read the visible draft text without rewriting accepted scene/revision records. */
export function storySceneContext(document: EditorDocument, excludeSceneIds: readonly string[] = []) {
  const mapped = (document.cinema?.sceneOrder ?? []).map((id) => {
    const scene = document.cinema!.scenes[id];
    const host = document.nodes.find((node) => node.id === scene.nodeId);
    return { id, title: host?.data.kind === 'concept' ? host.data.label : scene.title,
      synopsis: host?.data.kind === 'concept' ? richTextToPlainText(host.data.body) : scene.synopsis };
  });
  const mappedNodes = new Set(Object.values(document.cinema?.scenes ?? {}).map((scene) => scene.nodeId));
  for (const node of document.nodes) if (node.data.kind === 'concept' && node.data.domainType === 'cinema.scene' && !mappedNodes.has(node.id)) {
    mapped.push({ id: node.id, title: node.data.label, synopsis: richTextToPlainText(node.data.body) });
  }
  return mapped.filter((scene) => !excludeSceneIds.includes(scene.id));
}

export function inheritedStoryDirection(document: EditorDocument, sceneId: string) {
  const workflow = document.cinema?.storyWorkflow;
  const session = workflow?.sessions.find((item) => item.accepted.some((mapping) => mapping.sceneId === sceneId));
  const mapping = session?.accepted.find((item) => item.sceneId === sceneId);
  const proposal = session?.proposals.find((item) => item.id === mapping?.proposalId);
  const brief = session && workflow?.briefs[session.source.briefVersion - 1];
  return brief && proposal ? { brief, allocation: storySceneAllocation(document, sceneId) ?? proposal.durationSeconds } : null;
}

export function storyPremise(document: EditorDocument) {
  const owner = document.cinema?.projectNodeId ?? document.cinema?.storyWorkflow?.assistant?.premiseNodeId;
  const node = document.nodes.find((node) => (!owner || node.id === owner) && node.data.kind === 'concept' && node.data.domainType === 'cinema.story');
  return node?.data.kind === 'concept' ? { nodeId: node.id, title: node.data.label, text: richTextToPlainText(node.data.body) } : null;
}
/** Semantic identity excludes geometry and locks: accepting or dragging a card
 * cannot invalidate its own run, but editing/deleting accepted content can. */
export function storySceneIdentity(document: EditorDocument, sceneId: string, allocationOverride?: number) {
  const scene = document.cinema?.scenes[sceneId];
  const host = document.nodes.find((node) => node.id === (scene?.nodeId ?? sceneId));
  if (!scene || !host || host.data.kind !== 'concept') return null;
  return canonicalRequest({ id: sceneId, title: scene.title, synopsis: scene.synopsis, brief: scene.brief,
    allocation: allocationOverride ?? storySceneAllocation(document, sceneId),
    host: { title: host.data.label, text: richTextToPlainText(host.data.body) } });
}
export function storySessionOutputs(document: EditorDocument, sessionId: string) {
  const accepted = document.cinema?.storyWorkflow?.sessions.find((session) => session.id === sessionId)?.accepted ?? [];
  const unchanged: string[] = [], changed: string[] = [];
  for (const mapping of accepted) {
    (mapping.sourceIdentity && mapping.sourceIdentity === storySceneIdentity(document, mapping.sceneId) ? unchanged : changed).push(mapping.sceneId);
  }
  return { unchanged, changed };
}
export async function storySessionContextDigest(document: EditorDocument, sessionId: string) {
  const output = storySessionOutputs(document, sessionId);
  const digest = await storyContextDigest(document, output.unchanged);
  return output.changed.length ? requestDigest({ digest, changedAcceptedOutputs: output.changed }) : digest;
}

export function storySceneAllocation(document: EditorDocument, sceneId: string): number | null {
  const workflow = document.cinema?.storyWorkflow;
  const explicit = workflow?.allocations?.find((item) => item.sceneId === sceneId);
  if (explicit) return explicit.durationSeconds;
  for (const session of workflow?.sessions ?? []) {
    const accepted = session.accepted.find((item) => item.sceneId === sceneId);
    if (accepted) return accepted.allocationSeconds ?? session.proposals.find((item) => item.id === accepted.proposalId)?.durationSeconds ?? null;
  }
  return document.cinema?.scenes[sceneId]?.brief?.targetDurationSeconds ?? null;
}

/** Recomputed from current canonical scenes, never treating an unknown as zero. */
export function storyAllocationReview(document: EditorDocument, brief: StoryWorkflowData['briefs'][number], sessionId?: string) {
  const session = document.cinema?.storyWorkflow?.sessions.find((item) => item.id === sessionId);
  const acceptedIds = new Set(session?.accepted.map((item) => item.proposalId) ?? []);
  const selected = session?.proposals.filter((item) => item.selected && !acceptedIds.has(item.id)) ?? [];
  const scenes = storySceneContext(document);
  const unknownSceneIds = scenes.filter((scene) => storySceneAllocation(document, scene.id) === null).map((scene) => scene.id);
  const knownExistingSeconds = scenes.reduce((sum, scene) => sum + (storySceneAllocation(document, scene.id) ?? 0), 0);
  const existingSeconds = unknownSceneIds.length ? null : knownExistingSeconds;
  const acceptedNewSeconds = (session?.accepted ?? []).reduce((sum, item) => sum + (item.allocationSeconds
    ?? session?.proposals.find((proposal) => proposal.id === item.proposalId)?.durationSeconds ?? 0), 0);
  const newSelectedSeconds = selected.reduce((sum, item) => sum + item.durationSeconds, 0);
  const targetSeconds = brief.durationSeconds;
  const remainingSeconds = brief.durationScope === 'new-material' ? targetSeconds - acceptedNewSeconds
    : existingSeconds === null ? null : targetSeconds - existingSeconds;
  const resultingSeconds = existingSeconds === null ? null : existingSeconds + newSelectedSeconds;
  const blockers: string[] = [];
  if (remainingSeconds === null) blockers.push('Allocate the existing scenes before using a whole-story target, or choose Continue with an explicit new-material duration.');
  else if (remainingSeconds <= 0) blockers.push('The duration target is already met or exceeded. Increase the target or review a separate revision before adding scenes.');
  return { targetSeconds, existingSeconds, knownExistingSeconds, unknownSceneIds, newSelectedSeconds, acceptedNewSeconds,
    resultingSeconds, remainingSeconds, selectedCount: selected.length, blockers,
    requiresPartialConfirmation: remainingSeconds !== null && newSelectedSeconds !== remainingSeconds };
}

export function setStorySceneAllocation(document: EditorDocument, sceneId: string, durationSeconds: number) {
  const scene = document.cinema?.scenes[sceneId];
  if (!scene || document.nodes.find((node) => node.id === scene.nodeId)?.data.locked) throw Error('Unlock an existing scene before changing its allocation.');
  if (!Number.isInteger(durationSeconds) || durationSeconds <= 0 || durationSeconds > 86_400) throw Error('Enter a positive allocation in seconds.');
  return changeStory(document, (data) => {
    const allocation = { sceneId, durationSeconds, source: 'manual' as const };
    data.allocations = [...(data.allocations ?? []).filter((item) => item.sceneId !== sceneId), allocation];
  });
}
export function storyContextDigest(document: EditorDocument, excludeSceneIds: readonly string[] = []) {
  const allocations = document.cinema?.storyWorkflow?.allocations?.filter((item) => !excludeSceneIds.includes(item.sceneId)
    && document.cinema?.scenes[item.sceneId]);
  return requestDigest({ premise: storyPremise(document), scenes: storySceneContext(document, excludeSceneIds).map((context) => {
    const scene = document.cinema?.scenes[context.id];
    const host = document.nodes.find((node) => node.id === (scene?.nodeId ?? context.id));
    // Keep the established fingerprint shape for existing mapped scenes so a
    // code upgrade alone does not invalidate a previously reviewed proposal.
    return { id: context.id, title: scene?.title ?? context.title, synopsis: scene?.synopsis ?? context.synopsis, brief: scene?.brief ?? null,
      host: host?.data.kind === 'concept' ? { title: host.data.label, text: richTextToPlainText(host.data.body) } : null };
  }), ...(allocations?.length ? { allocations } : {}) });
}
export function changeStory(document: EditorDocument, change: (draft: StoryWorkflowData) => void): EditorDocument {
  if (!document.cinema || !storyPremise(document)) throw Error('Create a story premise first.');
  const cinema = updateStoryWorkflow(document.cinema, document.cinema.storyWorkflow?.revision ?? 0, change);
  const unresolved = unresolvedStoryOperation(document.cinema.storyWorkflow);
  if (unresolved && cinema.storyWorkflow?.sessions.some((session) => session.stage === 'running'
    && !document.cinema?.storyWorkflow?.sessions.some((previous) => previous.id === session.id && previous.stage === 'running'))) {
    throw Error('Check the existing Story request before starting another. Its outcome is not yet known.');
  }
  if (document.nodes.find((node) => node.id === storyPremise(document)?.nodeId)?.data.locked
    && canonicalRequest(storyEditableContent(document.cinema.storyWorkflow)) !== canonicalRequest(storyEditableContent(cinema.storyWorkflow))) {
    throw Error('Unlock the Story premise before changing story content or proposals.');
  }
  return validateEditorDocument({ ...document, cinema });
}

/** Session history is authoritative across every Story panel, not a component's busy flag. */
export function unresolvedStoryOperation(workflow: StoryWorkflowData | undefined) {
  return workflow?.sessions.find(hasUnresolvedStoryOutcome);
}

/** Locks protect creative edits/adoption, not view state or durable error tracking. */
function storyEditableContent(workflow: StoryWorkflowData | undefined) {
  return workflow && {
    draft: workflow.draft, briefs: workflow.briefs, references: workflow.references, bindings: workflow.bindings,
    allocations: workflow.allocations,
    sessions: workflow.sessions.map((session) => ({ id: session.id, mode: session.mode, anchorSceneId: session.anchorSceneId,
      source: session.source, proposals: session.proposals, accepted: session.accepted,
      decision: ['accepted', 'rejected'].includes(session.stage) ? session.stage : null })),
    assistant: workflow.assistant && { answers: workflow.assistant.answers, checkpoint: workflow.assistant.checkpoint,
      confirmedBriefVersion: workflow.assistant.confirmedBriefVersion },
  };
}

export function assertStoryEditable(document: EditorDocument): void {
  const premise = storyPremise(document);
  if (!premise || document.nodes.find((node) => node.id === premise.nodeId)?.data.locked) {
    throw Error('Unlock the Story premise before changing story content or proposals.');
  }
}
/** Select saved proposals for local inspection without reviving a stale approval. */
export function openStorySessionReview(document: EditorDocument, sessionId: string) {
  const workflow = document.cinema?.storyWorkflow;
  const session = workflow?.sessions.find((item) => item.id === sessionId);
  if (!session || !['proposal-review', 'stale'].includes(session.stage)
    || !session.proposals.some((proposal) => !session.accepted.some((accepted) => accepted.proposalId === proposal.id))) throw Error('This history entry has no reviewable unaccepted drafts.');
  if (workflow?.sessions.some((item) => ['running', 'outcome-unknown'].includes(item.stage))
    || workflow?.assistant && ['understanding', 'outcome-unknown'].includes(workflow.assistant.state)) throw Error('Resolve the active request before changing the saved draft review.');
  return changeStory(document, (data) => {
    data.reviewSessionId = sessionId;
    data.sessions.find((item) => item.id === sessionId)!.presentation = 'scene-review';
    if (data.assistant) { data.assistant.hidden = false; data.assistant.collapsed = false; }
  });
}
export function returnToLatestStorySession(document: EditorDocument) {
  const workflow = document.cinema?.storyWorkflow;
  if (workflow?.sessions.some((item) => ['running', 'outcome-unknown'].includes(item.stage))
    || workflow?.assistant && ['understanding', 'outcome-unknown'].includes(workflow.assistant.state)) throw Error('Resolve the active request before changing the saved draft review.');
  return changeStory(document, (data) => { data.reviewSessionId = null; });
}
/** Await hashing, then compare and commit synchronously against the latest document. */
export async function commitReviewedStoryDocument(getDocument: () => EditorDocument,
  commit: (document: EditorDocument) => void,
  apply: (document: EditorDocument, digest: string) => EditorDocument, sessionId?: string) {
  const captured = getDocument();
  const digest = sessionId ? await storySessionContextDigest(captured, sessionId) : await storyContextDigest(captured);
  const current = getDocument();
  if (canonicalRequest({ ...captured, updatedAt: 0 }) !== canonicalRequest({ ...current, updatedAt: 0 })) {
    throw Error('The project changed during acceptance. Review the current proposal again.');
  }
  commit(apply(current, digest));
}
export function acceptStoryScenes(document: EditorDocument, sessionId: string, digest: string, partialConfirmed: boolean) {
  assertStoryEditable(document);
  const cinema = document.cinema;
  const session = cinema?.storyWorkflow?.sessions.find((item) => item.id === sessionId);
  if (!cinema || !session || session.stage !== 'proposal-review' || session.mode === 'surprise') throw Error('This proposal is not available for acceptance.');
  if (storySourceIsStale(cinema, session.source, digest)) throw Error('Story context changed. Review a new proposal; existing work was preserved.');
  if (storySessionOutputs(document, sessionId).changed.length) throw Error('An accepted scene changed or was deleted. Review the remaining draft against the current story.');
  const acceptedProposalIds = new Set(session.accepted.map((item) => item.proposalId));
  const selected = session.proposals.filter((item) => item.selected && !acceptedProposalIds.has(item.id));
  if (!selected.length) throw Error('Select at least one scene.');
  const allocation = storyAllocationReview(document, cinema.storyWorkflow!.briefs[session.source.briefVersion - 1], sessionId);
  if (allocation.blockers.length) throw Error(allocation.blockers.join(' '));
  if (allocation.requiresPartialConfirmation && !partialConfirmed) throw Error('Confirm the different allocated duration before accepting.');
  const ids = selected.map((item) => `${session.id}:${item.id}`);
  if (ids.some((id) => cinema.scenes[id] || document.nodes.some((node) => node.id === id))) throw Error('A proposed scene already exists; review the saved acceptance rather than adding it twice.');
  let next = document;
  for (const [index, proposal] of selected.entries()) {
    const previous = next;
    next = applyCinemaDomainCommand(previous, { type: 'add-scenes', scenes: [{ id: ids[index], title: proposal.title,
      synopsis: proposal.synopsis, dramaticPurpose: proposal.purpose }] });
    const node = next.nodes.find((node) => node.id === ids[index])!;
    const parentId = storyPremise(previous)!.nodeId;
    const placement = planCinemaDraftInsertion(previous.nodes, previous.edges, previous.cinema, { parentId }, 'scene', node);
    if (placement) {
      // Never move an existing host, including locked parents or accepted work.
      node.position = avoidAssistantOverlap(previous, node, placement.position);
      const edge = next.edges.find((edge) => edge.target === node.id)!;
      edge.sourceHandle = placement.sourceHandle; edge.targetHandle = placement.targetHandle;
      edge.data = { ...edge.data!, relationship: 'hierarchy' };
    }
  }
  const ownIds = new Set(session.accepted.map((item) => item.sceneId));
  const baseOrder = cinema.sceneOrder.filter((id) => !ownIds.has(id));
  const insertion = session.mode === 'continue' && session.anchorSceneId ? baseOrder.indexOf(session.anchorSceneId) + 1 : baseOrder.length;
  const allMappings = [...session.accepted, ...selected.map((item, index) => ({ proposalId: item.id, sceneId: ids[index] }))];
  const orderedOwnIds = session.proposals.flatMap((proposal) => allMappings.filter((item) => item.proposalId === proposal.id).map((item) => item.sceneId));
  next.cinema!.sceneOrder = [...baseOrder.slice(0, insertion), ...orderedOwnIds, ...baseOrder.slice(insertion)];
  next.cinema!.multiScene!.sceneOrder = [...next.cinema!.sceneOrder];
  return changeStory(next, (draft) => {
    const current = draft.sessions.find((item) => item.id === sessionId)!;
    current.accepted.push(...selected.map((item, index) => ({ proposalId: item.id, sceneId: ids[index],
      allocationSeconds: item.durationSeconds, sourceIdentity: storySceneIdentity(next, ids[index], item.durationSeconds)! })));
    for (const [index, proposal] of selected.entries()) {
      if (draft.allocations?.some((item) => item.sceneId === ids[index])) continue;
      (draft.allocations ??= []).push({ sceneId: ids[index], durationSeconds: proposal.durationSeconds, source: 'story-proposal', sessionId, proposalId: proposal.id });
    }
    for (const proposal of current.proposals) if (selected.some((item) => item.id === proposal.id)) proposal.selected = false;
    current.stage = current.accepted.length === current.proposals.length ? 'accepted' : 'proposal-review';
    current.presentation = 'scenes-added';
    draft.reviewSessionId = draft.sessions.at(-1)?.id === sessionId ? null : sessionId;
  });
}
export function acceptStoryConcept(document: EditorDocument, sessionId: string, proposalId: string, digest: string) {
  const session = document.cinema?.storyWorkflow?.sessions.find((item) => item.id === sessionId);
  if (!session || session.mode !== 'surprise' || session.stage !== 'proposal-review'
    || storySourceIsStale(document.cinema!, session.source, digest)) throw Error('This concept is stale or unavailable.');
  const proposal = session.proposals.find((item) => item.id === proposalId);
  const next = structuredClone(document);
  const node = next.nodes.find((node) => node.id === storyPremise(document)?.nodeId);
  if (!proposal || !node || node.data.kind !== 'concept' || node.data.locked) throw Error('Unlock the premise before replacing it.');
  node.data.label = proposal.title; node.data.name = proposal.title;
  node.data.title = conceptTitleFromPlainText(proposal.title); node.data.body = richTextFromPlainText(proposal.synopsis);
  return changeStory(next, (draft) => { draft.sessions.find((item) => item.id === sessionId)!.stage = 'accepted'; draft.draft = null; });
}
