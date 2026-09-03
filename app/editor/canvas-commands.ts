import { validateEditorDocument } from './document-file';
import { connectionIssue, connectionIssueMessage } from './graph-rules';
import type { EditorDocument, EditorEdge, EditorNode } from './types';

const MAX_COMMANDS_PER_PROPOSAL = 100;
const MAX_PROPOSAL_TEXT_LENGTH = 500;

export type CreateNodeCommand = {
  type: 'create-node';
  node: EditorNode;
};

export type UpdateNodeCommand = {
  type: 'update-node';
  id: string;
  patch: Partial<Pick<EditorNode, 'position' | 'style' | 'hidden'>> & {
    data?: Record<string, unknown>;
  };
};

export type ConnectNodesCommand = {
  type: 'connect-nodes';
  edge: EditorEdge;
};

export type UpdateEdgeCommand = {
  type: 'update-edge';
  id: string;
  patch: Partial<Pick<EditorEdge, 'sourceHandle' | 'targetHandle' | 'type'>> & {
    data?: Partial<Pick<NonNullable<EditorEdge['data']>, 'relationship'>>;
  };
};

export type DeleteNodesCommand = {
  type: 'delete-nodes';
  ids: string[];
};

export type CanvasCommand =
  | CreateNodeCommand
  | UpdateNodeCommand
  | ConnectNodesCommand
  | UpdateEdgeCommand
  | DeleteNodesCommand;

export type CanvasCommandProposal = {
  version: 1;
  proposalId: string;
  summary: string;
  commands: CanvasCommand[];
};

export type AppliedCanvasCommandProposal = {
  proposalId: string;
  summary: string;
  document: EditorDocument;
  affectedNodeIds: string[];
  affectedEdgeIds: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PROPOSAL_TEXT_LENGTH) {
    throw new Error(`${label} is missing or too long.`);
  }
  return value;
}

function parseProposal(value: unknown): CanvasCommandProposal {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.commands)) {
    throw new Error('The canvas command proposal is malformed or unsupported.');
  }
  if (value.commands.length === 0 || value.commands.length > MAX_COMMANDS_PER_PROPOSAL) {
    throw new Error(`A canvas command proposal must contain 1 to ${MAX_COMMANDS_PER_PROPOSAL} commands.`);
  }
  return {
    version: 1,
    proposalId: boundedString(value.proposalId, 'Proposal id'),
    summary: boundedString(value.summary, 'Proposal summary'),
    commands: value.commands as CanvasCommand[],
  };
}

function ensureRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} is invalid.`);
  return value;
}

function normalized(document: EditorDocument): EditorDocument {
  return validateEditorDocument(document, { strictGraph: true });
}

/**
 * Applies an untrusted proposal to a cloned document and returns only a fully
 * validated result. The caller can preview this result, then commit it through
 * the editor's normal history path as one undoable transaction.
 */
export function applyCanvasCommandProposal(
  document: EditorDocument,
  untrustedProposal: unknown,
): AppliedCanvasCommandProposal {
  const proposal = parseProposal(untrustedProposal);
  let next = structuredClone(normalized(document));
  const affectedNodeIds = new Set<string>();
  const affectedEdgeIds = new Set<string>();

  for (const rawCommand of proposal.commands) {
    const command = ensureRecord(rawCommand, 'Canvas command');
    switch (command.type) {
      case 'create-node': {
        const rawNode = ensureRecord(command.node, 'Created node');
        const id = boundedString(rawNode.id, 'Created node id');
        if (next.nodes.some((node) => node.id === id)) {
          throw new Error(`A layer with id ${id} already exists.`);
        }
        next.nodes.push(structuredClone(command.node) as EditorNode);
        affectedNodeIds.add(id);
        break;
      }
      case 'update-node': {
        const id = boundedString(command.id, 'Updated node id');
        const patch = ensureRecord(command.patch, 'Node patch');
        const allowedKeys = new Set(['position', 'style', 'hidden', 'data']);
        if (Object.keys(patch).some((key) => !allowedKeys.has(key))) {
          throw new Error('Node patches may only change position, size, visibility, or data.');
        }
        const index = next.nodes.findIndex((node) => node.id === id);
        if (index < 0) throw new Error(`Layer ${id} does not exist.`);
        const current = next.nodes[index];
        if (current.data.locked) throw new Error(`Layer ${id} is locked.`);
        const dataPatch = patch.data === undefined ? undefined : ensureRecord(patch.data, 'Node data patch');
        if (dataPatch?.kind !== undefined && dataPatch.kind !== current.data.kind) {
          throw new Error('A node data patch cannot change its kind.');
        }
        next.nodes[index] = {
          ...current,
          ...(patch.position === undefined ? {} : { position: structuredClone(patch.position) }),
          ...(patch.style === undefined ? {} : { style: structuredClone(patch.style) }),
          ...(patch.hidden === undefined ? {} : { hidden: patch.hidden }),
          ...(dataPatch === undefined ? {} : { data: { ...current.data, ...structuredClone(dataPatch) } }),
        } as EditorNode;
        affectedNodeIds.add(id);
        break;
      }
      case 'connect-nodes': {
        const rawEdge = ensureRecord(command.edge, 'Created connector');
        const id = boundedString(rawEdge.id, 'Created connector id');
        const source = boundedString(rawEdge.source, 'Connector source');
        const target = boundedString(rawEdge.target, 'Connector target');
        const issue = connectionIssue(next.nodes, next.edges, { source, target });
        if (issue) throw new Error(connectionIssueMessage(issue));
        next.edges.push(structuredClone(command.edge) as EditorEdge);
        affectedNodeIds.add(source);
        affectedNodeIds.add(target);
        affectedEdgeIds.add(id);
        break;
      }
      case 'update-edge': {
        const id = boundedString(command.id, 'Updated connector id');
        const patch = ensureRecord(command.patch, 'Connector patch');
        const allowedKeys = new Set(['sourceHandle', 'targetHandle', 'type', 'data']);
        if (Object.keys(patch).some((key) => !allowedKeys.has(key))) {
          throw new Error('Connector patches may only change handles, routing type, or relationship metadata.');
        }
        const index = next.edges.findIndex((edge) => edge.id === id);
        if (index < 0) throw new Error(`Connector ${id} does not exist.`);
        const current = next.edges[index];
        const sourceNode = next.nodes.find((node) => node.id === current.source);
        const targetNode = next.nodes.find((node) => node.id === current.target);
        if (!sourceNode || !targetNode) throw new Error(`Connector ${id} has a missing endpoint.`);
        if (sourceNode.data.locked || targetNode.data.locked) throw new Error(`Connector ${id} has a locked endpoint.`);
        const dataPatch = patch.data === undefined ? undefined : ensureRecord(patch.data, 'Connector data patch');
        if (dataPatch && (Object.keys(dataPatch).some((key) => key !== 'relationship')
          || !['hierarchy', 'reference', 'sequence'].includes(String(dataPatch.relationship)))) {
          throw new Error('Connector relationship metadata is invalid.');
        }
        if (patch.type !== undefined && patch.type !== 'smoothstep') {
          throw new Error('Connector routing type is invalid.');
        }
        for (const handle of [patch.sourceHandle, patch.targetHandle]) {
          if (handle !== undefined && handle !== 'bottom' && handle !== 'top' && handle !== 'left' && handle !== 'right') {
            throw new Error('Connector handle is invalid.');
          }
        }
        const nextData: EditorEdge['data'] = dataPatch === undefined
          ? current.data
          : {
            ...(current.data ?? { label: '', kind: 'default' }),
            relationship: dataPatch.relationship as NonNullable<EditorEdge['data']>['relationship'],
          };
        next.edges[index] = {
          ...current,
          ...(patch.sourceHandle === undefined ? {} : { sourceHandle: String(patch.sourceHandle) }),
          ...(patch.targetHandle === undefined ? {} : { targetHandle: String(patch.targetHandle) }),
          ...(patch.type === undefined ? {} : { type: patch.type as EditorEdge['type'] }),
          ...(nextData === undefined ? {} : { data: nextData }),
        };
        affectedNodeIds.add(current.source);
        affectedNodeIds.add(current.target);
        affectedEdgeIds.add(id);
        break;
      }
      case 'delete-nodes': {
        if (!Array.isArray(command.ids) || command.ids.length === 0) {
          throw new Error('Delete nodes requires at least one layer id.');
        }
        const ids = new Set(command.ids.map((id) => boundedString(id, 'Deleted node id')));
        for (const id of ids) {
          const node = next.nodes.find((candidate) => candidate.id === id);
          if (!node) throw new Error(`Layer ${id} does not exist.`);
          if (node.data.locked) throw new Error(`Layer ${id} is locked.`);
          affectedNodeIds.add(id);
        }
        for (const edge of next.edges) {
          if (ids.has(edge.source) || ids.has(edge.target)) affectedEdgeIds.add(edge.id);
        }
        next.nodes = next.nodes.filter((node) => !ids.has(node.id));
        next.edges = next.edges.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target));
        break;
      }
      default:
        throw new Error('The proposal contains an unsupported canvas command.');
    }
    next.updatedAt = Date.now();
    next = normalized(next);
  }

  return {
    proposalId: proposal.proposalId,
    summary: proposal.summary,
    document: next,
    affectedNodeIds: [...affectedNodeIds],
    affectedEdgeIds: [...affectedEdgeIds],
  };
}
