import { z } from 'zod';

export const STORY_GENRES = ['Horror', 'Mystery', 'Thriller', 'Drama', 'Comedy', 'Romance', 'Science fiction', 'Fantasy', 'Adventure', 'Action', 'Documentary', 'Animation'] as const;
/** Optional creative labels, not a requirement to choose a category. */
export const StoryGenresSchema = z.array(z.string().trim().min(1).max(60)).max(5)
  .refine((values) => new Set(values.map((value) => value.toLocaleLowerCase())).size === values.length, 'Choose each genre only once.');

export function storyGenreTone(brief: { genres?: string[]; tone: string }) {
  const genres = brief.genres ?? [];
  return [...genres, ...(!genres.some((genre) => genre.toLocaleLowerCase() === brief.tone.toLocaleLowerCase()) ? [brief.tone] : [])].filter(Boolean).join(' · ');
}
