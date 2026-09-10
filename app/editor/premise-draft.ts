import type { StoryWorkflowData } from '../domain/cinema/story-workflow';
import { changeStory, storyPremise } from './story-development-commands';
import { layerEditTarget, syncPremiseDraft } from './layer-editing';
import type { EditorDocument } from './types';

export type PremiseDraft = NonNullable<StoryWorkflowData['draft']>;
export function initialPremiseDraft(document: EditorDocument): PremiseDraft {
  return { mode: 'expand', premise: storyPremise(document)?.text ?? '', answers: [],
    anchorSceneId: document.cinema?.sceneOrder.at(-1) ?? null, durationSeconds: null,
    aspectRatio: null, tone: '', ending: '', constraints: [] };
}

/** Only explicit edits create/synchronize a draft. Inspecting a layer is read-only. */
export function editPremiseDraft(document: EditorDocument, nodeId: string, patch: Partial<PremiseDraft>) {
  const target = layerEditTarget(document, nodeId);
  if (target?.role !== 'story' || target.readOnly) throw Error('Unlock this story before editing.');
  if (storyPremise(document)?.nodeId !== nodeId) throw Error('This project has one story workflow. Open its original premise to develop it.');
  let next = changeStory(document, (data) => { data.draft = { ...(data.draft ?? initialPremiseDraft(document)), ...patch }; });
  if (patch.premise !== undefined) next = syncPremiseDraft(next, patch.premise);
  return next;
}
