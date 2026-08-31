import {
  createNodeExtensionCatalog,
  type NodeExtensionDescriptor,
} from '../../editor/node-extension';
import type {
  AgentRunNodeModel,
  AssetNodeModel,
  CharacterNodeModel,
  CinemaNodeKind,
  CinemaNodeModel,
  SceneNodeModel,
  ShotNodeModel,
} from './models';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function hasBase(value: unknown, kind: CinemaNodeKind): value is Record<string, unknown> {
  return isRecord(value)
    && value.schemaVersion === 1
    && value.kind === kind
    && isString(value.title);
}

function isScene(value: unknown): value is SceneNodeModel {
  return hasBase(value, 'scene')
    && isString(value.synopsis)
    && isString(value.dramaticPurpose)
    && (value.status === 'outline' || value.status === 'draft' || value.status === 'locked')
    && isFiniteNonNegative(value.estimatedDurationSeconds)
    && isString(value.continuityNotes);
}

function isShot(value: unknown): value is ShotNodeModel {
  return hasBase(value, 'shot')
    && isString(value.sceneId)
    && isString(value.description)
    && isString(value.framing)
    && isString(value.cameraMovement)
    && (value.lensMm === null || isFiniteNonNegative(value.lensMm))
    && isFiniteNonNegative(value.durationSeconds)
    && (
      value.generationStatus === 'not-requested'
      || value.generationStatus === 'planned'
      || value.generationStatus === 'ready'
      || value.generationStatus === 'failed'
    );
}

function isCharacter(value: unknown): value is CharacterNodeModel {
  return hasBase(value, 'character')
    && isString(value.summary)
    && isString(value.appearanceReference)
    && isString(value.voiceReference)
    && isString(value.wardrobeNotes);
}

function isAsset(value: unknown): value is AssetNodeModel {
  return hasBase(value, 'asset')
    && (value.assetType === 'image' || value.assetType === 'video' || value.assetType === 'audio' || value.assetType === 'script')
    && (value.source === 'local' || value.source === 'generated' || value.source === 'external')
    && isString(value.uri)
    && isString(value.provenance);
}

function isAgentRun(value: unknown): value is AgentRunNodeModel {
  return hasBase(value, 'agent-run')
    && (
      value.status === 'proposed'
      || value.status === 'accepted'
      || value.status === 'running'
      || value.status === 'completed'
      || value.status === 'failed'
      || value.status === 'cancelled'
    )
    && isString(value.summary)
    && Number.isInteger(value.proposedCommandCount)
    && isFiniteNonNegative(value.proposedCommandCount)
    && (value.startedAt === null || isString(value.startedAt))
    && (value.completedAt === null || isString(value.completedAt));
}

const planned = <TKind extends CinemaNodeKind, TData extends CinemaNodeModel>(
  kind: TKind,
  displayName: string,
  validateData: (value: unknown) => value is TData,
): NodeExtensionDescriptor<TKind, TData> => ({
  kind,
  displayName,
  schemaVersion: 1,
  status: 'planned',
  validateData,
});

/**
 * These descriptors reserve Cineserye's domain vocabulary without registering
 * renderers or changing the generic editor document schema yet.
 */
export const CINEMA_NODE_EXTENSIONS = createNodeExtensionCatalog([
  planned('scene', 'Scene', isScene),
  planned('shot', 'Shot', isShot),
  planned('character', 'Character', isCharacter),
  planned('asset', 'Asset', isAsset),
  planned('agent-run', 'Agent run', isAgentRun),
] as const);
