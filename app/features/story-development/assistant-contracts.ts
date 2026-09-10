import { z } from 'zod';
import { AssistantAnswerSchema, AssistantFactSchema, AssistantId } from '../../domain/cinema/story-assistant';
import { PromptReferenceMentionSchema, StoryTransferSchema } from './contracts';
import { transferredPromptMentionsValid } from './prompt-composer-model';

export const AssistantInputSchema = z.object({ version: z.literal(1), projectId: AssistantId, premiseNodeId: AssistantId,
  premise: z.string().max(20000), goal: z.enum(['surprise', 'expand', 'continue']), anchorSceneId: AssistantId.nullable(),
  context: z.array(z.object({ id: AssistantId, title: z.string().max(500), synopsis: z.string().max(20000) }).strict()).max(100),
  explicit: z.array(AssistantFactSchema).max(8), references: z.array(StoryTransferSchema).max(8), referenceRevision: z.number().int().nonnegative(),
  referenceMentions: z.array(PromptReferenceMentionSchema).max(8).optional(),
}).strict().refine((input) => input.goal === 'surprise' || Boolean(input.premise.trim()), 'Write a premise or choose Surprise me.')
  .refine((input) => input.goal !== 'continue' || input.context.some((scene) => scene.id === input.anchorSceneId), 'Choose an existing scene to continue after.')
  .refine((input) => input.explicit.every((fact) => fact.origin === 'user') && new Set(input.explicit.map((fact) => fact.field)).size === input.explicit.length)
  .refine((input) => transferredPromptMentionsValid(input.premise, input.referenceMentions, input.references), 'Every @image mention must identify an approved transferred image version.')
  .refine((input) => new Set(input.references.map((ref) => ref.id)).size === input.references.length);
export type AssistantInput = z.infer<typeof AssistantInputSchema>;
export const AssistantCommandSchema = z.discriminatedUnion('command', [
  z.object({ command: z.literal('analyze'), mode: z.enum(['fixture', 'live']), input: AssistantInputSchema,
    consent: z.literal(true), quoteId: z.string().length(64), contentDigest: z.string().length(64) }).strict(),
  z.object({ command: z.literal('resume'), projectId: AssistantId, parentRunId: z.string().uuid(),
    sourceDigest: z.string().length(64), answers: z.array(AssistantAnswerSchema).max(8) }).strict(),
]);
