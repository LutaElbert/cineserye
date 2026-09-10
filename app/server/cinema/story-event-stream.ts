import 'server-only';
import { EventType } from '@ag-ui/core';
import { EventEncoder } from '@ag-ui/encoder';
import type { StoryResult } from '../../features/story-development/contracts';
import type { OperationProgressSink } from '../../domain/cinema/generation-operation';

/** Disconnecting a view stops delivery, not the durable operation or its billing. */
export function storyEventStream(projectId: string, runId: string, run: (progress: OperationProgressSink) => Promise<StoryResult>): Response {
  const encoder = new EventEncoder(); const bytes = new TextEncoder(); let disconnected = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: Parameters<EventEncoder['encode']>[0]) => { if (!disconnected) controller.enqueue(bytes.encode(encoder.encode(event))); };
      send({ type: EventType.RUN_STARTED, threadId: projectId, runId });
      const progress: OperationProgressSink = ({ step, status }) => send({ type: status === 'running' ? EventType.STEP_STARTED : EventType.STEP_FINISHED, stepName: step });
      void run(progress).then((result) => {
        progress({ step: 'checkpoint', status: 'running' });
        progress({ step: 'checkpoint', status: 'completed' });
        send({ type: EventType.STATE_SNAPSHOT, snapshot: { projectId, runId, stage: 'proposal-review', result } });
        send({ type: EventType.RUN_FINISHED, threadId: projectId, runId });
      }).catch(() => send({ type: EventType.RUN_ERROR, message: 'Planning did not return a validated result. Check the saved operation before retrying.' }))
        .finally(() => { if (!disconnected) controller.close(); });
    },
    cancel() { disconnected = true; },
  });
  return new Response(body, { headers: { 'content-type': encoder.getContentType(), 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
}
