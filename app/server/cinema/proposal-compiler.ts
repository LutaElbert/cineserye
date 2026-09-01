import { MOCK_SHOT_PLAN_PROPOSAL } from '../../domain/cinema/mock/reel-knows-tomorrow';
import type { CinemaProjectDataV1 } from '../../domain/cinema/project-data';
import { richTextFromPlainText } from '../../editor/rich-text';
import type { CanvasCommandProposal } from '../../editor/canvas-commands';

export function compileFixtureCanvasProposal(
  runId: string,
  cinema: CinemaProjectDataV1,
): CanvasCommandProposal {
  const proposal = structuredClone(MOCK_SHOT_PLAN_PROPOSAL);
  proposal.proposalId = `${runId}-canvas-proposal`;
  proposal.summary = 'Create a validated, fixture-backed six-shot prompt package.';
  const scene = cinema.scenes['scene-01'];
  const cost = cinema.costs['cost-scene-01'];

  for (const command of proposal.commands) {
    if (command.type === 'update-node' && command.id === 'story-premise') {
      command.patch.data = {
        ...command.patch.data,
        body: richTextFromPlainText(scene.synopsis),
      };
    }
    if (command.type === 'update-node' && command.id === 'scene-01') {
      const ceiling = cost.ceiling === null
        ? `${scene.brief?.budgetBand ?? 'custom'} budget`
        : `${cost.currency} ${cost.ceiling.toLocaleString('en-US')} ceiling`;
      command.patch.data = {
        ...command.patch.data,
        body: richTextFromPlainText(
          `${scene.brief?.locationPeriod ?? ''} · ${scene.brief?.tone ?? ''} · ${scene.brief?.targetDurationSeconds ?? 36}s · ${ceiling}`,
        ),
      };
    }
    if (command.type === 'create-node') {
      const shot = cinema.shots[command.node.id];
      if (shot && command.node.data.kind === 'concept') {
        command.node.data.body = richTextFromPlainText(
          `${shot.durationSeconds}s · ${shot.framing} · ${shot.risk} risk`,
        );
      }
      if (command.node.id === 'cine-agent-plan' && command.node.data.kind === 'concept') {
        command.node.data.body = richTextFromPlainText(
          `Fixture ready · ${scene.shotIds.length} shots · ${Object.keys(cinema.sources).length} sources`,
        );
      }
    }
  }
  return proposal;
}
