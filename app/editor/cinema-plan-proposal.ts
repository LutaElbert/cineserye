import type { CinemaProjectData } from '../domain/cinema/project-data';
import type { CanvasCommandProposal } from './canvas-commands';
import type { EditorDocument } from './types';

function activePlanHostIds(cinema: CinemaProjectData | undefined): string[] {
  if (!cinema) return [];
  return [
    ...Object.values(cinema.shots).map((record) => record.nodeId),
    ...Object.values(cinema.characters).map((record) => record.nodeId),
    ...Object.values(cinema.assets).map((record) => record.nodeId),
    ...Object.values(cinema.agentRuns).map((record) => record.nodeId),
  ];
}

/** Replaces only the current accepted plan hosts; story and scene hosts remain stable. */
export function prepareCinemaPlanProposal(
  source: EditorDocument,
  currentCinema: CinemaProjectData | undefined,
  proposal: CanvasCommandProposal,
): CanvasCommandProposal {
  const sourceNodeIds = new Set(source.nodes.map((node) => node.id));
  const replacements = activePlanHostIds(currentCinema).filter((nodeId) => sourceNodeIds.has(nodeId));
  if (!currentCinema && sourceNodeIds.has('shot-01')) replacements.push('shot-01');
  const commands = proposal.commands.filter((command) => command.type !== 'delete-nodes');
  return {
    ...proposal,
    commands: replacements.length
      ? [{ type: 'delete-nodes', ids: [...new Set(replacements)] }, ...commands]
      : commands,
  };
}

/** Proposal preview validates canvas changes independently from the pending replacement sidecar. */
export function cinemaProposalCanvasSource(source: EditorDocument): EditorDocument {
  const canvas = structuredClone(source);
  const replaceableHostIds = new Set(activePlanHostIds(canvas.cinema));
  canvas.nodes = canvas.nodes.map((node) => replaceableHostIds.has(node.id)
    ? {
        ...node,
        draggable: true,
        deletable: true,
        data: { ...node.data, locked: false },
      }
    : node);
  delete canvas.cinema;
  return canvas;
}
