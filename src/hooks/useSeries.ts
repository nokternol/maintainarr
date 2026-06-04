import type { MediaFilters, MediaImage } from '@app/types/media';
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
