import { z } from 'zod';

// Provider-facing schemas use only supported JSON types; strict semantic policy
// is applied to the returned value separately. These are the production shapes.
const field = z.enum(['aspectRatio', 'durationSeconds', 'tone', 'genres', 'ending', 'constraints', 'cast', 'style']);
const choice = z.object({ id: z.string(), label: z.string(), recommended: z.boolean() });
const common = { id: z.string(), field, label: z.string(), reason: z.string(), required: z.boolean() };
export const AssistantAnalysisResponseSchema = z.object({
  version: z.literal(1), summary: z.string(),
  facts: z.array(z.object({ field, value: z.union([z.string(), z.number(), z.array(z.string())]),
    origin: z.enum(['prompt', 'reference', 'suggested']), excerpt: z.string(), referenceId: z.string().nullable(), referenceVersion: z.number().nullable() })),
  conflicts: z.array(field),
  questions: z.array(z.union([
    z.object({ ...common, type: z.literal('single-choice'), choices: z.array(choice) }),
    z.object({ ...common, type: z.literal('multi-choice'), choices: z.array(choice) }),
    z.object({ ...common, type: z.literal('text'), maxLength: z.number() }),
    z.object({ ...common, type: z.literal('number'), min: z.number(), max: z.number() }),
  ])),
});
export const StoryOutlineResponseSchema = z.object({ version: z.literal(1),
  proposals: z.array(z.object({ id: z.string(), title: z.string(), synopsis: z.string(), purpose: z.string(), durationSeconds: z.number(), selected: z.boolean() })),
  retainedConstraints: z.array(z.string()),
});
export const ASSISTANT_RESPONSE_JSON_SCHEMA = z.toJSONSchema(AssistantAnalysisResponseSchema);
export const STORY_RESPONSE_JSON_SCHEMA = z.toJSONSchema(StoryOutlineResponseSchema);
