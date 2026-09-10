import { describe, expect, it } from 'vitest';
import { initialDocument } from './initial-document';
import { ensureStoryProject, changeStory, storyPremise } from './story-development-commands';
import { assistantPlacement, projectStoryAssistant } from './story-assistant-projection';
import { parseProjectBackup, serializeProjectBackup } from './document-file';
import type { StoryAssistant } from '../domain/cinema/story-assistant';
import { questionsFor } from '../domain/cinema/story-assistant';

function sample() {
  const doc = ensureStoryProject(structuredClone(initialDocument));
  const assistant: StoryAssistant = { version: 1, id: 'story-assistant:example', premiseNodeId: 'story-premise', position: assistantPlacement(doc.nodes, doc.nodes[0]),
    hidden: false, collapsed: false, sourceDigest: null, operationId: null, state: 'review', checkpoint: null, answers: [], confirmedBriefVersion: null, error: null };
  return { doc, assistant };
}
describe('assistant view isolation and v2 persistence', () => {
  it('projects a helper without mutating canonical nodes, connections or geometry', () => {
    const { doc, assistant } = sample(), before = structuredClone(doc);
    const projection = projectStoryAssistant(doc.nodes, assistant)!;
    expect(doc).toEqual(before);
    expect(projection.edge).toMatchObject({ source: 'story-premise', target: assistant.id, targetHandle: 'assistant-target', selectable: false });
    expect(projection.node.selectable).toBe(false);
    expect(doc.nodes.some((node) => node.id === assistant.id)).toBe(false);
    expect(projectStoryAssistant(doc.nodes, { ...assistant, hidden: true })?.node.style?.visibility).toBe('hidden');
    expect(projectStoryAssistant(doc.nodes, { ...assistant, collapsed: true })?.node.height).toBe(180);
  });
  it('upgrades only on an assistant write and round-trips the sidecar without export nodes', () => {
    const { doc, assistant } = sample();
    const before = parseProjectBackup(serializeProjectBackup(doc));
    expect(before.cinema?.storyWorkflow?.assistant).toBeUndefined();
    assistant.checkpoint = { version: 1, projectId: doc.cinema!.projectId, premiseNodeId: assistant.premiseNodeId, runId: crypto.randomUUID(),
      sourceDigest: 'a'.repeat(64), round: 1, stage: 'needs-input', analysis: { version: 1, facts: [], conflicts: [] },
      questions: questionsFor({ version: 1, facts: [], conflicts: [] }, 1), answers: [] };
    assistant.answers = [{ questionId: assistant.checkpoint.questions[0].id, value: '16:9' }];
    assistant.state = 'needs-input'; assistant.sourceDigest = 'b'.repeat(64);
    const next = changeStory(doc, (data) => { data.version = 2; data.assistant = assistant; });
    const restored = parseProjectBackup(serializeProjectBackup(next));
    expect(restored.cinema?.storyWorkflow?.assistant).toEqual(assistant);
    expect(restored.nodes).toEqual(doc.nodes); expect(restored.edges).toEqual(doc.edges);
    expect(doc.cinema?.storyWorkflow?.assistant).toBeUndefined();
    const future = JSON.parse(serializeProjectBackup(next)); future.document.cinema.storyWorkflow.version = 3;
    expect(() => parseProjectBackup(JSON.stringify(future))).toThrow();
  });
  it('does not rebind an orphan or ID collision to another story', () => {
    const { doc, assistant } = sample();
    const next = changeStory(doc, (data) => { data.version = 2; data.assistant = assistant; });
    next.nodes = next.nodes.filter((node) => node.id !== assistant.premiseNodeId);
    next.nodes.push({ ...doc.nodes[0], id: 'another-story' });
    expect(projectStoryAssistant(next.nodes, assistant)).toBeNull();
    expect(storyPremise(next)).toBeNull();
    expect(projectStoryAssistant(doc.nodes, { ...assistant, id: doc.nodes[1].id })).toBeNull();
  });
});
