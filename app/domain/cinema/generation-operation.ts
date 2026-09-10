import { z } from 'zod';

export const OperationProgressSchema = z.object({
  step: z.enum(['preparing', 'model', 'validation', 'checkpoint']),
  status: z.enum(['running', 'completed']),
}).strict();
export type OperationProgress = z.infer<typeof OperationProgressSchema>;
export type OperationProgressSink = (progress: OperationProgress) => void;
export const OperationProvenanceSchema = z.object({
  mode: z.enum(['fixture', 'live', 'unknown']), provider: z.string().max(80), model: z.string().max(160).nullable(),
  runId: z.string().max(160), startedAt: z.string().datetime(), completedAt: z.string().datetime().nullable(),
  status: z.enum(['completed', 'unknown']),
  usage: z.object({ inputTokens: z.number().int().nonnegative().nullable(), outputTokens: z.number().int().nonnegative().nullable(),
    totalTokens: z.number().int().nonnegative().nullable() }).strict().nullable(),
}).strict();
export type OperationProvenance = z.infer<typeof OperationProvenanceSchema>;

/** A stream may omit steps when replaying a durable result, but never invent or reorder them. */
export function createProgressValidator(onProgress?: OperationProgressSink) {
  let active: OperationProgress['step'] | null = null;
  let previous = -1;
  const steps = ['preparing', 'model', 'validation', 'checkpoint'];
  const progress = (value: OperationProgress) => {
    const progress = OperationProgressSchema.parse(value), index = steps.indexOf(progress.step);
    if (progress.status === 'running') {
      if (active || index <= previous) throw Error('Operation steps arrived out of order.');
      active = progress.step;
    } else {
      if (active !== progress.step) throw Error('Operation step completed without starting.');
      active = null; previous = index;
    }
    onProgress?.(progress);
  };
  return Object.assign(progress, { assertComplete: () => { if (active) throw Error('Operation ended with an incomplete step.'); } });
}
