import { describe, expect, it } from 'vitest';
import { EventType } from '@ag-ui/core';
import { readAssistantStream } from './assistant-client';
import { readStoryStream } from './story-stream-client';
import { questionsFor, type AssistantCheckpoint } from '../../domain/cinema/story-assistant';

const projectId = 'project', runId = '11111111-1111-4111-8111-111111111111';
const checkpoint: AssistantCheckpoint = { version: 1, projectId, premiseNodeId: 'story', runId, sourceDigest: 'a'.repeat(64), round: 1,
  stage: 'needs-input', analysis: { version: 1, facts: [], conflicts: [] }, questions: questionsFor({ version: 1, facts: [], conflicts: [] }, 1), answers: [] };
const start = { type: EventType.RUN_STARTED, threadId: projectId, runId };
const state = { type: EventType.STATE_SNAPSHOT, snapshot: checkpoint };
const finish = { type: EventType.RUN_FINISHED, threadId: projectId, runId, outcome: { type: 'interrupt', interrupts: [{ id: runId, reason: 'human-input' }] } };
function response(events: unknown[], chunkSize = 11) {
  const bytes = new TextEncoder().encode(events.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join(''));
  return new Response(new ReadableStream<Uint8Array>({ start(controller) {
    for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize)); controller.close();
  } }), { headers: { 'content-type': 'text/event-stream' } });
}
describe('bounded event readers', () => {
  it('decodes byte-split JSON and CRLF without applying partial questions', async () => {
    expect(await readAssistantStream(response([start, state, finish], 1), projectId, runId)).toEqual(checkpoint);
  });
  it('rejects repeats, out-of-order snapshots, missing terminal, wrong run and arbitrary patches', async () => {
    for (const events of [[state, start, finish], [start, state, state, finish], [start, state], [start, { ...state, snapshot: { ...checkpoint, runId: crypto.randomUUID() } }, finish],
      [start, { type: EventType.STATE_DELTA, delta: [{ op: 'add', path: '/execute', value: 'secret' }] }, finish], [start, state, finish, state]]) {
      await expect(readAssistantStream(response(events), projectId, runId)).rejects.toThrow();
    }
  });
  it('delivers only real ordered step boundaries, rejecting duplicate, unfinished and unknown steps', async () => {
    const running = { type: EventType.STEP_STARTED, stepName: 'model' }, done = { type: EventType.STEP_FINISHED, stepName: 'model' };
    const progress: unknown[] = [];
    expect(await readAssistantStream(response([start, running, done, state, finish]), projectId, runId, (step) => progress.push(step))).toEqual(checkpoint);
    expect(progress).toEqual([{ step: 'model', status: 'running' }, { step: 'model', status: 'completed' }]);
    for (const events of [[start, done, state, finish], [start, running, state, finish], [start, running, done, running, done, state, finish],
      [start, { ...running, stepName: 'thinking-90-percent' }, state, finish]]) {
      await expect(readAssistantStream(response(events), projectId, runId)).rejects.toThrow();
    }
  });
  it('validates scene proposals and identity before releasing a completed planning result', async () => {
    const result = { version: 1, proposals: [{ id: 'one', title: 'The choice', synopsis: 'She leaves.', purpose: 'Payoff', durationSeconds: 20, selected: true }] };
    const proposal = { type: EventType.STATE_SNAPSHOT, snapshot: { projectId, runId, stage: 'proposal-review', result } };
    const done = { type: EventType.RUN_FINISHED, threadId: projectId, runId };
    expect(await readStoryStream(response([start, proposal, done], 1), projectId, runId)).toEqual(result);
    await expect(readStoryStream(response([start, proposal]), projectId, runId)).rejects.toThrow();
    await expect(readStoryStream(response([start, proposal, done, done]), projectId, runId)).rejects.toThrow();
    await expect(readStoryStream(response([start, proposal, done]), 'another', runId)).rejects.toThrow();
    await expect(readStoryStream(response([start, { ...proposal, snapshot: { ...proposal.snapshot, result: { ...result, execute: 'bad' } } }, done]), projectId, runId)).rejects.toThrow();
  });
});
