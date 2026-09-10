import { conceptTitleFromPlainText } from './rich-text';
import type { EditorDocument } from './types';

/** An explicit alternative to the legacy three-node starter. No storage or AI. */
export function createStoryStarterDocument(updatedAt = 0): EditorDocument {
  if (!Number.isFinite(updatedAt) || updatedAt < 0) throw new Error('The starter timestamp is invalid.');
  return {
    schemaVersion: 5, title: 'Untitled Cineserye', updatedAt,
    nodes: [{
      id: 'story-premise', type: 'concept', position: { x: 130, y: 210 },
      draggable: true, deletable: true, selected: false,
      data: {
        kind: 'concept', domainType: 'cinema.story', name: 'Story Premise', label: 'Story Premise',
        title: conceptTitleFromPlainText('Story Premise'), body: { type: 'doc', content: [{ type: 'paragraph' }] },
        eyebrow: 'Story', tone: 'indigo', collapsed: false, horizontalAlign: 'left', verticalAlign: 'top', opacity: 1, locked: false,
      },
    }],
    edges: [],
  };
}
