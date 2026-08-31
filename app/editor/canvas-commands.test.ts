import { MarkerType } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { applyCanvasCommandProposal } from './canvas-commands';
import { initialDocument } from './initial-document';
import { conceptTitleFromPlainText } from './rich-text';
import type { EditorNode } from './types';

function conceptNode(id: string, label: string): EditorNode {
  return {
    id,
    type: 'concept',
    position: { x: 1_090, y: 210 },
    draggable: true,
    deletable: true,
    data: {
      kind: 'concept',
      name: label,
      label,
      title: conceptTitleFromPlainText(label),
      body: { type: 'doc', content: [{ type: 'paragraph' }] },
      eyebrow: 'Sequence',
      tone: 'ink',
      collapsed: false,
      horizontalAlign: 'left',
      verticalAlign: 'top',
      opacity: 1,
      locked: false,
    },
  };
}

describe('validated canvas command boundary', () => {
  it('applies a batch to a clone and returns a validated atomic result', () => {
    const original = structuredClone(initialDocument);
    const result = applyCanvasCommandProposal(original, {
      version: 1,
      proposalId: 'proposal-1',
      summary: 'Add a second shot',
      commands: [
        { type: 'create-node', node: conceptNode('shot-02', 'Shot 02') },
        {
          type: 'connect-nodes',
          edge: {
            id: 'shot-01-shot-02',
            source: 'shot-01',
            target: 'shot-02',
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
            data: { label: '', kind: 'default' },
          },
        },
      ],
    });

    expect(original.nodes).toHaveLength(3);
    expect(original.edges).toHaveLength(2);
    expect(result.document.nodes.map(({ id }) => id)).toContain('shot-02');
    expect(result.document.edges.map(({ id }) => id)).toContain('shot-01-shot-02');
    expect(result.affectedNodeIds).toEqual(['shot-02', 'shot-01']);
    expect(result.affectedEdgeIds).toEqual(['shot-01-shot-02']);
  });

  it('rejects the entire proposal when a later command violates graph rules', () => {
    const original = structuredClone(initialDocument);
    expect(() => applyCanvasCommandProposal(original, {
      version: 1,
      proposalId: 'proposal-2',
      summary: 'Invalid graph change',
      commands: [
        { type: 'create-node', node: conceptNode('shot-02', 'Shot 02') },
        {
          type: 'connect-nodes',
          edge: {
            id: 'invalid-self-edge',
            source: 'shot-02',
            target: 'shot-02',
            data: { label: '', kind: 'default' },
          },
        },
      ],
    })).toThrow('cannot connect to itself');
    expect(original.nodes.map(({ id }) => id)).not.toContain('shot-02');
  });

  it('rejects unsupported commands and mutations of locked layers', () => {
    const locked = structuredClone(initialDocument);
    locked.nodes[0].data.locked = true;
    expect(() => applyCanvasCommandProposal(locked, {
      version: 1,
      proposalId: 'proposal-3',
      summary: 'Rewrite premise',
      commands: [{
        type: 'update-node',
        id: 'story-premise',
        patch: { data: { name: 'Changed' } },
      }],
    })).toThrow('locked');

    expect(() => applyCanvasCommandProposal(initialDocument, {
      version: 1,
      proposalId: 'proposal-4',
      summary: 'Unknown action',
      commands: [{ type: 'call-provider' }],
    })).toThrow('unsupported canvas command');
  });
});
