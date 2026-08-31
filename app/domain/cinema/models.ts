export const CINEMA_NODE_KINDS = [
  'scene',
  'shot',
  'character',
  'asset',
  'agent-run',
] as const;

export type CinemaNodeKind = (typeof CINEMA_NODE_KINDS)[number];

type CinemaNodeModelBase<TKind extends CinemaNodeKind> = {
  schemaVersion: 1;
  kind: TKind;
  title: string;
};

export type SceneNodeModel = CinemaNodeModelBase<'scene'> & {
  synopsis: string;
  dramaticPurpose: string;
  status: 'outline' | 'draft' | 'locked';
  estimatedDurationSeconds: number;
  continuityNotes: string;
};

export type ShotNodeModel = CinemaNodeModelBase<'shot'> & {
  sceneId: string;
  description: string;
  framing: string;
  cameraMovement: string;
  lensMm: number | null;
  durationSeconds: number;
  generationStatus: 'not-requested' | 'planned' | 'ready' | 'failed';
};

export type CharacterNodeModel = CinemaNodeModelBase<'character'> & {
  summary: string;
  appearanceReference: string;
  voiceReference: string;
  wardrobeNotes: string;
};

export type AssetNodeModel = CinemaNodeModelBase<'asset'> & {
  assetType: 'image' | 'video' | 'audio' | 'script';
  source: 'local' | 'generated' | 'external';
  uri: string;
  provenance: string;
};

export type AgentRunNodeModel = CinemaNodeModelBase<'agent-run'> & {
  status: 'proposed' | 'accepted' | 'running' | 'completed' | 'failed' | 'cancelled';
  summary: string;
  proposedCommandCount: number;
  startedAt: string | null;
  completedAt: string | null;
};

export type CinemaNodeModel =
  | SceneNodeModel
  | ShotNodeModel
  | CharacterNodeModel
  | AssetNodeModel
  | AgentRunNodeModel;
