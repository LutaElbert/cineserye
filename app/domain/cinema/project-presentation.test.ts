import { describe, expect, it } from 'vitest';
import { MOCK_CINEMA_PROJECT_DATA } from './mock/reel-knows-tomorrow';
import { cinemaProjectPresentation } from './project-presentation';

describe('cinemaProjectPresentation', () => {
  it('derives duration, scene constraints, prompt text, sources, and budget from the sidecar', () => {
    const cinema = structuredClone(MOCK_CINEMA_PROJECT_DATA);
    const scene = cinema.scenes['scene-01'];
    scene.brief = {
      ...scene.brief!,
      genreTone: 'Hopeful handheld realism',
      targetDurationSeconds: 42,
      generationBudget: { ...scene.brief!.generationBudget, ceiling: 700 },
    };
    const durations = [7, 6, 8, 7, 6, 8];
    scene.shotIds.forEach((shotId, index) => {
      cinema.shots[shotId].durationSeconds = durations[index];
    });
    cinema.prompts['prompt-cine-shot-01-video'].generatedText = 'A derived provider prompt.';
    cinema.sources['source-cinema'].isMock = false;
    cinema.sources['source-cinema'].url = 'https://example.com/cinema';
    cinema.costs['cost-scene-01'].ceiling = 700;

    const result = cinemaProjectPresentation(cinema);

    expect(result.targetDurationSeconds).toBe(42);
    expect(result.nodes['scene-01'].metricLabel).toContain('42s');
    expect(result.nodes['scene-01'].fields).toContainEqual({
      label: 'Genre / tone',
      value: 'Hopeful handheld realism',
    });
    expect(result.nodes['cine-shot-01'].fields).toContainEqual({ label: 'Duration', value: '7s' });
    expect(result.prompts['prompt-cine-shot-01-video'].generatedText).toBe('A derived provider prompt.');
    expect(result.sources['source-cinema']).toMatchObject({
      isMock: false,
      url: 'https://example.com/cinema',
    });
    expect(result.cost.ceiling).toBe(700);
  });
});
