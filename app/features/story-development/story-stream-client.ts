import { EventType, RunStartedEventSchema, RunFinishedEventSchema, StateSnapshotEventSchema } from '@ag-ui/core';
import { z } from 'zod';
import { StoryResultSchema, type StoryResult } from './contracts';
import { createProgressValidator, OperationProgressSchema, type OperationProgressSink } from '../../domain/cinema/generation-operation';

const snapshot = z.object({ projectId: z.string(), runId: z.string().uuid(), stage: z.literal('proposal-review'), result: StoryResultSchema }).strict();
export async function readStoryStream(response: Response, projectId: string, runId: string, onProgress?: OperationProgressSink): Promise<StoryResult> {
  if (!response.ok) throw Error(((await response.json()) as { error?: string }).error || 'Planning failed.');
  if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) throw Error('No planning event stream returned.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', size = 0, started = false, finished = false; let result: StoryResult | null = null;
  const progress = createProgressValidator(onProgress);
  const parse = (block: string) => {
    const data = block.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
    if (!data) return;
    const event = JSON.parse(data);
    if (finished) throw Error('Events received after completion.');
    if (event.type === EventType.RUN_STARTED) {
      const value = RunStartedEventSchema.parse(event);
      if (started || value.threadId !== projectId || value.runId !== runId) throw Error('Unexpected planning run.'); started = true;
    } else if (!started) throw Error('Planning run not started.');
    else if (event.type === EventType.STEP_STARTED || event.type === EventType.STEP_FINISHED) {
      if (result) throw Error('Operation step arrived after its checkpoint.');
      progress(OperationProgressSchema.parse({ step: event.stepName, status: event.type === EventType.STEP_STARTED ? 'running' : 'completed' }));
    } else if (event.type === EventType.STATE_SNAPSHOT) {
      const value = snapshot.parse(StateSnapshotEventSchema.parse(event).snapshot);
      if (result || value.projectId !== projectId || value.runId !== runId) throw Error('Unexpected planning checkpoint.'); result = value.result;
    } else if (event.type === EventType.RUN_FINISHED) {
      progress.assertComplete();
      const value = RunFinishedEventSchema.parse(event);
      if (!result || value.threadId !== projectId || value.runId !== runId || value.outcome?.type === 'interrupt') throw Error('Incomplete planning run.'); finished = true;
    } else throw Error('Planning did not complete. Check saved result; do not repeat the request.');
  };
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength; if (size > 256000) throw Error('Planning stream too large.');
      buffer = (buffer + decoder.decode(chunk.value, { stream: true })).replace(/\r\n/g, '\n');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) { parse(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2); }
    }
    if (!finished || !result || buffer.trim()) throw Error('Connection ended without a complete planning checkpoint.');
    return result;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
