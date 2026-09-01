import { MarkerType } from '@xyflow/react';
import type { CanvasCommandProposal } from '../../../editor/canvas-commands';
import { conceptTitleFromPlainText, richTextFromPlainText } from '../../../editor/rich-text';
import type { EditorEdge, EditorNode } from '../../../editor/types';
import {
  validateMockCinemaProject,
  type CinemaNodePresentation,
  type PromptArtifact,
} from '../prompt-artifacts';
import {
  validateCinemaProjectData,
  type CinemaProjectDataV1,
} from '../project-data';

const SCENE_DIRECTION = 'Late-1980s Manila cinema, restrained supernatural suspense, vertical 9:16 cinematic realism, amber projector light against cool-blue darkness, subtle film grain, no gore.';
const MARA_CONTINUITY = 'Mara, the same 24-year-old Filipino woman with shoulder-length black hair, a faded blue denim jacket, dark trousers, and a small metal flashlight.';
const CINEMA_CONTINUITY = 'An abandoned single-screen Manila cinema with worn red seats, a blank screen, dusty aisles, peeling walls, and a projection booth centered behind the auditorium.';
const PROJECTOR_CONTINUITY = 'A worn late-1980s 35mm cinema projector with two exposed metal reels, scratched black housing, and a strong warm projection beam.';

const prompts: Record<string, PromptArtifact> = {};

function addPrompt(prompt: PromptArtifact) {
  prompts[prompt.id] = prompt;
  return prompt.id;
}

const scenePromptId = addPrompt({
  id: 'prompt-scene-direction',
  ownerNodeId: 'scene-01',
  label: 'Scene direction',
  purpose: 'scene-direction',
  providerProfile: 'generic',
  generatedText: SCENE_DIRECTION,
  negativeConstraints: ['No gore', 'No crowds', 'No modern equipment', 'No imitation of a named filmmaker'],
  continuitySourceIds: [],
  researchSourceIds: ['source-cinema', 'source-period', 'source-suspense'],
  version: 1,
  status: 'draft',
});

const maraPromptId = addPrompt({
  id: 'prompt-mara-reference',
  ownerNodeId: 'cine-character-mara',
  label: 'Character reference sheet',
  purpose: 'reference-sheet',
  providerProfile: 'generic',
  generatedText: `${MARA_CONTINUITY} Neutral full-body character reference sheet showing front, three-quarter, profile, and back views. Even studio lighting, plain gray background, consistent face, proportions, clothing, and flashlight.`,
  negativeConstraints: ['No alternate wardrobe', 'No dramatic pose', 'No beauty retouching', 'No text labels'],
  continuitySourceIds: [],
  researchSourceIds: ['source-period'],
  version: 1,
  status: 'draft',
});

const cinemaPromptId = addPrompt({
  id: 'prompt-cinema-reference',
  ownerNodeId: 'cine-asset-cinema',
  label: 'Location reference',
  purpose: 'reference-sheet',
  providerProfile: 'generic',
  generatedText: `${CINEMA_CONTINUITY} Empty location reference showing the screen, central aisle, side aisles, rows of seats, and projection booth geography. Realistic late-1980s materials, amber practical light and cool ambient darkness.`,
  negativeConstraints: ['No people', 'No modern LED fixtures', 'No luxury multiplex details', 'No readable branding'],
  continuitySourceIds: [],
  researchSourceIds: ['source-cinema', 'source-period'],
  version: 1,
  status: 'draft',
});

const projectorPromptId = addPrompt({
  id: 'prompt-projector-reference',
  ownerNodeId: 'cine-asset-projector',
  label: 'Hero prop reference',
  purpose: 'reference-sheet',
  providerProfile: 'generic',
  generatedText: `${PROJECTOR_CONTINUITY} Isolated hero-prop turnaround with front, side, rear, reel, and lamp-house details. Neutral background and even reference lighting.`,
  negativeConstraints: ['No digital controls', 'No modern plastic housing', 'No text labels'],
  continuitySourceIds: [],
  researchSourceIds: ['source-projector'],
  version: 1,
  status: 'draft',
});

const flashlightPromptId = addPrompt({
  id: 'prompt-flashlight-reference',
  ownerNodeId: 'cine-asset-flashlight',
  label: 'Prop reference',
  purpose: 'reference-sheet',
  providerProfile: 'generic',
  generatedText: 'Small period-appropriate brushed-metal flashlight with a narrow warm beam, mild scratches, simple switch, and no visible branding. Isolated prop reference on a neutral background.',
  negativeConstraints: ['No modern tactical flashlight', 'No LED ring', 'No branding'],
  continuitySourceIds: [],
  researchSourceIds: ['source-period'],
  version: 1,
  status: 'draft',
});

const shadowPromptId = addPrompt({
  id: 'prompt-shadow-reference',
  ownerNodeId: 'cine-asset-shadow',
  label: 'Visual element reference',
  purpose: 'reference-sheet',
  providerProfile: 'generic',
  generatedText: 'An indistinct human shadow figure visible only inside grainy projected film. Tall, narrow silhouette, stable proportions, no facial detail, no visible clothing texture, threatening through stillness rather than gore.',
  negativeConstraints: ['No visible face', 'No monster anatomy', 'No gore', 'Never outside the projected image'],
  continuitySourceIds: [],
  researchSourceIds: ['source-suspense'],
  version: 1,
  status: 'draft',
});

type ShotSeed = {
  id: string;
  title: string;
  duration: number;
  purpose: string;
  framing: string;
  movement: string;
  risk: Exclude<CinemaNodePresentation['risk'], 'none'>;
  dependencies: string[];
  action: string;
  audio: string;
  minimum: number;
  expected: number;
  highRisk: number;
};

const shots: ShotSeed[] = [
  {
    id: 'cine-shot-01', title: 'Entering the Auditorium', duration: 6,
    purpose: 'Establish Mara, the cinema geography, and her isolation.',
    framing: 'Wide vertical', movement: 'Slow controlled push-in', risk: 'low',
    dependencies: ['cine-character-mara', 'cine-asset-cinema', 'cine-asset-flashlight'],
    action: 'Mara enters through the rear auditorium doors and scans the empty rows with her flashlight.',
    audio: 'Distant traffic, soft footsteps, weak electrical hum.', minimum: 55, expected: 100, highRisk: 135,
  },
  {
    id: 'cine-shot-02', title: 'Projector Awakens', duration: 5,
    purpose: 'Introduce the supernatural event through the hero prop.',
    framing: 'Extreme close-up', movement: 'Subtle handheld drift', risk: 'medium',
    dependencies: ['cine-asset-projector', 'cine-asset-cinema'],
    action: 'The dormant projector shudders, switches on by itself, and its reels gradually begin spinning.',
    audio: 'Mechanical click, reel chatter, bulb ignition.', minimum: 50, expected: 105, highRisk: 150,
  },
  {
    id: 'cine-shot-03', title: 'The Impossible Film', duration: 7,
    purpose: 'Reveal that the projected film shows Mara entering moments earlier.',
    framing: 'Over the shoulder', movement: 'Nearly static creeping push', risk: 'high',
    dependencies: ['cine-character-mara', 'cine-asset-cinema', 'cine-asset-projector'],
    action: 'Mara faces the screen, which displays grainy footage of the same Mara entering the same auditorium.',
    audio: 'Projector chatter grows louder; low tonal pulse begins.', minimum: 85, expected: 185, highRisk: 270,
  },
  {
    id: 'cine-shot-04', title: 'Someone Behind Her', duration: 6,
    purpose: 'Show Mara noticing the figure behind her projected self.',
    framing: 'Medium close-up', movement: 'Slow push toward Mara', risk: 'medium',
    dependencies: ['cine-character-mara', 'cine-asset-cinema', 'cine-asset-shadow'],
    action: 'Projector light crosses Mara’s face as her eyes lock on a motionless figure appearing behind her screen image.',
    audio: 'Breath catches; low pulse continues.', minimum: 65, expected: 135, highRisk: 180,
  },
  {
    id: 'cine-shot-05', title: 'Empty Auditorium', duration: 5,
    purpose: 'Confirm that nobody is physically standing behind Mara.',
    framing: 'Medium whip turn', movement: 'Fast controlled pan', risk: 'low',
    dependencies: ['cine-character-mara', 'cine-asset-cinema', 'cine-asset-flashlight'],
    action: 'Mara turns and sweeps her flashlight across empty rows of worn red seats.',
    audio: 'Clothing movement, flashlight grip, projector continues off-screen.', minimum: 50, expected: 100, highRisk: 135,
  },
  {
    id: 'cine-shot-06', title: 'The Figure Moves Closer', duration: 7,
    purpose: 'Deliver the final reveal without showing a physical second character.',
    framing: 'Screen insert', movement: 'Slow zoom into projection', risk: 'high',
    dependencies: ['cine-character-mara', 'cine-asset-cinema', 'cine-asset-projector', 'cine-asset-shadow'],
    action: 'The screen now shows the shadow figure directly behind projected Mara while the real foreground remains soft and still.',
    audio: 'Reel chatter stops abruptly at the cut.', minimum: 125, expected: 195, highRisk: 270,
  },
];

function shotPrompt(seed: ShotSeed): string {
  const dependencyText = [
    seed.dependencies.includes('cine-character-mara') ? MARA_CONTINUITY : '',
    seed.dependencies.includes('cine-asset-cinema') ? CINEMA_CONTINUITY : '',
    seed.dependencies.includes('cine-asset-projector') ? PROJECTOR_CONTINUITY : '',
  ].filter(Boolean).join(' ');
  return `${SCENE_DIRECTION} ${dependencyText} ${seed.framing} shot. ${seed.action} ${seed.movement}. ${seed.duration}-second shot. Audio: ${seed.audio}`;
}

for (const shot of shots) {
  addPrompt({
    id: `prompt-${shot.id}-storyboard`,
    ownerNodeId: shot.id,
    label: 'Storyboard prompt',
    purpose: 'storyboard',
    providerProfile: 'generic',
    generatedText: `${shotPrompt(shot)} Create one decisive reference frame that communicates the shot purpose: ${shot.purpose}`,
    negativeConstraints: ['No captions', 'No split screen', 'No extra characters', 'No modern equipment'],
    continuitySourceIds: shot.dependencies,
    researchSourceIds: ['source-cinema', 'source-suspense'],
    version: 1,
    status: 'draft',
  });
  addPrompt({
    id: `prompt-${shot.id}-video`,
    ownerNodeId: shot.id,
    label: 'Video prompt',
    purpose: 'video',
    providerProfile: 'vertex-veo',
    generatedText: shotPrompt(shot),
    negativeConstraints: ['No subtitles', 'No logos', 'No extra people', 'No continuity changes', 'No gore'],
    continuitySourceIds: shot.dependencies,
    researchSourceIds: ['source-cinema', 'source-period', 'source-suspense'],
    version: 1,
    status: 'draft',
  });
}

const nodes: Record<string, CinemaNodePresentation> = {
  'story-premise': {
    nodeId: 'story-premise', kind: 'story', title: 'The Reel That Knows Tomorrow',
    summary: 'A missing-person search becomes a warning from an impossible film.',
    statusLabel: 'Demo premise', metricLabel: 'Vertical microdrama', risk: 'none',
    fields: [{ label: 'Format', value: '9:16 vertical microdrama' }, { label: 'Audience', value: 'Short-form suspense viewers' }],
    tags: ['supernatural', 'microdrama'], promptIds: [], sourceIds: [],
  },
  'scene-01': {
    nodeId: 'scene-01', kind: 'scene', title: 'Scene 01 · The Abandoned Cinema',
    summary: 'Mara discovers that an old projector is screening her immediate future.',
    statusLabel: 'Ready to plan', metricLabel: '36s · ₱1,200 ceiling', risk: 'medium',
    fields: [
      { label: 'Tone', value: 'Restrained supernatural suspense' },
      { label: 'Location / period', value: 'Manila cinema · late 1980s' },
      { label: 'Format', value: '9:16 vertical' },
      { label: 'Dialogue', value: 'None' },
      { label: 'Budget ceiling', value: '₱1,200' },
    ],
    tags: ['one location', 'one character', 'no dialogue'], promptIds: [scenePromptId],
    sourceIds: ['source-cinema', 'source-period', 'source-suspense'],
  },
  'cine-character-mara': {
    nodeId: 'cine-character-mara', kind: 'character', title: 'Mara',
    summary: 'A restrained, observant protagonist whose stable wardrobe anchors every shot.',
    statusLabel: 'Prompt ready', metricLabel: '1 reference prompt', risk: 'low',
    fields: [{ label: 'Age', value: '24' }, { label: 'Wardrobe', value: 'Faded denim jacket · dark trousers' }, { label: 'Performance', value: 'Restrained and observant' }],
    tags: ['lead', 'continuity anchor'], promptIds: [maraPromptId], sourceIds: ['source-period'],
  },
  'cine-asset-cinema': {
    nodeId: 'cine-asset-cinema', kind: 'asset', title: 'Abandoned Cinema',
    summary: 'The single reusable location establishes all screen, aisle, and projector geography.',
    statusLabel: 'Location', metricLabel: 'Used by 6 shots', risk: 'medium',
    fields: [{ label: 'Category', value: 'Location' }, { label: 'Period', value: 'Late 1980s' }, { label: 'Palette', value: 'Amber and cool blue' }],
    tags: ['location', 'continuity anchor'], promptIds: [cinemaPromptId], sourceIds: ['source-cinema', 'source-period'],
  },
  'cine-asset-projector': {
    nodeId: 'cine-asset-projector', kind: 'asset', title: 'Vintage Projector',
    summary: 'A period-appropriate hero prop that motivates light, sound, and the supernatural event.',
    statusLabel: 'Hero prop', metricLabel: 'Used by 3 shots', risk: 'medium',
    fields: [{ label: 'Category', value: 'Prop' }, { label: 'Continuity', value: 'Two reels · black housing · warm beam' }],
    tags: ['prop', 'period detail'], promptIds: [projectorPromptId], sourceIds: ['source-projector'],
  },
  'cine-asset-flashlight': {
    nodeId: 'cine-asset-flashlight', kind: 'asset', title: 'Metal Flashlight',
    summary: 'A practical period prop that motivates Mara’s light and gives her a stable physical action.',
    statusLabel: 'Prop', metricLabel: 'Used by 2 shots', risk: 'low',
    fields: [{ label: 'Category', value: 'Prop' }, { label: 'Continuity', value: 'Brushed metal · narrow warm beam' }],
    tags: ['prop', 'motivated light'], promptIds: [flashlightPromptId], sourceIds: ['source-period'],
  },
  'cine-asset-shadow': {
    nodeId: 'cine-asset-shadow', kind: 'asset', title: 'Shadow Figure',
    summary: 'A faceless visual element restricted to the projected image to reduce generation complexity.',
    statusLabel: 'Visual element', metricLabel: 'Used by 2 shots', risk: 'high',
    fields: [{ label: 'Category', value: 'Visual element' }, { label: 'Continuity', value: 'Tall silhouette · no face · projection only' }],
    tags: ['threat', 'budget decision'], promptIds: [shadowPromptId], sourceIds: ['source-suspense'],
  },
  'cine-agent-plan': {
    nodeId: 'cine-agent-plan', kind: 'agent-run', title: 'Research + Shot Planning',
    summary: 'Mock Parallel research and structured scene planning produced a six-shot prompt package.',
    statusLabel: 'Mock complete', metricLabel: '6 shots · 5 sources', risk: 'none',
    fields: [{ label: 'Research posture', value: 'Cautious research partner' }, { label: 'Planning posture', value: 'Collaborative cinematographer' }, { label: 'Decision posture', value: 'Decisive assistant director' }],
    tags: ['mock run', 'no network'], promptIds: [], sourceIds: ['source-cinema', 'source-period', 'source-projector', 'source-suspense', 'source-vertical'],
  },
};

for (const shot of shots) {
  nodes[shot.id] = {
    nodeId: shot.id,
    kind: 'shot',
    title: shot.title,
    summary: shot.purpose,
    statusLabel: 'Prompts ready',
    metricLabel: `${shot.duration}s · ${shot.framing} · ${shot.risk} risk`,
    risk: shot.risk,
    fields: [
      { label: 'Duration', value: `${shot.duration}s` },
      { label: 'Framing', value: shot.framing },
      { label: 'Movement', value: shot.movement },
      { label: 'Action', value: shot.action },
      { label: 'Audio', value: shot.audio },
      { label: 'Dependencies', value: shot.dependencies.map((id) => nodes[id]?.title ?? id).join(' · ') },
    ],
    tags: ['video prompt', `${shot.dependencies.length} dependencies`],
    promptIds: [`prompt-${shot.id}-storyboard`, `prompt-${shot.id}-video`],
    sourceIds: ['source-cinema', 'source-suspense'],
    cost: {
      pricingMode: 'currency', currency: 'PHP', minimum: shot.minimum,
      expected: shot.expected, highRisk: shot.highRisk, isIllustrative: true,
    },
  };
}

function sampleSource(
  id: string,
  title: string,
  finding: string,
  status: 'supported' | 'needs-verification',
) {
  return {
    id,
    title,
    publisher: 'Sample research result',
    finding,
    status,
    creatorPinned: false,
    isMock: true,
    url: null,
    queryPurpose: 'Local deterministic demonstration fixture',
    retrievedAt: '2026-09-01T00:00:00.000Z',
    usageCount: 0,
  } as const;
}

export const REEL_KNOWS_TOMORROW = validateMockCinemaProject({
  id: 'mock-reel-knows-tomorrow',
  title: 'The Reel That Knows Tomorrow',
  sceneNodeId: 'scene-01',
  targetDurationSeconds: 36,
  shotNodeIds: shots.map((shot) => shot.id),
  nodes,
  prompts,
  sources: {
    'source-cinema': sampleSource('source-cinema', 'Historic Manila cinema interiors', 'Single-screen auditorium geography and worn seat rows provide clear spatial anchors.', 'supported'),
    'source-period': sampleSource('source-period', 'Late-1980s Philippine material culture', 'Wardrobe, flashlight, and interior details should avoid contemporary visual cues.', 'supported'),
    'source-projector': sampleSource('source-projector', '35mm projector component reference', 'Exposed reels, lamp housing, and mechanical sound make the prop readable in close-up.', 'needs-verification'),
    'source-suspense': sampleSource('source-suspense', 'Negative space in suspense cinematography', 'Empty vertical space behind the subject can carry threat without revealing a second performer.', 'supported'),
    'source-vertical': sampleSource('source-vertical', 'Vertical dramatic composition', 'Cinema aisles and projection beams create strong depth cues inside a 9:16 frame.', 'needs-verification'),
  },
  cost: {
    pricingMode: 'currency', currency: 'PHP', minimum: 430, expected: 820, highRisk: 1140,
    ceiling: 1200, isIllustrative: true, assumptionProfileVersion: 1,
    provider: 'sample-cost-profile', model: 'sample-v1', resolution: '9:16',
    outputCount: 6, retryAllowance: 1, pricingSnapshotDate: null,
    assumptions: ['Six planned video shots', 'Two attempts for normal shots', 'Three to four attempts for projection shots', 'Storyboard reference generation included'],
  },
});

function conceptNode(
  id: string,
  title: string,
  eyebrow: string,
  body: string,
  tone: 'ink' | 'indigo' | 'mint',
  position: { x: number; y: number },
): EditorNode {
  return {
    id,
    type: 'concept',
    position,
    style: { width: 250, height: 88 },
    draggable: false,
    deletable: false,
    data: {
      kind: 'concept', name: title, label: title, title: conceptTitleFromPlainText(title),
      body: richTextFromPlainText(body), eyebrow, tone, collapsed: false,
      horizontalAlign: 'left', verticalAlign: 'top', opacity: 1, locked: false,
    },
  };
}

function edge(id: string, source: string, target: string): EditorEdge {
  return {
    id, source, target, type: 'smoothstep', animated: false,
    style: { stroke: '#a9adb7', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { label: '', kind: 'default' },
  };
}

const createdNodes: EditorNode[] = [
  conceptNode('cine-agent-plan', 'Research + Shot Planning', 'Agent run', 'Mock complete · 6 shots · 5 sources', 'indigo', { x: 740, y: 20 }),
  conceptNode('cine-character-mara', 'Mara', 'Character', 'Lead · continuity anchor', 'mint', { x: 740, y: 140 }),
  conceptNode('cine-asset-cinema', 'Abandoned Cinema', 'Location', 'Used by 6 shots', 'ink', { x: 740, y: 260 }),
  conceptNode('cine-asset-projector', 'Vintage Projector', 'Hero prop', 'Used by 3 shots', 'ink', { x: 740, y: 380 }),
  conceptNode('cine-asset-flashlight', 'Metal Flashlight', 'Prop', 'Used by 2 shots', 'ink', { x: 740, y: 500 }),
  conceptNode('cine-asset-shadow', 'Shadow Figure', 'Visual element', 'Projection only · high risk', 'indigo', { x: 740, y: 620 }),
  ...shots.map((shot, index) => conceptNode(
    shot.id,
    `${String(index + 1).padStart(2, '0')} · ${shot.title}`,
    'Shot',
    `${shot.duration}s · ${shot.framing} · ${shot.risk} risk`,
    shot.risk === 'high' ? 'indigo' : 'mint',
    { x: 1_090, y: 20 + index * 120 },
  )),
];

const createdEdges: EditorEdge[] = [
  edge('scene-agent-plan', 'scene-01', 'cine-agent-plan'),
  edge('scene-character-mara', 'scene-01', 'cine-character-mara'),
  edge('scene-asset-cinema', 'scene-01', 'cine-asset-cinema'),
  edge('scene-asset-projector', 'scene-01', 'cine-asset-projector'),
  edge('scene-asset-flashlight', 'scene-01', 'cine-asset-flashlight'),
  edge('scene-asset-shadow', 'scene-01', 'cine-asset-shadow'),
  edge('agent-shot-01', 'cine-agent-plan', 'cine-shot-01'),
  ...shots.slice(1).map((shot, index) => edge(`shot-${index + 1}-shot-${index + 2}`, shots[index].id, shot.id)),
];

const mockRunId = 'cine-agent-plan';
const mockRetrievedAt = '2026-09-01T00:00:00.000Z';
const persistedPrompts = Object.fromEntries(Object.values(prompts).map((prompt) => [prompt.id, {
  id: prompt.id,
  ownerNodeId: prompt.ownerNodeId,
  runId: mockRunId,
  label: prompt.label,
  purpose: prompt.purpose,
  providerProfile: prompt.providerProfile,
  generatedText: prompt.generatedText,
  negativeConstraints: [...prompt.negativeConstraints],
  continuityNodeIds: [...prompt.continuitySourceIds],
  researchSourceIds: [...prompt.researchSourceIds],
  version: prompt.version,
  status: prompt.status,
}]));
const persistedSources = Object.fromEntries(Object.values(REEL_KNOWS_TOMORROW.sources).map((source) => [source.id, {
  id: source.id,
  runId: mockRunId,
  title: source.title,
  publisher: source.publisher,
  url: null,
  finding: source.finding,
  queryPurpose: 'Local deterministic demonstration fixture',
  status: source.status,
  creatorPinned: source.creatorPinned,
  isMock: true,
  retrievedAt: mockRetrievedAt,
}]));

const mockCinemaProjectData: CinemaProjectDataV1 = {
  schemaVersion: 1,
  projectNodeId: 'story-premise',
  activeSceneId: 'scene-01',
  sceneOrder: ['scene-01'],
  scenes: {
    'scene-01': {
      id: 'scene-01',
      nodeId: 'scene-01',
      title: 'Scene 01 · The Abandoned Cinema',
      synopsis: 'Mara discovers that an old projector is screening her immediate future.',
      dramaticPurpose: 'Reveal an impossible warning and end on an escalating supernatural threat.',
      status: 'draft',
      continuityNotes: 'Keep the auditorium geography, projector position, wardrobe, and projection-only shadow consistent.',
      brief: {
        version: 2,
        creationMode: 'ai-generated',
        aspectRatio: '9:16',
        targetPlatform: 'short-form',
        genreTone: 'Restrained supernatural suspense',
        locationPeriod: 'Manila single-screen cinema · late 1980s',
        dialogueAudioIntent: 'sound-design-led',
        targetDurationSeconds: 36,
        requiredBeats: ['Projector awakens', 'Mara sees her immediate future', 'The figure moves closer'],
        mustInclude: ['Vintage projector', 'Metal flashlight'],
        mustAvoid: ['Gore', 'Modern equipment'],
        generationBudget: { pricingMode: 'currency', currency: 'PHP', ceiling: 1_200, maxAttempts: 2 },
        productionConstraints: {
          budgetBand: 'micro',
          currency: 'PHP',
          budgetCeiling: null,
          availableEquipment: ['Phone or compact cinema camera', 'Tripod', 'One practical flashlight'],
        },
      },
      shotIds: shots.map((shot) => shot.id),
    },
  },
  shots: Object.fromEntries(shots.map((shot, index) => [shot.id, {
    id: shot.id,
    nodeId: shot.id,
    sceneId: 'scene-01',
    order: index + 1,
    title: shot.title,
    description: shot.action,
    purpose: shot.purpose,
    framing: shot.framing,
    cameraMovement: shot.movement,
    lensMm: null,
    durationSeconds: shot.duration,
    audio: shot.audio,
    risk: shot.risk,
    continuityNodeIds: [...shot.dependencies],
    generationStatus: 'planned',
  }])),
  characters: {
    'cine-character-mara': {
      id: 'cine-character-mara',
      nodeId: 'cine-character-mara',
      sceneIds: ['scene-01'],
      title: 'Mara',
      summary: 'A restrained, observant protagonist whose stable wardrobe anchors every shot.',
      appearanceReference: MARA_CONTINUITY,
      voiceReference: 'No dialogue in this scene.',
      wardrobeNotes: 'Faded blue denim jacket and dark trousers.',
    },
  },
  assets: {
    'cine-asset-cinema': {
      id: 'cine-asset-cinema', nodeId: 'cine-asset-cinema', sceneIds: ['scene-01'], title: 'Abandoned Cinema',
      category: 'location', summary: 'A reusable single-screen cinema location.', continuityNotes: CINEMA_CONTINUITY,
      source: 'planned', uri: '', provenance: 'Mock cited research fixture',
    },
    'cine-asset-projector': {
      id: 'cine-asset-projector', nodeId: 'cine-asset-projector', sceneIds: ['scene-01'], title: 'Vintage Projector',
      category: 'prop', summary: 'The period hero prop that triggers the supernatural event.', continuityNotes: PROJECTOR_CONTINUITY,
      source: 'planned', uri: '', provenance: 'Mock cited research fixture',
    },
    'cine-asset-flashlight': {
      id: 'cine-asset-flashlight', nodeId: 'cine-asset-flashlight', sceneIds: ['scene-01'], title: 'Metal Flashlight',
      category: 'prop', summary: 'Mara’s practical motivated light.', continuityNotes: 'Small brushed-metal body and narrow warm beam.',
      source: 'planned', uri: '', provenance: 'Mock cited research fixture',
    },
    'cine-asset-shadow': {
      id: 'cine-asset-shadow', nodeId: 'cine-asset-shadow', sceneIds: ['scene-01'], title: 'Shadow Figure',
      category: 'visual-element', summary: 'A faceless threat visible only in the projected image.',
      continuityNotes: 'Tall narrow silhouette, no facial detail, never physically present in the auditorium.',
      source: 'planned', uri: '', provenance: 'Mock cited research fixture',
    },
  },
  agentRuns: {
    [mockRunId]: {
      id: mockRunId,
      nodeId: mockRunId,
      sceneId: 'scene-01',
      status: 'accepted',
      summary: 'Fixture-backed research and six-shot planning package.',
      proposedCommandCount: createdNodes.length + createdEdges.length + 3,
      researchProvider: 'fixture',
      planningProvider: 'fixture',
      model: 'fixture-v1',
      sourceIds: Object.keys(persistedSources),
      promptIds: Object.keys(persistedPrompts),
      warnings: ['Costs are illustrative generation estimates, not production quotes.'],
      startedAt: mockRetrievedAt,
      completedAt: mockRetrievedAt,
    },
  },
  prompts: persistedPrompts,
  sources: persistedSources,
  costs: {
    'cost-scene-01': {
      id: 'cost-scene-01', runId: mockRunId, sceneId: 'scene-01',
      pricingMode: REEL_KNOWS_TOMORROW.cost.pricingMode,
      currency: REEL_KNOWS_TOMORROW.cost.currency,
      minimum: REEL_KNOWS_TOMORROW.cost.minimum,
      expected: REEL_KNOWS_TOMORROW.cost.expected,
      highRisk: REEL_KNOWS_TOMORROW.cost.highRisk,
      ceiling: REEL_KNOWS_TOMORROW.cost.ceiling,
      isIllustrative: true,
      assumptionProfileVersion: 1,
      provider: REEL_KNOWS_TOMORROW.cost.provider,
      model: REEL_KNOWS_TOMORROW.cost.model,
      resolution: REEL_KNOWS_TOMORROW.cost.resolution,
      outputCount: REEL_KNOWS_TOMORROW.cost.outputCount,
      retryAllowance: REEL_KNOWS_TOMORROW.cost.retryAllowance,
      pricingSnapshotDate: REEL_KNOWS_TOMORROW.cost.pricingSnapshotDate,
      assumptions: [...REEL_KNOWS_TOMORROW.cost.assumptions],
    },
  },
};

export const MOCK_CINEMA_PROJECT_DATA = validateCinemaProjectData(
  mockCinemaProjectData,
  new Set(['story-premise', 'scene-01', ...createdNodes.map((node) => node.id)]),
);

export const MOCK_SHOT_PLAN_PROPOSAL: CanvasCommandProposal = {
  version: 1,
  proposalId: 'mock-shot-plan-reel-knows-tomorrow-v1',
  summary: 'Create a prompt-first six-shot plan with reusable character and asset references.',
  commands: [
    { type: 'delete-nodes', ids: ['shot-01'] },
    {
      type: 'update-node', id: 'story-premise', patch: {
        position: { x: 80, y: 330 },
        data: {
          name: REEL_KNOWS_TOMORROW.title,
          label: REEL_KNOWS_TOMORROW.title,
          title: conceptTitleFromPlainText(REEL_KNOWS_TOMORROW.title),
          body: richTextFromPlainText('Mara searches an abandoned cinema and discovers a film that is screening her immediate future.'),
          eyebrow: 'Story premise', tone: 'indigo',
        },
      },
    },
    {
      type: 'update-node', id: 'scene-01', patch: {
        position: { x: 400, y: 330 },
        data: {
          name: 'Scene 01 · The Abandoned Cinema',
          label: 'Scene 01 · The Abandoned Cinema',
          title: conceptTitleFromPlainText('Scene 01 · The Abandoned Cinema'),
          body: richTextFromPlainText('One location · no dialogue · 36 seconds · ₱1,200 ceiling'),
          eyebrow: 'Scene', tone: 'ink',
        },
      },
    },
    ...createdNodes.map((node) => ({ type: 'create-node' as const, node })),
    ...createdEdges.map((createdEdge) => ({ type: 'connect-nodes' as const, edge: createdEdge })),
    ...createdNodes.map((node) => ({
      type: 'update-node' as const,
      id: node.id,
      patch: { data: { locked: true } },
    })),
  ],
};
