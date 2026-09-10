import { z } from 'zod';
import { StoryGenresSchema, STORY_GENRES } from './story-genres';
import { OperationProvenanceSchema } from './generation-operation';

export const AssistantId = z.string().min(1).max(160).regex(/^[a-zA-Z0-9_.:-]+$/)
  .refine((value) => !['__proto__', 'constructor', 'prototype'].includes(value));
export const AssistantField = z.enum(['aspectRatio', 'durationSeconds', 'tone', 'genres', 'ending', 'constraints', 'cast', 'style']);
export type AssistantFieldKey = z.infer<typeof AssistantField>;
const fieldValue = z.union([z.string().trim().min(1).max(2000), z.number().int().min(1).max(86400), z.array(z.string().trim().min(1).max(500)).max(30)]);
export function validField(key: AssistantFieldKey, value: z.infer<typeof fieldValue>) {
  if (key === 'durationSeconds') return typeof value === 'number';
  if (key === 'genres') return StoryGenresSchema.safeParse(value).success;
  if (key === 'constraints') return Array.isArray(value) && value.length > 0 && !(value.includes('No restrictions') && value.length > 1);
  if (key === 'aspectRatio') return typeof value === 'string' && ['9:16', '16:9', '1:1', '4:5'].includes(value);
  return typeof value === 'string' && value.length <= (key === 'ending' ? 2000 : 500);
}
export const AssistantFactSchema = z.object({ field: AssistantField, value: fieldValue,
  origin: z.enum(['prompt', 'reference', 'user', 'suggested']), excerpt: z.string().max(2000),
  referenceId: AssistantId.nullable(), referenceVersion: z.number().int().positive().nullable(),
}).strict().refine((fact) => validField(fact.field, fact.value), 'Invalid value for this field.');
export type AssistantFact = z.infer<typeof AssistantFactSchema>;
const choice = z.object({ id: AssistantId, label: z.string().min(1).max(200), recommended: z.boolean() }).strict();
const baseQuestion = { id: AssistantId, field: AssistantField, label: z.string().min(1).max(300), reason: z.string().max(500), required: z.boolean() };
export const AssistantQuestionSchema = z.discriminatedUnion('type', [
  z.object({ ...baseQuestion, type: z.literal('single-choice'), choices: z.array(choice).min(1).max(8) }).strict(),
  z.object({ ...baseQuestion, type: z.literal('multi-choice'), choices: z.array(choice).min(1).max(8) }).strict(),
  z.object({ ...baseQuestion, type: z.literal('text'), maxLength: z.number().int().min(1).max(2000) }).strict(),
  z.object({ ...baseQuestion, type: z.literal('number'), min: z.number().int().positive(), max: z.number().int().max(86400) }).strict(),
]).refine((question) => !('choices' in question) || new Set(question.choices.map((item) => item.id)).size === question.choices.length);
export type AssistantQuestion = z.infer<typeof AssistantQuestionSchema>;
export const AssistantAnalysisSchema = z.object({ version: z.literal(1), facts: z.array(AssistantFactSchema).max(30),
  conflicts: z.array(AssistantField).max(8), questions: z.array(AssistantQuestionSchema).max(3).optional(),
  summary: z.string().max(1200).optional(),
}).strict().refine((value) => new Set(value.facts.map((fact) => fact.field)).size === value.facts.length)
  .refine((value) => new Set(value.conflicts).size === value.conflicts.length)
  .refine((value) => !value.questions || new Set(value.questions.map((question) => question.field)).size === value.questions.length);
export type AssistantAnalysis = z.infer<typeof AssistantAnalysisSchema>;
export const AssistantAnswerSchema = z.object({ questionId: AssistantId, value: fieldValue }).strict();
export type AssistantAnswer = z.infer<typeof AssistantAnswerSchema>;
export const AssistantCheckpointSchema = z.object({ version: z.literal(1), projectId: AssistantId, premiseNodeId: AssistantId,
  runId: z.string().uuid(), sourceDigest: z.string().regex(/^[a-f0-9]{64}$/), round: z.number().int().min(1).max(3),
  stage: z.enum(['needs-input', 'confirm-direction', 'confirmed']), analysis: AssistantAnalysisSchema,
  questions: z.array(AssistantQuestionSchema).max(8), answers: z.array(AssistantAnswerSchema).max(24),
  provenance: OperationProvenanceSchema.optional(),
}).strict().refine((checkpoint) => new Set(checkpoint.questions.map((item) => item.id)).size === checkpoint.questions.length)
  .refine((checkpoint) => checkpoint.round === 3 || checkpoint.questions.length <= 4);
export type AssistantCheckpoint = z.infer<typeof AssistantCheckpointSchema>;
export const StoryAssistantSchema = z.object({ version: z.literal(1), id: AssistantId, premiseNodeId: AssistantId,
  position: z.object({ x: z.number().finite(), y: z.number().finite() }).strict(), hidden: z.boolean(), collapsed: z.boolean(),
  sourceDigest: z.string().regex(/^[a-f0-9]{64}$/).nullable(), operationId: z.string().uuid().nullable(),
  state: z.enum(['review', 'understanding', 'needs-input', 'confirm-direction', 'confirmed', 'cancelled', 'outcome-unknown', 'stale']),
  checkpoint: AssistantCheckpointSchema.nullable(), answers: z.array(AssistantAnswerSchema).max(8),
  previousAnswers: z.array(z.object({ checkpoint: AssistantCheckpointSchema, answers: z.array(AssistantAnswerSchema).max(8) }).strict()).max(10).optional(),
  confirmedBriefVersion: z.number().int().positive().nullable(), error: z.string().max(2000).nullable(),
}).strict();
export type StoryAssistant = z.infer<typeof StoryAssistantSchema>;

export const fieldLabels: Record<AssistantFieldKey, string> = {
  aspectRatio: 'Aspect ratio', durationSeconds: 'Total runtime (seconds)', tone: 'Tone', genres: 'Genres', ending: 'Ending direction',
  constraints: 'Production constraints', cast: 'Characters', style: 'Visual style',
};
const choices = (labels: string[]) => labels.map((label, index) => ({ id: String(index), label, recommended: false }));
export function questionsFor(analysis: AssistantAnalysis, round: number): AssistantQuestion[] {
  const required: AssistantFieldKey[] = ['aspectRatio', 'durationSeconds'];
  const missing = [...new Set([...analysis.conflicts, ...required.filter((field) => !analysis.facts.some((fact) => fact.field === field && fact.origin !== 'suggested'))])];
  const mandatory: AssistantQuestion[] = missing.map((field) => {
    const base = { id: `round-${round}:${field}`, field, label: fieldLabels[field], required: true,
      reason: analysis.conflicts.includes(field) ? 'Conflicting directions need your decision.' : 'This detail was not supplied. Choose or write your own direction.' };
    if (field === 'aspectRatio') return { ...base, type: 'single-choice', choices: choices(['9:16', '16:9', '1:1', '4:5']) };
    if (field === 'durationSeconds') return { ...base, type: 'number', min: 1, max: 86400 };
    if (field === 'constraints') return { ...base, type: 'multi-choice', choices: choices(['No restrictions', 'No dialogue', 'One actor', 'One room']) };
    if (field === 'genres') return { ...base, type: 'multi-choice', choices: choices([...STORY_GENRES.slice(0, 8)]) };
    return { ...base, type: 'text', maxLength: field === 'ending' ? 2000 : 500 };
  });
  const proposed = (analysis.questions ?? []).filter((question) => analysis.conflicts.includes(question.field)
    || !analysis.facts.some((fact) => fact.field === question.field && fact.origin !== 'suggested'));
  // The model supplies meaningful wording; policy guarantees scope questions cannot disappear.
  return [...mandatory.map((question) => ({ ...(proposed.find((item) => item.field === question.field) ?? question), required: true })),
    ...proposed.filter((question) => !missing.includes(question.field))]
    .slice(0, 3).map((question) => ({ ...question, id: `round-${round}:${question.field}` }));
}

const creativeDefaults = { tone: 'Follow the premise', ending: 'A final beat that fits the idea', constraints: ['No restrictions'], genres: [] } satisfies Partial<Record<AssistantFieldKey, AssistantFact['value']>>;
/** Suggestions are visible, not falsely attributed to the user. Continue confirms
 * this direction, but never implies permission to spend or transfer references. */
export function withSuggestedCreativeDirection(analysis: AssistantAnalysis): AssistantAnalysis {
  return AssistantAnalysisSchema.parse({ ...analysis, facts: [...analysis.facts,
    ...Object.entries(creativeDefaults).filter(([field]) => !analysis.facts.some((fact) => fact.field === field))
      .map(([field, value]) => ({ field, value, origin: 'suggested', excerpt: '', referenceId: null, referenceVersion: null }))] });
}
export function validateAnswers(questions: AssistantQuestion[], answers: AssistantAnswer[]) {
  if (new Set(answers.map((answer) => answer.questionId)).size !== answers.length) throw Error('Duplicate answer.');
  for (const answer of answers) {
    AssistantAnswerSchema.parse(answer);
    const question = questions.find((item) => item.id === answer.questionId);
    if (!question || !validField(question.field, answer.value)) throw Error('Answer does not match the current question.');
    if (question.type === 'single-choice' && !question.choices.some((choice) => choice.label === answer.value)) throw Error('Choose a supported format.');
    if (question.type === 'number' && (typeof answer.value !== 'number' || answer.value < question.min || answer.value > question.max)) throw Error('Duration is outside the supported range.');
    if (question.type === 'text' && (typeof answer.value !== 'string' || answer.value.length > question.maxLength)) throw Error('Answer is too long.');
  }
  if (questions.some((question) => question.required && !answers.some((answer) => answer.questionId === question.id))) throw Error('Answer each required question before continuing.');
}
export function resumeAssistant(checkpoint: AssistantCheckpoint, answers: AssistantAnswer[], runId: string): AssistantCheckpoint {
  const editable = checkpoint.analysis.facts.filter((fact) => !checkpoint.questions.some((question) => question.field === fact.field))
    .map((fact) => ({ ...questionsFor({ version: 1, facts: [], conflicts: [fact.field] }, 3)[0], id: `edit:${fact.field}`, required: false }));
  const supported = [...checkpoint.questions, ...editable];
  validateAnswers(supported, answers);
  const revised = answers.map((answer): AssistantFact => {
    const field = supported.find((q) => q.id === answer.questionId)!.field;
    const decide = typeof answer.value === 'string' ? answer.value.toLocaleLowerCase() === 'you decide'
      : Array.isArray(answer.value) && answer.value.length === 1 && answer.value[0].toLocaleLowerCase() === 'you decide';
    const suggestion = field in creativeDefaults ? creativeDefaults[field as keyof typeof creativeDefaults] : undefined;
    return { field, value: decide && suggestion !== undefined ? suggestion : answer.value,
      origin: decide && suggestion !== undefined ? 'suggested' : 'user', excerpt: '', referenceId: null, referenceVersion: null };
  });
  const analysis = withSuggestedCreativeDirection(AssistantAnalysisSchema.parse({ ...checkpoint.analysis,
    facts: [...checkpoint.analysis.facts.filter((fact) => !revised.some((item) => item.field === fact.field)), ...revised],
    conflicts: checkpoint.analysis.conflicts.filter((field) => !revised.some((item) => item.field === field)),
    // Continue dismisses optional questions in this round. Do not ask them again
    // or turn a skipped recommendation into a user-confirmed fact.
    questions: checkpoint.analysis.questions?.filter((question) => !revised.some((item) => item.field === question.field)
      && !checkpoint.questions.some((shown) => shown.field === question.field && !shown.required)),
  }));
  const round = Math.min(3, checkpoint.round + 1);
  const questions = questionsFor(analysis, round);
  return AssistantCheckpointSchema.parse({ ...checkpoint, runId, round, analysis, questions,
    answers: [...checkpoint.answers, ...answers], stage: questions.length ? 'needs-input' : 'confirmed' });
}
