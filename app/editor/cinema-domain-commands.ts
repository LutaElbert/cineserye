import { MarkerType } from '@xyflow/react';
import type {
  CinemaAssetRecord,
  CinemaCharacterRecord,
  CinemaPromptArtifactRecord,
  CinemaSceneRecord,
  CinemaShotRecord,
} from '../domain/cinema/project-data';
import {
  createDefaultMultiSceneData,
  upsertSharedEntityVariant,
  type CinemaProjectContinuityException,
  type CinemaSharedEntityVariantRecord,
} from '../domain/cinema/multi-scene';
import {
  cinemaAuditFingerprint,
  readCinemaAuditData,
  runFixtureContinuityAudit,
  storeCinemaAuditResult,
  writeCinemaAuditData,
  type CinemaAuditScope,
} from '../domain/cinema/continuity-audit';
import {
  assignShotsToSetup,
  reconcileProfessionalPlanningData,
  reorderProductionShot,
  type CinemaContinuityExceptionRecord,
  type CinemaProductionSetupRecord,
  type CinemaProductionStatus,
} from '../domain/cinema/professional-planning';
import { validateEditorDocument } from './document-file';
import { conceptTitleFromPlainText, richTextFromPlainText } from './rich-text';
import type { EditorDocument } from './types';

export type CinemaShotPatch = Partial<Pick<CinemaShotRecord,
  'title' | 'description' | 'purpose' | 'framing' | 'cameraMovement' | 'lensMm'
  | 'durationSeconds' | 'audio' | 'risk' | 'continuityNodeIds'>>;

export type CinemaDomainCommand =
  | { type: 'add-scenes'; scenes: Array<{ id: string; title: string; synopsis: string; dramaticPurpose: string }> }
  | { type: 'set-active-scene'; sceneId: string }
  | { type: 'reorder-scene'; sceneId: string; toIndex: number }
  | { type: 'set-shared-entity-scenes'; entityNodeId: string; sceneIds: string[] }
  | { type: 'upsert-shared-entity-variant'; variant: CinemaSharedEntityVariantRecord }
  | { type: 'add-project-continuity-exception'; exception: CinemaProjectContinuityException }
  | { type: 'run-continuity-audit'; scope: CinemaAuditScope; createdAt: string }
  | { type: 'dismiss-continuity-audit-finding'; findingId: string }
  | { type: 'accept-continuity-audit-correction'; findingId: string; sourceFingerprint: string }
  | { type: 'update-shot'; shotId: string; patch: CinemaShotPatch }
  | { type: 'batch-update-shots'; updates: Array<{ shotId: string; patch: CinemaShotPatch }> }
  | { type: 'reorder-shot'; shotId: string; toIndex: number }
  | { type: 'reorder-production-shot'; shotId: string; toIndex: number }
  | { type: 'set-production-status'; shotIds: string[]; status: CinemaProductionStatus }
  | { type: 'upsert-production-setup'; setup: CinemaProductionSetupRecord }
  | { type: 'assign-shots-to-setup'; shotIds: string[]; setupId: string }
  | { type: 'set-continuity-state'; shotId: string; entityNodeId: string; state: string }
  | { type: 'add-continuity-exception'; exception: CinemaContinuityExceptionRecord }
  | { type: 'update-scene'; sceneId: string; patch: Partial<Pick<CinemaSceneRecord, 'title' | 'synopsis' | 'dramaticPurpose' | 'continuityNotes'>> }
  | { type: 'update-character'; characterId: string; patch: Partial<Pick<CinemaCharacterRecord, 'title' | 'summary' | 'appearanceReference' | 'voiceReference' | 'wardrobeNotes'>> }
  | { type: 'update-asset'; assetId: string; patch: Partial<Pick<CinemaAssetRecord, 'title' | 'summary' | 'continuityNotes' | 'uri' | 'provenance'>> }
  | { type: 'update-prompt'; promptId: string; patch: Partial<Pick<CinemaPromptArtifactRecord, 'generatedText' | 'negativeConstraints' | 'status'>> };

const TEXT_LIMIT = 20_000;

function boundedText(value: unknown, label: string, max = TEXT_LIMIT) {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} is invalid or too long.`);
  return value;
}

function assertKnownKeys(record: object, keys: readonly string[], label: string) {
  if (Object.keys(record).some((key) => !keys.includes(key))) throw new Error(`${label} contains an unsupported field.`);
}

function patchHost(document: EditorDocument, nodeId: string, title: string, body: string) {
  const node = document.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || node.data.kind !== 'concept') throw new Error(`Cinema host ${nodeId} is missing.`);
  node.data.name = title;
  node.data.label = title;
  node.data.title = conceptTitleFromPlainText(title);
  node.data.body = richTextFromPlainText(body);
}

function invalidateOwnedPrompts(document: EditorDocument, ownerNodeId: string) {
  if (!document.cinema) return;
  for (const prompt of Object.values(document.cinema.prompts)) {
    if (prompt.ownerNodeId === ownerNodeId && prompt.status !== 'approved') prompt.status = 'stale';
  }
}

export function applyCinemaDomainCommand(
  source: EditorDocument,
  command: CinemaDomainCommand,
): EditorDocument {
  if (command.type === 'batch-update-shots') {
    if (!command.updates.length || command.updates.length > 500
      || new Set(command.updates.map((update) => update.shotId)).size !== command.updates.length) {
      throw new Error('Batch shot update is invalid.');
    }
    return command.updates.reduce((document, update) => applyCinemaDomainCommand(document, {
      type: 'update-shot',
      shotId: update.shotId,
      patch: update.patch,
    }), source);
  }
  const next = structuredClone(source);
  const cinema = next.cinema;
  if (!cinema) throw new Error('Cinema project data is missing.');
  cinema.professionalPlanning = reconcileProfessionalPlanningData(cinema, cinema.professionalPlanning);
  cinema.multiScene ??= createDefaultMultiSceneData(cinema);

  if (command.type === 'add-scenes') {
    if (!command.scenes.length || command.scenes.length > 100 || cinema.sceneOrder.length + command.scenes.length > 100) {
      throw new Error('Scene addition must contain between 1 and 100 scenes.');
    }
    const ids = command.scenes.map((scene) => scene.id);
    if (new Set(ids).size !== ids.length || ids.some((sceneId) => cinema.scenes[sceneId] || next.nodes.some((node) => node.id === sceneId))) {
      throw new Error('Scene ids must be unique.');
    }
    const storyNodeId = cinema.projectNodeId ?? next.nodes.find((node) => node.data.kind === 'concept' && node.data.domainType === 'cinema.story')?.id ?? null;
    const sceneNodes = next.nodes.filter((node) => node.data.kind === 'concept' && node.data.domainType === 'cinema.scene');
    const maxY = Math.max(0, ...sceneNodes.map((node) => node.position.y));
    command.scenes.forEach((proposal, index) => {
      const title = boundedText(proposal.title.trim(), 'Scene title', 500);
      if (!title) throw new Error('Scene title is required.');
      const synopsis = boundedText(proposal.synopsis, 'Scene synopsis');
      const dramaticPurpose = boundedText(proposal.dramaticPurpose, 'Scene dramatic purpose');
      cinema.scenes[proposal.id] = {
        id: proposal.id,
        nodeId: proposal.id,
        title,
        synopsis,
        dramaticPurpose,
        status: 'outline',
        continuityNotes: '',
        brief: null,
        shotIds: [],
      };
      cinema.sceneOrder.push(proposal.id);
      cinema.multiScene!.sceneOrder.push(proposal.id);
      next.nodes.push({
        id: proposal.id,
        type: 'concept',
        position: { x: 450, y: maxY + 220 * (index + 1) },
        style: { width: 250, height: 140 },
        draggable: true,
        deletable: true,
        selected: false,
        data: {
          kind: 'concept', domainType: 'cinema.scene', name: title, label: title,
          title: conceptTitleFromPlainText(title), body: richTextFromPlainText(synopsis),
          eyebrow: 'Scene', tone: 'ink', collapsed: false, horizontalAlign: 'left',
          verticalAlign: 'top', opacity: 1, locked: false,
        },
      });
      if (storyNodeId) next.edges.push({
        id: `${storyNodeId}-${proposal.id}`,
        source: storyNodeId,
        target: proposal.id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#a9adb7', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { label: '', kind: 'default' },
      });
    });
  } else if (command.type === 'set-active-scene') {
    if (!cinema.scenes[command.sceneId]) throw new Error('Active scene is missing.');
    cinema.activeSceneId = command.sceneId;
    cinema.activeRevisionId = Object.values(cinema.revisions).find(
      (revision) => revision.sceneId === command.sceneId && revision.status === 'active',
    )?.id ?? null;
  } else if (command.type === 'reorder-scene') {
    if (!cinema.scenes[command.sceneId] || !Number.isInteger(command.toIndex)
      || command.toIndex < 0 || command.toIndex >= cinema.sceneOrder.length) {
      throw new Error('Scene reorder command is invalid.');
    }
    const ordered = cinema.sceneOrder.filter((sceneId) => sceneId !== command.sceneId);
    ordered.splice(command.toIndex, 0, command.sceneId);
    cinema.sceneOrder = ordered;
    cinema.multiScene.sceneOrder = [...ordered];
  } else if (command.type === 'set-shared-entity-scenes') {
    const entity = [...Object.values(cinema.characters), ...Object.values(cinema.assets)]
      .find((candidate) => candidate.nodeId === command.entityNodeId);
    if (!entity || !command.sceneIds.length || new Set(command.sceneIds).size !== command.sceneIds.length
      || command.sceneIds.some((sceneId) => !cinema.scenes[sceneId])) {
      throw new Error('Shared continuity scene assignment is invalid.');
    }
    entity.sceneIds = [...command.sceneIds];
  } else if (command.type === 'upsert-shared-entity-variant') {
    cinema.multiScene = upsertSharedEntityVariant(cinema.multiScene, command.variant);
  } else if (command.type === 'add-project-continuity-exception') {
    cinema.multiScene.continuityExceptions[command.exception.id] = structuredClone(command.exception);
  } else if (command.type === 'run-continuity-audit') {
    storeCinemaAuditResult(cinema, runFixtureContinuityAudit(cinema, command.scope, command.createdAt));
  } else if (command.type === 'dismiss-continuity-audit-finding') {
    const audit = readCinemaAuditData(cinema);
    const finding = audit.findings[command.findingId];
    if (!finding) throw new Error('Continuity audit finding is missing.');
    finding.disposition = 'dismissed';
    writeCinemaAuditData(cinema, audit);
  } else if (command.type === 'accept-continuity-audit-correction') {
    const audit = readCinemaAuditData(cinema);
    const finding = audit.findings[command.findingId];
    const run = Object.values(audit.runs).find((candidate) => candidate.findingIds.includes(command.findingId));
    if (!finding || !run || !finding.correction) throw new Error('Continuity audit correction is unavailable.');
    if (run.sourceFingerprint !== command.sourceFingerprint
      || cinemaAuditFingerprint(cinema, run.scope) !== command.sourceFingerprint) {
      throw new Error('This audit is stale. Run it again before accepting a correction.');
    }
    if (!cinema.scenes[finding.correction.sceneId]) throw new Error('Continuity audit scene is missing.');
    const entityExists = [...Object.values(cinema.characters), ...Object.values(cinema.assets)]
      .some((entity) => entity.nodeId === finding.correction?.entityNodeId);
    if (!entityExists || finding.correction.shotIds.some((shotId) => cinema.shots[shotId]?.sceneId !== finding.correction?.sceneId)) {
      throw new Error('Continuity audit correction references are invalid.');
    }
    cinema.multiScene.continuityExceptions[`audit-exception-${finding.id}`] = {
      id: `audit-exception-${finding.id}`,
      entityNodeId: finding.correction.entityNodeId,
      sceneId: finding.correction.sceneId,
      shotIds: [...finding.correction.shotIds],
      rationale: boundedText(finding.correction.rationale, 'Audit correction rationale', 4_000),
    };
    finding.disposition = 'accepted';
    writeCinemaAuditData(cinema, audit);
  } else if (command.type === 'update-shot') {
    const shot = cinema.shots[command.shotId];
    if (!shot) throw new Error(`Shot ${command.shotId} is missing.`);
    assertKnownKeys(command.patch, [
      'title', 'description', 'purpose', 'framing', 'cameraMovement', 'lensMm',
      'durationSeconds', 'audio', 'risk', 'continuityNodeIds',
    ], 'Shot patch');
    if (command.patch.title !== undefined) shot.title = boundedText(command.patch.title, 'Shot title', 500);
    if (command.patch.description !== undefined) shot.description = boundedText(command.patch.description, 'Shot description');
    if (command.patch.purpose !== undefined) shot.purpose = boundedText(command.patch.purpose, 'Shot purpose');
    if (command.patch.framing !== undefined) shot.framing = boundedText(command.patch.framing, 'Shot framing', 500);
    if (command.patch.cameraMovement !== undefined) shot.cameraMovement = boundedText(command.patch.cameraMovement, 'Camera movement', 500);
    if (command.patch.audio !== undefined) shot.audio = boundedText(command.patch.audio, 'Shot audio');
    if (command.patch.durationSeconds !== undefined) {
      if (!Number.isFinite(command.patch.durationSeconds) || command.patch.durationSeconds <= 0 || command.patch.durationSeconds > 600) {
        throw new Error('Shot duration must be between 0 and 600 seconds.');
      }
      shot.durationSeconds = command.patch.durationSeconds;
    }
    if (command.patch.lensMm !== undefined) {
      if (command.patch.lensMm !== null && (!Number.isFinite(command.patch.lensMm) || command.patch.lensMm < 1 || command.patch.lensMm > 300)) {
        throw new Error('Shot lens must be between 1 and 300mm.');
      }
      shot.lensMm = command.patch.lensMm;
    }
    if (command.patch.risk !== undefined) {
      if (!['low', 'medium', 'high'].includes(command.patch.risk)) throw new Error('Shot risk is unsupported.');
      shot.risk = command.patch.risk;
    }
    if (command.patch.continuityNodeIds !== undefined) {
      const validContinuityHosts = new Set([
        ...Object.values(cinema.characters).map((record) => record.nodeId),
        ...Object.values(cinema.assets).map((record) => record.nodeId),
      ]);
      if (new Set(command.patch.continuityNodeIds).size !== command.patch.continuityNodeIds.length
        || command.patch.continuityNodeIds.some((nodeId) => !validContinuityHosts.has(nodeId))) {
        throw new Error('Shot continuity references are invalid.');
      }
      shot.continuityNodeIds = [...command.patch.continuityNodeIds];
    }
    patchHost(next, shot.nodeId, `${String(shot.order).padStart(2, '0')} · ${shot.title}`, `${shot.durationSeconds}s · ${shot.framing} · ${shot.risk} risk`);
    invalidateOwnedPrompts(next, shot.nodeId);
  } else if (command.type === 'reorder-shot') {
    const shot = cinema.shots[command.shotId];
    const scene = shot ? cinema.scenes[shot.sceneId] : null;
    if (!shot || !scene || !Number.isInteger(command.toIndex) || command.toIndex < 0 || command.toIndex >= scene.shotIds.length) {
      throw new Error('Shot reorder command is invalid.');
    }
    const ordered = scene.shotIds.filter((shotId) => shotId !== shot.id);
    ordered.splice(command.toIndex, 0, shot.id);
    scene.shotIds = ordered;
    ordered.forEach((shotId, index) => {
      cinema.shots[shotId].order = index + 1;
      const record = cinema.shots[shotId];
      patchHost(next, record.nodeId, `${String(index + 1).padStart(2, '0')} · ${record.title}`, `${record.durationSeconds}s · ${record.framing} · ${record.risk} risk`);
    });
  } else if (command.type === 'reorder-production-shot') {
    const shot = cinema.shots[command.shotId];
    const scene = shot ? cinema.scenes[shot.sceneId] : null;
    if (!shot || !scene) throw new Error('Production reorder target is missing.');
    cinema.professionalPlanning = reorderProductionShot(
      cinema.professionalPlanning,
      scene.shotIds,
      command.shotId,
      command.toIndex,
    );
  } else if (command.type === 'set-production-status') {
    if (!command.shotIds.length || new Set(command.shotIds).size !== command.shotIds.length
      || !['planned', 'ready', 'captured', 'skipped'].includes(command.status)) {
      throw new Error('Production status command is invalid.');
    }
    for (const shotId of command.shotIds) {
      const production = cinema.professionalPlanning.shots[shotId];
      if (!production) throw new Error(`Production shot ${shotId} is missing.`);
      production.status = command.status;
    }
  } else if (command.type === 'upsert-production-setup') {
    const setup = structuredClone(command.setup);
    if (!cinema.scenes[setup.sceneId]) throw new Error('Production setup scene is missing.');
    const existing = cinema.professionalPlanning.setups[setup.id];
    if (existing && existing.sceneId !== setup.sceneId) throw new Error('A production setup cannot move across scenes.');
    setup.shotIds = existing?.shotIds ?? setup.shotIds;
    cinema.professionalPlanning.setups[setup.id] = setup;
  } else if (command.type === 'assign-shots-to-setup') {
    cinema.professionalPlanning = assignShotsToSetup(
      cinema.professionalPlanning,
      command.shotIds,
      command.setupId,
    );
  } else if (command.type === 'set-continuity-state') {
    if (!cinema.shots[command.shotId]) throw new Error('Continuity shot is missing.');
    const validNode = Object.values(cinema.characters).some((record) => record.nodeId === command.entityNodeId)
      || Object.values(cinema.assets).some((record) => record.nodeId === command.entityNodeId);
    if (!validNode) throw new Error('Continuity entity is missing.');
    cinema.professionalPlanning.continuityStates[command.shotId] ??= {};
    cinema.professionalPlanning.continuityStates[command.shotId][command.entityNodeId] = boundedText(
      command.state,
      'Continuity state',
      500,
    );
  } else if (command.type === 'add-continuity-exception') {
    cinema.professionalPlanning.continuityExceptions[command.exception.id] = structuredClone(command.exception);
  } else {
    const configurations = {
      'update-scene': { collection: cinema.scenes, id: command.type === 'update-scene' ? command.sceneId : '', keys: ['title', 'synopsis', 'dramaticPurpose', 'continuityNotes'] },
      'update-character': { collection: cinema.characters, id: command.type === 'update-character' ? command.characterId : '', keys: ['title', 'summary', 'appearanceReference', 'voiceReference', 'wardrobeNotes'] },
      'update-asset': { collection: cinema.assets, id: command.type === 'update-asset' ? command.assetId : '', keys: ['title', 'summary', 'continuityNotes', 'uri', 'provenance'] },
      'update-prompt': { collection: cinema.prompts, id: command.type === 'update-prompt' ? command.promptId : '', keys: ['generatedText', 'negativeConstraints', 'status'] },
    } as const;
    const configuration = configurations[command.type];
    const record = configuration.collection[configuration.id as never] as Record<string, unknown> | undefined;
    if (!record) throw new Error('Cinema command target is missing.');
    assertKnownKeys(command.patch, configuration.keys, 'Cinema patch');
    Object.assign(record, structuredClone(command.patch));
  }
  cinema.professionalPlanning = reconcileProfessionalPlanningData(cinema, cinema.professionalPlanning);
  next.updatedAt = Date.now();
  return validateEditorDocument(next);
}
