import type { EditorNode, EditorEdge } from './types';
import type { StoryAssistant } from '../domain/cinema/story-assistant';
import { richTextFromPlainText } from './rich-text';
import type { EditorDocument } from './types';
import { editorNodeDimensions } from './node-layout';

/** Reserve the editing rectangle without adding the helper to semantic layout.
 * Only a new node is moved; existing hosts and the user's Assistant stay put. */
export function avoidAssistantOverlap(document: EditorDocument, node: EditorNode, position: { x: number; y: number }, assistantSize?: { width: number; height: number }) {
  const assistant = document.cinema?.storyWorkflow?.assistant;
  if (!assistant) return position;
  const size = editorNodeDimensions(node), gap = 64;
  const obstacles = document.nodes.filter((item) => item.id !== node.id).map((item) => ({ ...item.position, ...editorNodeDimensions(item) }));
  obstacles.push({ ...assistant.position, width: assistantSize?.width ?? 460, height: assistantSize?.height ?? (assistant.collapsed ? 180 : 680) });
  let candidate = { ...position };
  for (let count = 0; count <= obstacles.length; count++) {
    const overlap = obstacles.find((item) => candidate.x < item.x + item.width + gap && candidate.x + size.width + gap > item.x
      && candidate.y < item.y + item.height + gap && candidate.y + size.height + gap > item.y);
    if (!overlap) return candidate;
    candidate = { ...candidate, y: overlap.y + overlap.height + gap };
  }
  return { x: Math.max(...obstacles.map((item) => item.x + item.width)) + gap, y: position.y };
}

/** Helper views never enter the canonical document, outline, SVG or layout inputs. */
export function assistantPlacement(nodes: EditorNode[], source: EditorNode) {
  const width = 460, height = 680, gap = 80;
  let x = source.position.x + Math.max(440, Number(source.width ?? source.style?.width) || 240) + gap;
  let y = source.position.y;
  for (let attempt = 0; attempt <= nodes.length; attempt++) {
    const overlap = nodes.find((node) => x < node.position.x + (Number(node.width ?? node.style?.width) || 280) + gap
      && x + width + gap > node.position.x && y < node.position.y + (Number(node.height ?? node.style?.height) || 180) + gap
      && y + height + gap > node.position.y);
    if (!overlap) return { x, y };
    y = overlap.position.y + (Number(overlap.height ?? overlap.style?.height) || 180) + gap;
  }
  x = Math.max(...nodes.map((node) => node.position.x + (Number(node.width) || 440))) + gap;
  return { x, y: source.position.y };
}
export function projectStoryAssistant(nodes: EditorNode[], assistant?: StoryAssistant, viewHeight?: number, viewWidth = 460): { node: EditorNode; edge: EditorEdge } | null {
  if (!assistant || !nodes.some((node) => node.id === assistant.premiseNodeId) || nodes.some((node) => node.id === assistant.id)) return null;
  // Phase-sized, not input-sized: typing never changes the graph geometry.
  const height = assistant.collapsed ? 180 : viewHeight ?? (assistant.state === 'review' ? 560 : 680);
  return { node: { id: assistant.id, type: 'storyAssistant', position: assistant.position, width: viewWidth, height,
    measured: { width: viewWidth, height }, style: { width: viewWidth, height, visibility: assistant.hidden ? 'hidden' : 'visible' },
    draggable: !nodes.find((node) => node.id === assistant.premiseNodeId)?.data.locked,
    dragHandle: '.layer-drag-handle', selectable: false, connectable: false, deletable: false, focusable: false, zIndex: 90,
    data: { kind: 'concept', domainType: 'ui.story-assistant', name: 'Story Assistant', label: 'Story Assistant',
      title: richTextFromPlainText('Story Assistant'), body: richTextFromPlainText(''), eyebrow: 'Assistant',
      tone: 'indigo', collapsed: false, opacity: 1, locked: true, horizontalAlign: 'left', verticalAlign: 'top' } },
    edge: { id: `${assistant.id}:association`, source: assistant.premiseNodeId, target: assistant.id,
      targetHandle: 'assistant-target', selectable: false, deletable: false,
      hidden: assistant.hidden, style: { stroke: '#8e82cd', strokeDasharray: '6 5' }, data: { label: 'Story assistance', kind: 'dashed', relationship: 'reference' } },
  };
}
