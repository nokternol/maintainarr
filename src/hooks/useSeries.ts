import type { MediaFilters } from '@app/types/media';
import type { MediaImage } from './useMedia';
import { usePaginatedMedia } from './usePaginatedMedia';

export type { MediaFilters };

export interface ManagedSeries {
  id: number;
  title: string;
  year?: number;
  status: string;
  monitored: boolean;
  tvdbId: number;
  images?: MediaImage[];
}

export const useSeries = (filters?: MediaFilters) =>
  usePaginatedMedia<ManagedSeries>('/api/media/series', filters);
