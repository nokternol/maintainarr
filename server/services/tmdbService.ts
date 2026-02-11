import axios from 'axios';
import NodeCache from 'node-cache';
import type { AppConfig } from '../config';
import { getChildLogger } from '../logger';

const log = getChildLogger('TmdbService');

interface TmdbResult {
  backdrop_path?: string;
  media_type?: string;
}

export class TmdbService {
  private cache: NodeCache;
  private readonly baseUrl = 'https://api.themoviedb.org/3';

  constructor(private readonly config: AppConfig) {
    this.cache = new NodeCache({ stdTTL: 300 }); // 5-minute cache
    log.info('TmdbService initialized');
  }

  async getTrendingBackdrops(): Promise<string[]> {
    const cacheKey = 'trending-backdrops';
    const cached = this.cache.get<string[]>(cacheKey);

    if (cached) {
      log.debug('Returning cached backdrops', { count: cached.length });
      return cached;
    }

    try {
      log.debug('Fetching trending content from TMDB');
      const response = await axios.get(`${this.baseUrl}/trending/all/week`, {
        params: { api_key: this.config.TMDB_API_KEY, page: 1 },
      });

      const results: TmdbResult[] = response.data.results || [];
      const backdrops = results
        .filter((item) => item.media_type !== 'person' && item.backdrop_path)
        .map((item) => item.backdrop_path as string);

      log.info('Fetched TMDB backdrops', { count: backdrops.length });
      this.cache.set(cacheKey, backdrops);
      return backdrops;
    } catch (error) {
      log.error('Failed to fetch TMDB backdrops', { error });
      return []; // Graceful degradation
    }
  }

  getImageUrl(backdropPath: string, size: 'original' | 'w1280' = 'original'): string {
    return `https://image.tmdb.org/t/p/${size}${backdropPath}`;
  }
}
