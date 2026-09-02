import type { CinemaResearchSourceRecord } from '../../domain/cinema/project-data';
import type {
  ResearchProvider,
  ResearchProviderRequest,
  ResearchProviderResult,
} from './provider-contracts';
import { ProviderError } from './provider-errors';

const PARALLEL_SEARCH_URL = 'https://api.parallel.ai/v1/search';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_SOURCES = 8;
const MAX_EXCERPT_CHARACTERS = 16_000;
const MAX_QUERY_WORDS = 6;
const MAX_QUERY_CHARACTERS = 200;

const QUERY_STOP_WORDS = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with',
]);

type Fetch = typeof fetch;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeUrl(value: unknown): URL | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

function excerpts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [item.trim()];
    const entry = record(item);
    const text = entry?.text ?? entry?.excerpt ?? entry?.content;
    return typeof text === 'string' && text.trim() ? [text.trim()] : [];
  });
}

function normalizeSources(payload: unknown, runId: string): CinemaResearchSourceRecord[] {
  const root = record(payload);
  const results = Array.isArray(root?.results) ? root.results : [];
  const seen = new Set<string>();
  const retrievedAt = new Date().toISOString();
  return results.flatMap((value, index) => {
    const item = record(value);
    const url = safeUrl(item?.url);
    if (!item || !url || seen.has(url.href)) return [];
    const itemExcerpts = excerpts(item.excerpts);
    const fallbackFinding = typeof item.snippet === 'string' ? item.snippet.trim() : '';
    const finding = (itemExcerpts.join(' ').trim() || fallbackFinding).slice(0, 4_000);
    if (!finding) return [];
    seen.add(url.href);
    const title = typeof item.title === 'string' && item.title.trim()
      ? item.title.trim().slice(0, 500)
      : url.hostname;
    return [{
      id: `parallel-source-${String(index + 1).padStart(2, '0')}`,
      runId,
      title,
      publisher: url.hostname.replace(/^www\./, '').slice(0, 500),
      url: url.href,
      finding,
      queryPurpose: 'Location, production-design, cinematography, prop, and format reference',
      status: 'needs-verification' as const,
      creatorPinned: false,
      isMock: false,
      retrievedAt,
    }];
  }).slice(0, MAX_SOURCES);
}

function queryKeywords(value: string, limit: number): string[] {
  const words = value
    .normalize('NFKC')
    .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
  return words
    .map((word) => word.slice(0, 30))
    .filter((word) => !QUERY_STOP_WORDS.has(word.toLowerCase()))
    .slice(0, limit);
}

function keywordQuery(subject: string, suffix: string[]): string {
  const words = [...queryKeywords(subject, 3), ...suffix]
    .filter((word, index, all) => all.findIndex((entry) => entry.toLowerCase() === word.toLowerCase()) === index)
    .slice(0, MAX_QUERY_WORDS);
  while (words.length < 3) words.push('cinema');
  return words.join(' ').slice(0, MAX_QUERY_CHARACTERS);
}

function searchQueries(request: ResearchProviderRequest): string[] {
  const { brief } = request;
  return [
    keywordQuery(brief.locationPeriod, ['production', 'design']),
    keywordQuery(brief.genreTone, ['cinematography', 'lighting']),
    keywordQuery(`${brief.aspectRatio.replace(':', 'x')} ${brief.targetPlatform}`, ['shot', 'composition']),
  ];
}

function researchObjective(request: ResearchProviderRequest): string {
  const { brief } = request;
  return [
    `Find concise, credible filmmaking references for planning one ${brief.targetDurationSeconds}-second ${brief.creationMode} scene.`,
    `Scene: ${brief.sceneText}`,
    `Setting: ${brief.locationPeriod}.`,
    `Tone: ${brief.genreTone}.`,
    `Format: ${brief.aspectRatio} for ${brief.targetPlatform}.`,
    'Prioritize cinematography, production design, props, spatial continuity, and budget-aware shot coverage.',
  ].join(' ').slice(0, 5_000);
}

export class ParallelResearchProvider implements ResearchProvider {
  readonly id = 'parallel-search';

  constructor(
    private readonly apiKey: string,
    private readonly fetchImplementation: Fetch = fetch,
  ) {}

  async research(request: ResearchProviderRequest): Promise<ResearchProviderResult> {
    let response: Response;
    try {
      response = await this.fetchImplementation(PARALLEL_SEARCH_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          objective: researchObjective(request),
          search_queries: searchQueries(request),
          mode: 'basic',
          max_chars_total: MAX_EXCERPT_CHARACTERS,
          session_id: `cineserye_${request.runId}`.slice(0, 1_000),
          advanced_settings: {
            max_results: MAX_SOURCES,
          },
        }),
        signal: request.signal,
      });
    } catch (error) {
      if (request.signal.aborted) throw error;
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'Parallel research could not be reached.', true, { cause: error });
    }
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError('UNAUTHORIZED', 'Parallel research authorization failed.');
    }
    if (response.status === 429) {
      throw new ProviderError('RATE_LIMITED', 'Parallel research is temporarily rate limited.', true);
    }
    if (response.status === 408) {
      throw new ProviderError('TIMEOUT', 'Parallel research timed out.', true);
    }
    if (response.status === 400 || response.status === 422) {
      throw new ProviderError(
        'UNEXPECTED_RESPONSE',
        `Parallel rejected the research request (HTTP ${response.status}).`,
      );
    }
    if (!response.ok) {
      throw new ProviderError(
        'PROVIDER_UNAVAILABLE',
        `Parallel research could not complete this request (HTTP ${response.status}).`,
        response.status >= 500,
      );
    }
    const body = await response.text();
    if (body.length > MAX_RESPONSE_BYTES) {
      throw new ProviderError('UNEXPECTED_RESPONSE', 'Parallel research returned too much data.');
    }
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      throw new ProviderError('UNEXPECTED_RESPONSE', 'Parallel research returned invalid data.', true, { cause: error });
    }
    const sources = normalizeSources(payload, request.runId);
    return {
      provider: this.id,
      sources,
      warnings: sources.length
        ? []
        : ['Parallel returned no usable sources; the planner must stay conservative.'],
    };
  }
}
