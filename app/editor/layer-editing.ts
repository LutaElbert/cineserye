import { applyCinemaDomainCommand, type CinemaShotPatch } from './cinema-domain-commands';
import { changeStory, storyPremise } from './story-development-commands';
import { conceptTitleFromPlainText, richTextFromPlainText, richTextToPlainText } from './rich-text';
import { validateEditorDocument } from './document-file';
import type { EditorDocument } from './types';

export function layerEditTarget(document: EditorDocument, id: string) {
  const node = document.nodes.find((node) => node.id === id);
  if (!node || node.data.kind !== 'concept') return null;
  const scene = Object.values(document.cinema?.scenes ?? {}).find((item) => item.nodeId === id);
  const shot = Object.values(document.cinema?.shots ?? {}).find((item) => item.nodeId === id);
  const role = node.data.domainType === 'cinema.story' ? 'story' : shot ? 'shot' : scene ? 'scene'
    : node.data.domainType === 'cinema.scene' ? 'scene' : node.data.domainType === 'cinema.shot' ? 'shot' : null;
  if (!role) return null;
  // Accepted hosts are deliberately geometry-locked by the planning pipeline.
  const generated = !!(scene?.brief || shot);
  return { node, role, scene, shot, readOnly: node.data.locked && !generated,
    title: shot?.title ?? node.data.label, body: shot?.description ?? richTextToPlainText(node.data.body) };
}

export function editLayerText(document: EditorDocument, id: string, patch: { title?: string; body?: string }) {
  const target = layerEditTarget(document, id);
  if (!target || target.readOnly) throw Error('Unlock this layer before editing.');
  if (patch.title !== undefined && (patch.title.length > 500 || /[\r\n]/.test(patch.title))) throw Error('Title must be one line, at most 500 characters.');
  if (patch.body !== undefined && patch.body.length > 20_000) throw Error('Description is too long.');
  if (target.shot) return applyCinemaDomainCommand(document, { type: 'update-shot', shotId: target.shot.id,
    patch: { ...(patch.title === undefined ? {} : { title: patch.title }), ...(patch.body === undefined ? {} : { description: patch.body }) } });
  let next = structuredClone(document);
  const node = next.nodes.find((node) => node.id === id)!;
  if (node.data.kind !== 'concept') throw Error('Layer is unavailable.');
  if (patch.title !== undefined) { node.data.label = patch.title; node.data.name = patch.title; node.data.title = conceptTitleFromPlainText(patch.title); }
  if (patch.body !== undefined) node.data.body = richTextFromPlainText(patch.body);
  if (target.scene) next = applyCinemaDomainCommand(next, { type: 'update-scene', sceneId: target.scene.id,
    patch: { ...(patch.title === undefined ? {} : { title: patch.title }), ...(patch.body === undefined ? {} : { synopsis: patch.body }) } });
  if (target.role === 'story' && next.cinema?.storyWorkflow?.draft && patch.body !== undefined) {
    next = changeStory(next, (workflow) => { workflow.draft!.premise = patch.body!; });
  }
  return validateEditorDocument(next);
}

/** Explicit draft edit only: opening an old document never silently reconciles divergent text. */
export function syncPremiseDraft(document: EditorDocument, premise: string) {
  const story = storyPremise(document);
  return story ? editLayerText(document, story.nodeId, { body: premise }) : document;
}

export function editLayerShot(document: EditorDocument, id: string, patch: CinemaShotPatch) {
  const target = layerEditTarget(document, id);
  if (!target?.shot || target.readOnly) throw Error('This shot is not editable.');
  return applyCinemaDomainCommand(document, { type: 'update-shot', shotId: target.shot.id, patch });
}
