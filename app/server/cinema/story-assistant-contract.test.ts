import { describe, expect, it } from 'vitest';
import { EventType, RunAgentInputSchema, RunFinishedEventSchema, RunStartedEventSchema, StateSnapshotEventSchema } from '@ag-ui/core';
import { EventEncoder } from '@ag-ui/encoder';
import type { GenerateContentConfig } from '@google/genai';
import { z } from 'zod';
import { ASSISTANT_RESPONSE_JSON_SCHEMA, STORY_RESPONSE_JSON_SCHEMA, AssistantAnalysisResponseSchema, StoryOutlineResponseSchema } from './story-production-schema';
import { AssistantAnalysisSchema } from '../../domain/cinema/story-assistant';

// Compatibility spike only. No endpoint/provider is wired by these tests.
describe('pinned AG-UI 0.0.59 and structured-output contract', () => {
  it('encodes lifecycle and validated application state as SSE without losing identity', () => {
    const encoder = new EventEncoder();
    const event = RunStartedEventSchema.parse({ type: EventType.RUN_STARTED, threadId: 'story-1', runId: 'run-1' });
    expect(encoder.getContentType()).toBe('text/event-stream');
    const encoded = encoder.encode(event);
    const data = JSON.parse(encoded.trim().replace(/^data: /, ''));
    expect(RunStartedEventSchema.parse(data)).toEqual(event);
    const appState = z.object({ stage: z.literal('needs-input'), sourceDigest: z.string().length(64) }).strict();
    const snapshot = StateSnapshotEventSchema.parse({ type: EventType.STATE_SNAPSHOT, snapshot: { stage: 'needs-input', sourceDigest: 'a'.repeat(64) } });
    expect(appState.parse(snapshot.snapshot).stage).toBe('needs-input');
    expect(() => appState.parse({ ...snapshot.snapshot, execute: 'anything' })).toThrow();
  });
  it('supports interrupt completion and explicit resume while app validation restricts payload', () => {
    const finished = RunFinishedEventSchema.parse({ type: EventType.RUN_FINISHED, threadId: 'story-1', runId: 'analysis-1',
      outcome: { type: 'interrupt', interrupts: [{ id: 'questions-1', reason: 'human-input', message: 'Confirm direction' }] } });
    expect(finished.outcome?.type).toBe('interrupt');
    const resume = RunAgentInputSchema.parse({ threadId: 'story-1', runId: 'resume-1', state: {}, messages: [], tools: [], context: [], forwardedProps: {},
      resume: [{ interruptId: 'questions-1', status: 'resolved', payload: { ending: 'Dark twist' } }] });
    expect(resume.resume?.[0].interruptId).toBe('questions-1');
    const answer = z.object({ ending: z.string().max(2000) }).strict();
    expect(answer.parse(resume.resume?.[0].payload)).toEqual({ ending: 'Dark twist' });
    expect(() => answer.parse({ ending: 'Dark twist', html: '<script>' })).toThrow();
    expect(() => RunFinishedEventSchema.parse({ ...finished, outcome: { type: 'interrupt', interrupts: [] } })).toThrow();
  });
  it('expresses a simple provider JSON schema in the installed Google SDK with semantic validation separate', () => {
    const schema = z.object({ ending: z.string().max(2000) }).strict();
    const config: GenerateContentConfig = { responseMimeType: 'application/json', responseJsonSchema: z.toJSONSchema(schema), maxOutputTokens: 1024 };
    expect(config.responseJsonSchema).toMatchObject({ type: 'object', additionalProperties: false });
    // This verifies SDK input compatibility, not support/quality of a real Vertex model.
    expect(schema.safeParse({ ending: 10 }).success).toBe(false);
  });
  it('uses the actual analysis/question and scene-output schemas at the provider seam', () => {
    const analysis = { version: 1, facts: [], conflicts: [], summary: 'The game becomes real.', questions: [
      { id: 'ending', field: 'ending', type: 'text', label: 'Should the players escape the board game?', reason: 'This changes the payoff.', required: true, maxLength: 500 },
    ] };
    expect(AssistantAnalysisResponseSchema.safeParse(analysis).success).toBe(true);
    expect(AssistantAnalysisSchema.safeParse(analysis).success).toBe(true);
    expect(ASSISTANT_RESPONSE_JSON_SCHEMA).toMatchObject({ type: 'object', properties: { questions: { type: 'array' }, facts: { type: 'array' } } });
    expect(STORY_RESPONSE_JSON_SCHEMA).toMatchObject({ type: 'object', properties: { proposals: { type: 'array' }, retainedConstraints: { type: 'array' } } });
    expect(StoryOutlineResponseSchema.safeParse({ version: 1, proposals: [], retainedConstraints: ['All four survive'] }).success).toBe(true);
    expect(AssistantAnalysisSchema.safeParse({ ...analysis, questions: Array(4).fill(analysis.questions[0]) }).success).toBe(false);
    // Schema compatibility and hard-contract tests are not real-model semantic proof.
  });
});
