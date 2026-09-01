import type {
  CinemaAssetRecord,
  CinemaCharacterRecord,
  CinemaPromptArtifactRecord,
  CinemaSceneRecord,
  CinemaShotRecord,
} from '../domain/cinema/project-data';
import { validateEditorDocument } from './document-file';
import { conceptTitleFromPlainText, richTextFromPlainText } from './rich-text';
import type { EditorDocument } from './types';

export type CinemaShotPatch = Partial<Pick<CinemaShotRecord,
  'title' | 'description' | 'purpose' | 'framing' | 'cameraMovement' | 'lensMm'
  | 'durationSeconds' | 'audio' | 'risk' | 'continuityNodeIds'>>;

export type CinemaDomainCommand =
  | { type: 'update-shot'; shotId: string; patch: CinemaShotPatch }
  | { type: 'reorder-shot'; shotId: string; toIndex: number }
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
  const next = structuredClone(source);
  const cinema = next.cinema;
  if (!cinema) throw new Error('Cinema project data is missing.');

  if (command.type === 'update-shot') {
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
  next.updatedAt = Date.now();
  return validateEditorDocument(next);
}
