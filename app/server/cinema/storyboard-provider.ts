import { GoogleGenAI } from '@google/genai';
import type {
  GenerateStoryboardRequest,
  StoryboardProviderFrame,
} from '../../features/storyboard/storyboard-api';
import { ProviderError } from './provider-errors';

export type StoryboardProviderResult = {
  provider: string;
  model: string;
  frames: StoryboardProviderFrame[];
};

export interface StoryboardProvider {
  readonly id: string;
  readonly model: string;
  generate(request: GenerateStoryboardRequest, signal: AbortSignal): Promise<StoryboardProviderResult>;
}

const OUTPUT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;

export function validateStoryboardProviderResult(
  result: StoryboardProviderResult,
  request: GenerateStoryboardRequest,
): StoryboardProviderResult {
  if (!result.provider || !result.model) throw new ProviderError('UNEXPECTED_RESPONSE', 'The image provider omitted provenance.');
  if (result.frames.length !== request.settings.outputCount || result.frames.length < 1 || result.frames.length > 4) {
    throw new ProviderError('UNEXPECTED_RESPONSE', 'The image provider returned an unexpected number of frames.');
  }
  const ids = new Set<string>();
  const indexes = new Set<number>();
  for (const frame of result.frames) {
    if (!frame.id || ids.has(frame.id) || !Number.isInteger(frame.variantIndex) || indexes.has(frame.variantIndex)) {
      throw new ProviderError('UNEXPECTED_RESPONSE', 'The image provider returned duplicate or invalid frame identities.');
    }
    ids.add(frame.id);
    indexes.add(frame.variantIndex);
    if (!OUTPUT_MIME_TYPES.includes(frame.mimeType) || frame.base64.length < 4 || frame.base64.length > 20 * 1024 * 1024) {
      throw new ProviderError('UNEXPECTED_RESPONSE', 'The image provider returned unsupported image data.');
    }
    if (!Number.isFinite(frame.width) || !Number.isFinite(frame.height) || frame.width < 1 || frame.height < 1 || frame.width * frame.height > 24_000_000) {
      throw new ProviderError('UNEXPECTED_RESPONSE', 'The image provider returned invalid image dimensions.');
    }
    if (frame.safetyStatus !== 'passed') {
      throw new ProviderError('UNEXPECTED_RESPONSE', 'The image provider blocked this request for safety.');
    }
  }
  return result;
}

const DIMENSIONS = {
  '9:16': [768, 1_344],
  '16:9': [1_344, 768],
  '1:1': [1_024, 1_024],
  '4:5': [896, 1_120],
} as const;

function svgFrame(request: GenerateStoryboardRequest, index: number): StoryboardProviderFrame {
  const [width, height] = DIMENSIONS[request.settings.aspectRatio];
  const palettes = [
    ['#111827', '#4f46e5', '#c7d2fe'],
    ['#1c1917', '#b45309', '#fde68a'],
    ['#052e2b', '#0f766e', '#99f6e4'],
    ['#301934', '#9333ea', '#e9d5ff'],
  ];
  const [dark, mid, light] = palettes[index % palettes.length];
  const title = request.prompt.text.slice(0, 86).replace(/[<>&]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${dark}"/><stop offset="1" stop-color="${mid}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${Math.round(width * .72)}" cy="${Math.round(height * .28)}" r="${Math.round(Math.min(width, height) * .18)}" fill="${light}" opacity=".28"/><path d="M0 ${Math.round(height * .7)} Q ${Math.round(width * .45)} ${Math.round(height * .48)} ${width} ${Math.round(height * .76)} V ${height} H0Z" fill="#000" opacity=".38"/><text x="${Math.round(width * .07)}" y="${Math.round(height * .1)}" fill="#fff" font-family="system-ui,sans-serif" font-size="${Math.max(22, Math.round(width * .03))}" font-weight="700">STORYBOARD VARIANT ${index + 1}</text><foreignObject x="${Math.round(width * .07)}" y="${Math.round(height * .76)}" width="${Math.round(width * .86)}" height="${Math.round(height * .16)}"><div xmlns="http://www.w3.org/1999/xhtml" style="color:white;font:600 ${Math.max(18, Math.round(width * .026))}px system-ui,sans-serif;line-height:1.35">${title}</div></foreignObject></svg>`;
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return {
    id: `${request.idempotencyKey}-variant-${index + 1}`,
    variantIndex: index,
    seed: 41_000 + index,
    mimeType: 'image/svg+xml',
    base64: btoa(binary),
    width,
    height,
    safetyStatus: 'passed',
  };
}

export class FixtureStoryboardProvider implements StoryboardProvider {
  readonly id = 'cineserye-storyboard-fixture';
  readonly model = 'fixture-cinematic-board-v1';

  async generate(request: GenerateStoryboardRequest, signal: AbortSignal): Promise<StoryboardProviderResult> {
    if (signal.aborted) throw new ProviderError('CANCELLED', 'Storyboard generation was cancelled.');
    await new Promise<void>((resolve, reject) => {
      // Keep the deterministic fixture visibly cancellable even when the local
      // server and browser are running on a fast machine.
      const timer = setTimeout(resolve, 350);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new ProviderError('CANCELLED', 'Storyboard generation was cancelled.'));
      }, { once: true });
    });
    return {
      provider: this.id,
      model: this.model,
      frames: Array.from({ length: request.settings.outputCount }, (_, index) => svgFrame(request, index)),
    };
  }
}

export class VertexStoryboardProvider implements StoryboardProvider {
  readonly id = 'google-vertex-ai';

  constructor(
    readonly project: string,
    readonly location: string,
    readonly model = 'gemini-2.5-flash-image',
  ) {}

  async generate(request: GenerateStoryboardRequest, signal: AbortSignal): Promise<StoryboardProviderResult> {
    const client = new GoogleGenAI({ vertexai: true, project: this.project, location: this.location });
    const frames: StoryboardProviderFrame[] = [];
    for (let index = 0; index < request.settings.outputCount; index += 1) {
      if (signal.aborted) throw new ProviderError('CANCELLED', 'Storyboard generation was cancelled.');
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{
        text: `${request.prompt.text}\n\nCreate storyboard still variant ${index + 1} of ${request.settings.outputCount}. Preserve continuity and production feasibility.`,
      }];
      request.references.forEach((reference) => parts.push({
        inlineData: { mimeType: reference.mimeType, data: reference.base64 },
      }));
      const result = await client.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: request.settings.aspectRatio },
        },
      });
      const imagePart = result.candidates?.flatMap((candidate) => candidate.content?.parts ?? [])
        .find((part) => part.inlineData?.data && part.inlineData.mimeType?.startsWith('image/'));
      if (!imagePart?.inlineData?.data || !imagePart.inlineData.mimeType) {
        throw new ProviderError('UNEXPECTED_RESPONSE', 'Vertex AI did not return a storyboard image.');
      }
      const [width, height] = DIMENSIONS[request.settings.aspectRatio];
      frames.push({
        id: `${request.idempotencyKey}-variant-${index + 1}`,
        variantIndex: index,
        seed: index,
        mimeType: imagePart.inlineData.mimeType as StoryboardProviderFrame['mimeType'],
        base64: imagePart.inlineData.data,
        width,
        height,
        safetyStatus: 'passed',
      });
    }
    return { provider: this.id, model: this.model, frames };
  }
}
