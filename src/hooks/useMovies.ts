import type { MediaFilters } from '@app/types/media';
import type { MediaImage } from './useMedia';
import { usePaginatedMedia } from './usePaginatedMedia';

export type { MediaFilters };

export interface ManagedMovie {
  id: number;
  title: string;
  year?: number;
  hasFile: boolean;
  monitored: boolean;
  tmdbId: number;
  images?: MediaImage[];
}

export const useMovies = (filters?: MediaFilters) =>
  usePaginatedMedia<ManagedMovie>('/api/media/movies', filters);
