import { z } from 'zod';
import { StoryCreativeBriefSchema, StorySceneProposalSchema } from '../../domain/cinema/story-workflow';
import { transferredPromptMentionsValid } from './prompt-composer-model';
import { OperationProvenanceSchema } from '../../domain/cinema/generation-operation';

export const PromptReferenceMentionSchema = z.object({ alias: z.string().regex(/^@image[1-9][0-9]*$/),
  referenceId: z.string().min(1).max(160), version: z.number().int().positive() }).strict();

export const StoryTransferSchema = z.object({
  id: z.string().min(1).max(160), version: z.number().int().positive(), title: z.string().max(500),
  rights: z.enum(['creator-owned', 'licensed', 'public-domain']), approval: z.literal('approved'),
  allowedUses: z.array(z.string().max(40)).max(5).refine((uses) => uses.includes('story-development')),
  content: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('note'), text: z.string().max(10_000) }).strict(),
    z.object({ kind: z.literal('image'), mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
      base64: z.string().min(1).max(8 * 1024 * 1024) }).strict(),
  ]),
}).strict();
export const StoryInputSchema = z.object({
  version: z.literal(1), projectId: z.string().min(1).max(160),
  brief: StoryCreativeBriefSchema.refine((brief) => brief.status === 'approved'), count: z.number().int().min(1).max(10),
  context: z.array(z.object({ id: z.string().max(160), title: z.string().max(500), synopsis: z.string().max(20_000) }).strict()).max(100),
  anchorSceneId: z.string().max(160).nullable(),
  references: z.array(StoryTransferSchema).max(8),
  referenceMentions: z.array(PromptReferenceMentionSchema).max(8).optional(),
  // Regeneration is a new, explicitly reviewed request containing only selected proposals.
  revise: z.array(StorySceneProposalSchema).max(10).default([]),
  allocation: z.object({ scope: z.enum(['whole-story', 'new-material']), targetSeconds: z.number().int().positive().max(86400),
    existingSeconds: z.number().int().nonnegative().max(86400).nullable(), newSeconds: z.number().int().positive().max(86400) }).strict().optional(),
  revision: z.object({ instruction: z.string().trim().min(1).max(4000), sourceSessionId: z.string().min(1).max(160),
    sourceVersion: z.number().int().positive(), selectedProposalIds: z.array(z.string().min(1).max(160)).min(1).max(10),
    untouchedProposals: z.array(StorySceneProposalSchema).max(10),
  }).strict().optional(),
}).strict().refine((input) => new Set(input.references.map((reference) => reference.id)).size === input.references.length)
  .refine((input) => transferredPromptMentionsValid(input.brief.premise, input.referenceMentions, input.references), 'Every @image mention must identify an approved transferred image version.')
  .refine((input) => new Set(input.revise.map((proposal) => proposal.id)).size === input.revise.length)
  .refine((input) => !input.revision || input.revise.length > 0 && input.revision.selectedProposalIds.length === input.revise.length
    && new Set(input.revision.selectedProposalIds).size === input.revision.selectedProposalIds.length
    && input.revise.every((proposal) => input.revision!.selectedProposalIds.includes(proposal.id))
    && !input.revision.untouchedProposals.some((proposal) => input.revision!.selectedProposalIds.includes(proposal.id))
    && new Set(input.revision.untouchedProposals.map((proposal) => proposal.id)).size === input.revision.untouchedProposals.length,
  'Revision must bind unique selected IDs and preserve unselected proposals.')
  .refine((input) => input.brief.mode !== 'continue' || input.context.some((scene) => scene.id === input.anchorSceneId));
export const StoryResultSchema = z.object({
  version: z.literal(1), proposals: z.array(StorySceneProposalSchema).min(1).max(10),
  retainedConstraints: z.array(z.string().max(500)).max(30).optional(), provenance: OperationProvenanceSchema.optional(),
  outlineVersion: z.number().int().positive().optional(), outline: z.array(StorySceneProposalSchema).max(10).optional(),
}).strict().refine((value) => new Set(value.proposals.map((item) => item.id)).size === value.proposals.length);
export type StoryInput = z.infer<typeof StoryInputSchema>;
export type StoryResult = z.infer<typeof StoryResultSchema>;
export const StoryQuoteSchema = z.object({ enabled: z.boolean(), mode: z.enum(['fixture', 'live']), model: z.string().min(1).max(160),
  quoteId: z.string().regex(/^[a-f0-9]{64}$/), cost: z.number().finite().nonnegative(), ceiling: z.number().finite().nonnegative(),
  ready: z.boolean(), blockers: z.array(z.string().max(1000)).max(20) }).strict();
export type StoryQuote = z.infer<typeof StoryQuoteSchema>;
export function storyApprovalContent(input: StoryInput, quoteId: string) { return { input, quoteId }; }
