'use client';
import { useState } from 'react';
import type { EditorDocument } from '../../editor/types';
import type { StoryReferenceVersion } from '../../domain/cinema/story-workflow';
import { changeStory, storyPremise } from '../../editor/story-development-commands';
import { StoryReferencePreview } from './StoryDevelopmentPanel';
import { storyImageAliases } from './prompt-composer-model';

type Policy = Pick<StoryReferenceVersion, 'rights' | 'allowedUses'>;
const uses: Array<[StoryReferenceVersion['allowedUses'][number], string]> = [
  ['story-development', 'Story development'], ['shot-planning', 'Shot planning'],
  ['image-generation', 'Image generation'], ['video-generation', 'Video generation'], ['research', 'Research'],
];

/** Local policy editor. Saving permission never uploads or generates media. */
export function StoryReferencePermissions({ document, getDocument, commit, flush, readOnly }: {
  document: EditorDocument; getDocument: () => EditorDocument; commit: (value: EditorDocument) => void;
  flush: () => Promise<unknown>; readOnly: boolean;
}) {
  const [drafts, setDrafts] = useState<Record<string, Policy>>({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const aliases = storyImageAliases(document.cinema?.storyWorkflow).filter((item) => !item.current.archived);
  const save = async (id: string, version: number, policy: Policy) => {
    try {
      const source = getDocument(), premise = storyPremise(source);
      if (readOnly || !premise || source.nodes.find((node) => node.id === premise.nodeId)?.data.locked) throw Error('Unlock this Story before changing reference permissions.');
      if (source.cinema?.projectId !== document.cinema?.projectId) throw Error('Project changed. Reopen reference permissions.');
      if (policy.rights === 'unknown' || !policy.allowedUses.length) throw Error('Confirm your rights and select at least one permitted use.');
      commit(changeStory(source, (data) => {
        const ref = data.references.find((item) => item.id === id), current = ref?.versions.at(-1);
        if (!ref || !current || current.version !== version) throw Error('This reference changed. Review its current version first.');
        ref.versions.push({ ...current, ...policy, version: version + 1, approval: 'approved' });
      }));
      await flush(); setNotice('Permissions saved locally. Every live generation still needs separate approval.'); setError('');
    } catch (error) { setError((error as Error).message); }
  };
  return <section className="reference-permissions" aria-label="Reference permissions">
    <h3>Your images, your control</h3><p>Confirm rights and allowed uses. Nothing is sent just by attaching an image or saving these permissions.</p>
    {aliases.map((item) => {
      const key = `${item.referenceId}:${item.version}`, policy = drafts[key] ?? { rights: item.current.rights, allowedUses: item.current.allowedUses };
      const patch = (value: Partial<Policy>) => setDrafts((current) => ({ ...current, [key]: { ...policy, ...value } }));
      return <fieldset key={key} disabled={readOnly}><legend>{item.alias} · {item.title}</legend>
        {item.current.content.kind === 'image' && <StoryReferencePreview hash={item.current.content.blobHash} title={item.title} />}
        <label>Rights for {item.alias}<select value={policy.rights} onChange={(event) => patch({ rights: event.target.value as Policy['rights'] })}>
          <option value="unknown">Choose rights</option><option value="creator-owned">I own this image</option><option value="licensed">I have a license</option><option value="public-domain">Public domain</option>
        </select></label>
        <div className="reference-use-options">{uses.map(([use, label]) => <label key={use}><input type="checkbox" checked={policy.allowedUses.includes(use)} onChange={(event) => patch({ allowedUses: event.target.checked ? [...policy.allowedUses, use] : policy.allowedUses.filter((value) => value !== use) })} />{label}</label>)}</div>
        <button type="button" onClick={() => void save(item.referenceId, item.version, policy)}>Save permissions for {item.alias}</button>
        <small>Current policy: {item.current.approval} · v{item.version}</small>
      </fieldset>;
    })}
    {!aliases.length && <p>Add an image from the Story composer to set its permissions.</p>}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
