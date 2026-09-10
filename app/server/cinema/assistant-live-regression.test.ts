import { describe, expect, it } from 'vitest';
import { AssistantCheckpointSchema, questionsFor, resumeAssistant, type AssistantQuestion } from '../../domain/cinema/story-assistant';
import { validateAnalysis } from './story-assistant';
import type { AssistantInput } from '../../features/story-development/assistant-contracts';

const input: AssistantInput = { version: 1, projectId: 'regression', premiseNodeId: 'story-premise',
  premise: 'A 12-second vertical horror and mystery short. Four friends play in one room. No dialogue. All four survive.',
  goal: 'expand', anchorSceneId: null, context: [], explicit: [], references: [], referenceRevision: 0 };
const question: AssistantQuestion = { id: 'ending', field: 'ending', type: 'single-choice', label: 'How do they escape?',
  reason: 'Choose the final beat.', required: false, choices: [{ id: 'win', label: 'They win together', recommended: true }] };
const facts = [
  { field: 'durationSeconds', value: 12, origin: 'prompt', excerpt: '12-second', referenceId: null, referenceVersion: null },
  { field: 'aspectRatio', value: '9:16', origin: 'prompt', excerpt: 'vertical', referenceId: null, referenceVersion: null },
];
const analysis = () => validateAnalysis({ version: 1, facts, conflicts: [], questions: [question] }, input);
const checkpoint = () => { const result = analysis(); return AssistantCheckpointSchema.parse({
  version: 1, projectId: input.projectId, premiseNodeId: input.premiseNodeId, runId: crypto.randomUUID(), sourceDigest: 'a'.repeat(64),
  round: 1, stage: 'needs-input', analysis: result, questions: questionsFor(result, 1), answers: [],
}); };

describe('live-analysis regression: deterministic normalization, not a model-quality eval', () => {
  it('retains omitted literal room/dialogue/survival limits with grounded provenance', () => {
    expect(analysis().facts.find((fact) => fact.field === 'constraints')).toMatchObject({
      value: ['One room', 'No dialogue', 'All four survive'], origin: 'prompt', excerpt: input.premise,
    });
  });
  it('does not duplicate already captured constraints', () => {
    const result = validateAnalysis({ version: 1, facts: [...facts, {
      field: 'constraints', value: ['One room', 'No dialogue', 'All four survive'], origin: 'prompt', excerpt: input.premise, referenceId: null, referenceVersion: null,
    }], conflicts: [] }, input);
    expect(result.facts.find((fact) => fact.field === 'constraints')?.value).toHaveLength(3);
  });
  it.each(['Not in one room.', 'Never in one room.', 'Avoid no dialogue.', 'This is not in one room.',
    'Maybe set it in one room.', 'If it happens in one room, change that.', 'My previous story was in one room.'])(
    'does not turn a negated phrase into a production limit: %s', (premise) => {
      const result = validateAnalysis({ version: 1, facts: [], conflicts: [] }, { ...input, premise });
      expect(result.facts.find((fact) => fact.field === 'constraints')).toMatchObject({ value: ['No restrictions'], origin: 'suggested' });
    });
  it('keeps explicit conflicting overrides visible for confirmation', () => {
    const result = validateAnalysis({ version: 1, facts, conflicts: [] }, { ...input, explicit: [{
      field: 'constraints', value: ['No restrictions'], origin: 'user', excerpt: '', referenceId: null, referenceVersion: null,
    }] });
    expect(result.conflicts).toContain('constraints');
    expect(result.facts.find((fact) => fact.field === 'constraints')).toMatchObject({ origin: 'user', value: ['No restrictions'] });
  });
  it('skips optional questions in one Continue without inventing user answers', () => {
    const result = resumeAssistant(checkpoint(), [], crypto.randomUUID());
    expect(result.stage).toBe('confirmed');
    expect(result.questions).toEqual([]);
    expect(result.answers).toEqual([]);
    expect(result.analysis.facts.find((fact) => fact.field === 'ending')?.origin).toBe('suggested');
    expect(result.analysis.facts.find((fact) => fact.field === 'constraints')?.value).toContain('One room');
  });
  it('retains the explicitly selected option as user-confirmed', () => {
    const prior = checkpoint();
    const result = resumeAssistant(prior, [{ questionId: prior.questions[0].id, value: 'They win together' }], crypto.randomUUID());
    expect(result.stage).toBe('confirmed');
    expect(result.analysis.facts.find((fact) => fact.field === 'ending')).toMatchObject({ value: 'They win together', origin: 'user' });
  });
  it('still blocks missing required questions and does not dismiss unseen optional questions', () => {
    const prior = checkpoint(); prior.questions[0].required = true;
    expect(() => resumeAssistant(prior, [], crypto.randomUUID())).toThrow(/required/);
    const unseen = checkpoint(); unseen.questions = [];
    expect(resumeAssistant(unseen, [], crypto.randomUUID()).questions).toHaveLength(1);
  });
});
