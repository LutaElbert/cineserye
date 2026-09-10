import { z } from 'zod';
import { StoryQuoteSchema } from './contracts';

const stage = z.object({ configured: z.boolean(), enabled: z.boolean(), ready: z.boolean(),
  status: z.enum(['blocked', 'fixture', 'configured-unverified', 'requires-preflight']),
  provider: z.string(), model: z.string().nullable(), blockers: z.array(z.string()), preflightPath: z.string().nullable(),
}).strict();
export const WorkflowCapabilitiesSchema = z.object({ version: z.literal(1), mode: z.enum(['fixture', 'live']),
  runtime: z.enum(['local-node', 'unsupported']), proof: z.literal('configuration-only'),
  analysis: StoryQuoteSchema, story: StoryQuoteSchema,
  stages: z.object({ analysis: stage, story: stage, shots: stage, images: stage, video: stage, assembly: stage }).strict(),
}).strict();
export type WorkflowCapabilities = z.infer<typeof WorkflowCapabilitiesSchema>;
