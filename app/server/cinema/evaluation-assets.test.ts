import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type EvalDataset = {
  dataset_version: string;
  agent_version: string;
  scoring_policy: string;
  eval_cases: Array<{
    eval_case_id: string;
    prompt: { role: string; parts: Array<{ text: string }> };
    rubric_groups: Record<string, { rubrics: Array<{ rubric_id: string }> }>;
  }>;
};

describe('Agents CLI evaluation assets', () => {
  it('keeps three versioned, uniquely identified one-scene cases with rubrics', () => {
    const path = resolve(process.cwd(), 'tests/eval/datasets/cineserye-scene-planning.json');
    const dataset = JSON.parse(readFileSync(path, 'utf8')) as EvalDataset;

    expect(dataset).toMatchObject({
      dataset_version: 'cineserye-scene-planning-v1',
      agent_version: 'scene-planner-v1',
      scoring_policy: 'contract-and-production-usefulness-v1',
    });
    expect(dataset.eval_cases).toHaveLength(3);
    expect(new Set(dataset.eval_cases.map((item) => item.eval_case_id)).size).toBe(3);
    for (const item of dataset.eval_cases) {
      expect(item.prompt.role).toBe('user');
      expect(item.prompt.parts[0]?.text).toContain('one');
      expect(item.rubric_groups.production_rubrics.rubrics).toHaveLength(3);
    }
  });

  it('S10-EVAL-01 keeps 18 development cases and six sealed holdout cases separate', () => {
    const load = (name: string) => JSON.parse(readFileSync(
      resolve(process.cwd(), `tests/eval/datasets/${name}`),
      'utf8',
    )) as EvalDataset;
    const development = load('cineserye-agent-readiness-development-traces.json');
    const holdout = load('cineserye-agent-readiness-holdout-traces.json');
    expect(development.eval_cases).toHaveLength(18);
    expect(holdout.eval_cases).toHaveLength(6);
    const allIds = [...development.eval_cases, ...holdout.eval_cases].map((item) => item.eval_case_id);
    expect(new Set(allIds).size).toBe(24);
  });
});
