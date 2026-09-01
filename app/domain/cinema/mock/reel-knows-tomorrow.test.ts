import { describe, expect, it } from 'vitest';
import { applyCanvasCommandProposal } from '../../../editor/canvas-commands';
import { initialDocument } from '../../../editor/initial-document';
import { MOCK_SHOT_PLAN_PROPOSAL, REEL_KNOWS_TOMORROW } from './reel-knows-tomorrow';

describe('The Reel That Knows Tomorrow mock project', () => {
  it('contains a resolved 36-second prompt package within the illustrative ceiling', () => {
    expect(REEL_KNOWS_TOMORROW.shotNodeIds).toHaveLength(6);
    expect(REEL_KNOWS_TOMORROW.targetDurationSeconds).toBe(36);
    expect(REEL_KNOWS_TOMORROW.cost.expected).toBeLessThan(REEL_KNOWS_TOMORROW.cost.ceiling!);
    expect(REEL_KNOWS_TOMORROW.cost.highRisk).toBeLessThanOrEqual(REEL_KNOWS_TOMORROW.cost.ceiling!);
    expect(Object.values(REEL_KNOWS_TOMORROW.prompts).filter((prompt) => prompt.purpose === 'video')).toHaveLength(6);
  });

  it('produces one fully validated canvas proposal without mutating the source', () => {
    const source = structuredClone(initialDocument);
    const result = applyCanvasCommandProposal(source, MOCK_SHOT_PLAN_PROPOSAL);

    expect(source.nodes.map((node) => node.id)).toContain('shot-01');
    expect(result.document.nodes.map((node) => node.id)).not.toContain('shot-01');
    expect(result.document.nodes.map((node) => node.id)).toContain('cine-shot-06');
    expect(result.affectedNodeIds).toContain('scene-01');
    expect(result.affectedEdgeIds).toContain('scene-agent-plan');
  });
});
