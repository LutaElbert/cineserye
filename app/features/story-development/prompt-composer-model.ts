import type { StoryReferenceUse, StoryWorkflowData } from '../../domain/cinema/story-workflow';
export { STORY_GENRES } from '../../domain/cinema/story-genres';

export type PromptReferenceMention = { alias: string; referenceId: string; version: number };

/** Use the complete append-only library, not the visible list. Archived items and
 * notes retain their slots so upload, hiding or archiving never renumbers images. */
export function storyImageAliases(workflow: StoryWorkflowData | undefined) {
  return (workflow?.references ?? []).flatMap((reference, index) => {
    const current = reference.versions.at(-1)!;
    return current.content.kind === 'image' ? [{ alias: `@image${index + 1}`, referenceId: reference.id,
      version: current.version, title: current.title, current }] : [];
  });
}

export function promptImageAliases(prompt: string): string[] {
  const tokens = [...prompt.matchAll(/(?<![\w@])@image([\w-]*)/gi)].map((match) => match[0].toLocaleLowerCase());
  if (tokens.some((token) => !/^@image[1-9][0-9]*$/.test(token))) throw Error('Use a listed reference such as @image1; this image mention is invalid.');
  return [...new Set(tokens)];
}

export function resolvePromptReferenceMentions(prompt: string, workflow: StoryWorkflowData | undefined,
  allowedReferenceIds?: ReadonlySet<string> | readonly string[], purpose: StoryReferenceUse = 'story-development'): PromptReferenceMention[] {
  const aliases = storyImageAliases(workflow);
  const allowed = allowedReferenceIds ? new Set(allowedReferenceIds) : null;
  return promptImageAliases(prompt).map((alias) => {
    const entry = aliases.find((item) => item.alias === alias);
    if (!entry) throw Error(`${alias} is missing or is no longer an image. Restore the reference or remove its mention.`);
    const current = entry.current;
    if (current.archived || current.approval !== 'approved' || current.rights === 'unknown' || !current.allowedUses.includes(purpose)
      || allowed && !allowed.has(entry.referenceId)) throw Error(`${alias} is not approved for this step. Review its rights, permission and story binding before continuing.`);
    return { alias, referenceId: entry.referenceId, version: entry.version };
  });
}

/** Server contract check: every alias must be accompanied by the exact reviewed
 * image version. Never silently drop an unavailable attachment from the request. */
export function transferredPromptMentionsValid(prompt: string, mentions: readonly PromptReferenceMention[] | undefined,
  references: readonly { id: string; version: number; content: { kind: string } }[]) {
  try {
    const aliases = promptImageAliases(prompt), supplied = mentions ?? [];
    return supplied.length === aliases.length && new Set(supplied.map((item) => item.alias)).size === supplied.length
      && supplied.every((mention) => aliases.includes(mention.alias) && references.some((reference) =>
        reference.id === mention.referenceId && reference.version === mention.version && reference.content.kind === 'image'));
  } catch { return false; }
}
