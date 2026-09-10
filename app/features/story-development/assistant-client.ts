import { EventType, RunStartedEventSchema, RunFinishedEventSchema, StateSnapshotEventSchema } from '@ag-ui/core';
import { AssistantCheckpointSchema, type AssistantCheckpoint } from '../../domain/cinema/story-assistant';
import { createProgressValidator, OperationProgressSchema, type OperationProgressSink } from '../../domain/cinema/generation-operation';

/** Bounded SSE decoder: never apply partial JSON, arbitrary patches or wrong-run state. */
export async function readAssistantStream(response: Response, projectId: string, runId: string, onProgress?: OperationProgressSink): Promise<AssistantCheckpoint> {
  if (!response.ok) throw Error(((await response.json()) as { error?: string }).error || 'Assistant request failed.');
  if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) throw Error('No assistant event stream returned.');
  const reader = response.body.getReader(); const decoder = new TextDecoder();
  let buffer = '', total = 0, started = false, finished = false;
  let checkpoint: AssistantCheckpoint | null = null;
  const progress = createProgressValidator(onProgress);
  const parse = (block: string) => {
    const text = block.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
    if (!text) return;
    const event = JSON.parse(text);
    if (event.type === EventType.RUN_STARTED) {
      const parsed = RunStartedEventSchema.parse(event);
      if (started || parsed.threadId !== projectId || parsed.runId !== runId) throw Error('Unexpected assistant run.');
      started = true;
    } else if (!started || finished) throw Error('Assistant events arrived outside a run.');
    else if (event.type === EventType.STEP_STARTED || event.type === EventType.STEP_FINISHED) {
      if (checkpoint) throw Error('Operation step arrived after its checkpoint.');
      progress(OperationProgressSchema.parse({ step: event.stepName, status: event.type === EventType.STEP_STARTED ? 'running' : 'completed' }));
    } else if (event.type === EventType.STATE_SNAPSHOT) {
      if (checkpoint) throw Error('Repeated assistant checkpoint.');
      checkpoint = AssistantCheckpointSchema.parse(StateSnapshotEventSchema.parse(event).snapshot);
      if (checkpoint.projectId !== projectId || checkpoint.runId !== runId) throw Error('Checkpoint identity does not match this run.');
    } else if (event.type === EventType.RUN_FINISHED) {
      progress.assertComplete();
      const parsed = RunFinishedEventSchema.parse(event);
      if (!checkpoint || parsed.runId !== runId || parsed.threadId !== projectId) throw Error('Missing terminal checkpoint.');
      if (checkpoint.stage !== 'confirmed' && (parsed.outcome?.type !== 'interrupt' || parsed.outcome.interrupts[0]?.id !== runId)) throw Error('Missing question interrupt.');
      finished = true;
    } else if (event.type === EventType.RUN_ERROR) throw Error(typeof event.message === 'string' ? event.message : 'Assistant failed.');
    else if (event.type !== EventType.MESSAGES_SNAPSHOT) throw Error('Unsupported assistant event.');
  };
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      total += chunk.value.byteLength; if (total > 256000) throw Error('Assistant stream exceeds supported size.');
      buffer = (buffer + decoder.decode(chunk.value, { stream: true })).replace(/\r\n/g, '\n');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) { parse(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2); }
    }
    if (!finished || !checkpoint || buffer.trim()) throw Error('Connection ended without a final checkpoint. Check saved result; do not repeat analysis.');
    return checkpoint;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
