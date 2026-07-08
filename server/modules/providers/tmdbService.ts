import type { AppConfig } from '@server/kernel/config';
import { getChildLogger } from '@server/kernel/logger';
import ky from 'ky';
import { MediaCache } from '../media/media.cache';

const log = getChildLogger('TmdbService');

interface TmdbResult {
  backdrop_path?: string;
  media_type?: string;
}

export class TmdbService {
  private readonly cache = new MediaCache<string[]>(300_000); // 5 minutes
  private readonly config: AppConfig;
  private readonly baseUrl = 'https://api.themoviedb.org/3';

  constructor({ config }: { config: AppConfig }) {
    this.config = config;
    log.info('TmdbService initialized');
  }

  async getTrendingBackdrops(): Promise<string[]> {
    try {
      return await this.cache.getOrFetch('trending-backdrops', async () => {
        log.debug('Fetching trending content from TMDB');
        const data = await ky
          .get(`${this.baseUrl}/trending/all/week`, {
            searchParams: { api_key: this.config.TMDB_API_KEY, page: 1 },
          })
          .json<{ results: TmdbResult[] }>();

        const backdrops = (data.results ?? [])
          .filter((item) => item.media_type !== 'person' && item.backdrop_path)
          .map((item) => item.backdrop_path as string);

        log.info('Fetched TMDB backdrops', { count: backdrops.length });
        return backdrops;
      });
    } catch (error) {
      log.error('Failed to fetch TMDB backdrops', { error });
      return [];
    }
  }

  getImageUrl(backdropPath: string, size: 'original' | 'w1280' = 'original'): string {
    return `https://image.tmdb.org/t/p/${size}${backdropPath}`;
  }
}
