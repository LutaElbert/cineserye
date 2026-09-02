import type { LocalMediaBlob } from '../../editor/persistence';
import { saveLocalMediaBlob } from '../../editor/persistence';

export type PersistVideoClipInput = {
  blob: Blob;
  width: number;
  height: number;
};

export async function persistVideoClipArtifact(
  input: PersistVideoClipInput,
  save: typeof saveLocalMediaBlob = saveLocalMediaBlob,
): Promise<LocalMediaBlob> {
  if (input.blob.type !== 'video/mp4' || input.blob.size < 1) throw new Error('The provider returned invalid video bytes.');
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width < 1 || input.height < 1) throw new Error('The provider returned invalid video dimensions.');
  try {
    return await save(input.blob, { mimeType: 'video/mp4', width: input.width, height: input.height });
  } catch (error) {
    if (error instanceof DOMException && ['QuotaExceededError', 'UnknownError'].includes(error.name)) {
      throw new Error('Local storage is full. Download or remove unused media, then retry saving the clip.');
    }
    throw error;
  }
}
