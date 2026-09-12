import { z } from 'zod';
import type { StoryboardPreflight } from './storyboard-api';

const quote = z.object({ mode: z.enum(['fixture', 'live']), model: z.string().trim().min(1).max(500),
  unitCost: z.number().finite().nonnegative(), maxCost: z.number().finite().nonnegative(),
  maxOutputs: z.number().int().positive().max(4), quoteId: z.string().regex(/^[a-f0-9]{64}$/),
  ready: z.boolean(), blockers: z.array(z.string().trim().min(1).max(1000)).max(40),
}).strict().refine(value => value.ready === (value.blockers.length === 0));

export function parseStoryboardPreflight(value: unknown): StoryboardPreflight {
  const result = quote.safeParse(value);
  if (!result.success) throw Error('Image request preflight is unavailable or malformed. Refresh its estimate before confirming.');
  return result.data;
}
