import type { CinemaProjectData, CinemaShotRecord } from '../../domain/cinema/project-data';
import { storyReviewSession } from '../../domain/cinema/story-workflow';
import { selectShotMediaPreview } from '../storyboard/shot-media-selection';
import type { WorkflowCapabilities } from '../story-development/workflow-capabilities';
import type { ClientOperationEntry } from './operation-journal';
import type { FilmmakingStage } from './navigation';

export type StageAction = {
  kind: 'open-story-editor' | 'open-story-assistant' | 'open-scene' | 'open-shot' | 'select-stage' | 'refresh-status' | 'none';
  label: string;
  targetId?: string;
};
export type StageGuidance = {
  stage: FilmmakingStage;
  state: string;
  title: string;
  description: string;
  action: StageAction;
  operationId?: string;
};
export type StageProjection = {
  recommendedStage: FilmmakingStage;
  guidance: Record<FilmmakingStage, StageGuidance>;
};
export type StageProjectionInput = {
  cinema?: CinemaProjectData;
  hasPremise: boolean;
  operations?: ClientOperationEntry[];
  capabilities?: WorkflowCapabilities | null;
  capabilityError?: boolean;
};

const uncertain = new Set<ClientOperationEntry['phase']>(['intent', 'dispatched', 'running', 'tracking-stopped', 'unknown', 'expired', 'failed']);
const operationStage: Record<ClientOperationEntry['kind'], FilmmakingStage> = {
  'story-analysis': 'idea', 'story-plan': 'plan', 'shot-plan': 'plan', 'image-generation': 'references', 'video-generation': 'video',
};
const operationOrder: Record<ClientOperationEntry['phase'], number> = {
  unknown: 0, 'tracking-stopped': 1, intent: 2, dispatched: 2, running: 2, failed: 3, expired: 4,
  'awaiting-review': 5, succeeded: 6,
};

function operationGuidance(stage: FilmmakingStage, operation: ClientOperationEntry, shot?: CinemaShotRecord): StageGuidance {
  const operationTargetId = operation.kind === 'image-generation' ? operation.scopeKey.split(':')[0]
    : operation.kind === 'video-generation' ? operation.scopeKey.split(':')[1] : undefined;
  const targetId = shot?.nodeId ?? operationTargetId;
  const kind: StageAction['kind'] = operation.kind === 'story-analysis' || operation.kind === 'story-plan' || operation.kind === 'shot-plan'
    ? 'open-story-assistant' : targetId ? 'open-shot' : 'none';
  const scope = shot?.title ? ` for ${shot.title}` : '';
  if (operation.phase === 'unknown') return { stage, state: 'outcome-unknown', title: 'Outcome unknown',
    description: `Request ${operation.id} may still be running or billable. Check this exact request before approving another${scope}.`,
    action: { kind, label: 'Check existing request', targetId }, operationId: operation.id };
  if (operation.phase === 'tracking-stopped') return { stage, state: 'tracking-stopped', title: 'Local tracking stopped',
    description: `Observation stopped for request ${operation.id}; provider cancellation or refund was not confirmed.`,
    action: { kind, label: 'Review existing request', targetId }, operationId: operation.id };
  if (operation.phase === 'expired') return { stage, state: 'expired', title: 'Saved result unavailable',
    description: `Request ${operation.id} cannot be replayed. Review retained local work before separately approving anything new.`,
    action: { kind, label: 'Review unavailable result', targetId }, operationId: operation.id };
  if (operation.phase === 'failed') return { stage, state: 'failed', title: 'Request needs attention',
    description: `${operation.lastError ?? `Request ${operation.id} failed.`} Successful scope and retained work stay unchanged.`,
    action: { kind, label: 'Review retry eligibility', targetId }, operationId: operation.id };
  return { stage, state: operation.phase, title: 'Existing request in progress',
    description: `Continue with request ${operation.id}. Opening this stage will not dispatch another request.`,
    action: { kind, label: 'View existing request', targetId }, operationId: operation.id };
}

function capabilitySuffix(input: StageProjectionInput, feature: 'images' | 'video' | 'assembly') {
  if (input.capabilityError || !input.capabilities) return ' Availability is unknown; local editing remains available and refresh is read-only.';
  const value = input.capabilities.stages[feature];
  return value.status === 'blocked' ? ` Generation is blocked: ${value.blockers.join(' ') || 'workspace policy'}` : '';
}

function orderedShots(cinema?: CinemaProjectData) {
  return cinema?.sceneOrder.flatMap(sceneId => {
    const scene = cinema.scenes[sceneId];
    return scene ? scene.shotIds.flatMap(id => cinema.shots[id] ? [cinema.shots[id]] : []).sort((a, b) => a.order - b.order) : [];
  }) ?? [];
}

function proposedVideoClip(cinema: CinemaProjectData, shot: CinemaShotRecord) {
  const selection = selectShotMediaPreview(cinema, shot);
  if (!selection.image || selection.image.status !== 'approved') return false;
  return Object.values(cinema.visualPreproduction?.videoClips ?? {}).some(clip => clip.shotId === shot.id && clip.status === 'candidate'
    && clip.revisionId === selection.image!.revisionId && clip.startFrameId === selection.image!.id);
}

export function projectStageProjection(input: StageProjectionInput): StageProjection {
  const cinema = input.cinema, workflow = cinema?.storyWorkflow, session = storyReviewSession(workflow), shots = orderedShots(cinema);
  const unacceptedScenes = session?.proposals.filter(proposal => !session.accepted.some(item => item.proposalId === proposal.id)) ?? [];
  const byStage = new Map<FilmmakingStage, ClientOperationEntry>();
  for (const operation of (input.operations ?? []).filter(entry => uncertain.has(entry.phase)).sort((a, b) => operationOrder[a.phase] - operationOrder[b.phase]
    || b.updatedAt.localeCompare(a.updatedAt))) if (!byStage.has(operationStage[operation.kind])) byStage.set(operationStage[operation.kind], operation);
  const operationFor = (stage: FilmmakingStage) => {
    const operation = byStage.get(stage); if (!operation) return null;
    const target = operation.kind === 'image-generation' ? operation.scopeKey.split(':')[0]
      : operation.kind === 'video-generation' ? operation.scopeKey.split(':')[1] : undefined;
    return operationGuidance(stage, operation, shots.find(shot => shot.id === target));
  };

  let idea: StageGuidance;
  if (!input.hasPremise) idea = { stage: 'idea', state: 'empty', title: 'Start with your idea',
    description: 'Write locally first. Opening the composer or typing never starts analysis.', action: { kind: 'open-story-editor', label: 'Write your idea' } };
  else if (operationFor('idea')) idea = operationFor('idea')!;
  else if (!cinema?.sceneOrder.length && !workflow?.assistant?.checkpoint && !workflow?.briefs.length && !workflow?.sessions.length) idea = { stage: 'idea', state: 'premise-saved', title: 'Your premise is saved',
    description: 'Review the exact direction and any corrections before a separately approved request.', action: { kind: 'open-story-assistant', label: 'Review direction' } };
  else if (unacceptedScenes.length) idea = { stage: 'idea', state: session!.accepted.length ? 'partial-scenes' : 'proposed-scenes',
    title: session!.accepted.length ? 'Some scene drafts remain' : 'Scene proposals are ready',
    description: 'Review the visible selections, ordering and duration before adding scenes.',
    action: { kind: 'open-story-assistant', label: session!.accepted.length ? 'Review remaining drafts' : 'Review proposed scenes' } };
  else idea = { stage: 'idea', state: 'direction-reviewed', title: 'Direction saved',
    description: 'Your premise and reviewed direction remain editable. Scene planning is the next separate decision.', action: { kind: 'select-stage', label: 'Continue to Plan', targetId: 'plan' } };

  let plan = operationFor('plan');
  if (!plan) {
    const shotPlan = workflow?.shotPlanning;
    const readyShots = shotPlan?.jobs.filter(job => job.status === 'ready' && !shotPlan.acceptedSceneIds.includes(job.sceneId)) ?? [];
    const missingPlan = cinema?.sceneOrder.map(id => cinema.scenes[id]).find(scene => scene && !scene.shotIds.length);
    if (!cinema?.sceneOrder.length && (!session || !session.proposals.length)) plan = { stage: 'plan', state: 'no-scenes', title: 'Shape scenes from your direction',
      description: 'Review source, scope, model and estimate before requesting scene proposals.', action: { kind: 'open-story-assistant', label: 'Review scene request' } };
    else if (unacceptedScenes.length) plan = { stage: 'plan', state: session!.accepted.length ? 'partial-scenes' : 'proposed-scenes',
      title: session!.accepted.length ? 'Some scene drafts remain' : 'Scene proposals are ready',
      description: 'Review visible selections, ordering and duration. Accepted scene identities remain unchanged.',
      action: { kind: 'open-story-assistant', label: session!.accepted.length ? 'Review remaining drafts' : 'Review proposed scenes' } };
    else if (readyShots.length) plan = { stage: 'plan', state: 'proposed-shots', title: 'Shot proposals are ready',
      description: 'Accept only visible selected plans. Unselected drafts remain saved and the batch has one undo origin.',
      action: { kind: 'open-story-assistant', label: 'Review proposed shots' } };
    else if (missingPlan) plan = { stage: 'plan', state: 'missing-shot-plan', title: `${missingPlan.title} needs a shot plan`,
      description: 'Review this exact scene scope; manual planning remains available and no canvas selection is inferred.',
      action: { kind: 'open-scene', label: `Review shot plan for ${missingPlan.title}`, targetId: missingPlan.nodeId } };
    else plan = { stage: 'plan', state: 'plans-accepted', title: 'Shot plans are ready',
      description: 'Narrative order, professional production views and manual shot editing remain available.',
      action: { kind: 'select-stage', label: 'Continue to References', targetId: 'references' } };
  }

  let references = operationFor('references');
  if (!references) {
    const candidate = shots.find(shot => selectShotMediaPreview(cinema!, shot).image?.status === 'candidate');
    const missing = shots.find(shot => selectShotMediaPreview(cinema!, shot).stage === 'plan');
    if (!shots.length) references = { stage: 'references', state: 'no-shots', title: 'References follow accepted shots',
      description: 'Accept a shot plan first. Opening References never generates media.', action: { kind: 'select-stage', label: 'Go to Plan', targetId: 'plan' } };
    else if (candidate) references = { stage: 'references', state: 'candidate-images', title: 'Image candidates need review',
      description: 'Approve or reject current safe candidates explicitly; stale or missing bytes are never promoted.',
      action: { kind: 'open-shot', label: 'Review image candidates', targetId: candidate.nodeId } };
    else if (missing) {
      const stale = selectShotMediaPreview(cinema!, missing).hasPreviousMedia;
      references = { stage: 'references', state: stale ? 'stale-source' : 'missing-reference',
        title: stale ? `${missing.title} changed` : `${missing.title} needs a reference`,
        description: `${stale ? 'Earlier media stays retained; review the changed source and approve current inputs.' : 'Review inherited and local ownership, bytes, rights and intended transfer.'}${capabilitySuffix(input, 'images')}`,
        action: { kind: 'open-shot', label: stale ? 'Review changed source' : `Review references for ${missing.title}`, targetId: missing.nodeId } };
    } else references = { stage: 'references', state: 'references-approved', title: 'Current references are approved',
      description: 'Approved frames remain tied to their exact shot revision and prompt version.',
      action: { kind: 'select-stage', label: 'Continue to Video', targetId: 'video' } };
  }

  let video = operationFor('video');
  if (!video) {
    const candidate = cinema && shots.find(shot => proposedVideoClip(cinema, shot));
    const missing = cinema && shots.find(shot => selectShotMediaPreview(cinema, shot).stage !== 'video');
    const approved = cinema ? shots.filter(shot => selectShotMediaPreview(cinema, shot).stage === 'video').length : 0;
    if (!shots.length) video = { stage: 'video', state: 'no-shots', title: 'Video follows accepted shots',
      description: 'Accept a shot plan and review current references first.', action: { kind: 'select-stage', label: 'Go to Plan', targetId: 'plan' } };
    else if (candidate) video = { stage: 'video', state: 'take-candidate', title: `${candidate.title} has a take to review`,
      description: 'Compare decoded footage with requested settings. Nothing is approved automatically.',
      action: { kind: 'open-shot', label: 'Review take', targetId: candidate.nodeId } };
    else if (missing && selectShotMediaPreview(cinema!, missing).image?.status === 'approved') video = { stage: 'video', state: approved ? 'partial-takes' : 'missing-take',
      title: approved ? `${approved} of ${shots.length} takes approved` : `${missing.title} is ready for motion review`,
      description: `${approved ? 'Retained approved footage will not be regenerated. ' : ''}Review exact source/reference versions, requested duration, model and estimate before dispatch.${capabilitySuffix(input, 'video')}`,
      action: { kind: 'open-shot', label: approved ? 'Review next missing take' : `Review video request for ${missing.title}`, targetId: missing.nodeId } };
    else if (missing) video = { stage: 'video', state: 'reference-needed', title: `${missing.title} needs a current reference`,
      description: 'Approve a current safe storyboard frame before reviewing a video request.',
      action: { kind: 'select-stage', label: 'Review missing reference', targetId: 'references' } };
    else video = { stage: 'video', state: 'takes-approved', title: 'All current takes are approved',
      description: 'Approved takes stay in narrative order and remain individually downloadable.',
      action: { kind: 'select-stage', label: 'Review sequence', targetId: 'final-cut' } };
  }

  const allTakes = shots.length > 0 && cinema && shots.every(shot => selectShotMediaPreview(cinema, shot).stage === 'video');
  const finalCut: StageGuidance = !allTakes ? { stage: 'final-cut', state: shots.length ? 'partial-sequence' : 'empty-sequence', title: 'Sequence is not complete',
    description: 'Every missing, stale or short clip remains visible; nothing is silently omitted.',
    action: { kind: 'select-stage', label: shots.length ? 'Review missing takes' : 'Go to Plan', targetId: shots.length ? 'video' : 'plan' } }
    : { stage: 'final-cut', state: 'sequence-ready', title: 'Review your sequence',
      description: `Confirm narrative order, trims and decoded footage before the explicit local render.${capabilitySuffix(input, 'assembly')}`,
      action: { kind: 'none', label: 'Render silent MP4' } };

  const guidance = { idea, plan, references, video, 'final-cut': finalCut };
  const recommendedStage = (['idea', 'plan', 'references', 'video', 'final-cut'] as FilmmakingStage[])
    .find(stage => !['direction-reviewed', 'plans-accepted', 'references-approved', 'takes-approved'].includes(guidance[stage].state)) ?? 'final-cut';
  return { recommendedStage, guidance };
}
