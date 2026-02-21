import { BaseMetadataProvider } from './baseMetadataProvider';

export interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  media_type: 'movie' | 'tv';
  vote_average: number;
  vote_count: number;
  popularity: number;
  release_date?: string;
  first_air_date?: string;
  overview: string;
}

export interface TmdbMovieDetails {
  id: number;
  title: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  release_date: string;
  runtime: number;
  genres: Array<{ id: number; name: string }>;
  imdb_id: string;
}

export interface TmdbTvDetails {
  id: number;
  name: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  first_air_date: string;
  number_of_seasons: number;
  genres: Array<{ id: number; name: string }>;
}

export interface TmdbRating {
  source: 'tmdb';
  movieRating?: number;
  movieVotes?: number;
  tvRating?: number;
  tvVotes?: number;
  popularity?: number;
  found: boolean;
}

export class TmdbProvider extends BaseMetadataProvider {
  private get apiParams() {
    return { api_key: this.provider.apiKey || '' };
  }

  public async search(query: string): Promise<TmdbSearchResult[]> {
    const response = await this.client.get('search/multi', {
      searchParams: {
        ...this.apiParams,
        query,
        include_adult: false,
      },
    });
    const data = await response.json<{ results: TmdbSearchResult[] }>();
    return data.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv');
  }

  public async getMovieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
    return this.client.get(`movie/${tmdbId}`, { searchParams: this.apiParams }).json();
  }

  public async getTvDetails(tmdbId: number): Promise<TmdbTvDetails> {
    return this.client.get(`tv/${tmdbId}`, { searchParams: this.apiParams }).json();
  }

  public async getRatings(title: string, year?: number): Promise<TmdbRating> {
    try {
      const results = await this.search(title);

      if (results.length === 0) {
        return { source: 'tmdb', found: false };
      }

      let bestMatch = results[0];
      if (year) {
        const yearMatch = results.find((r) => {
          const releaseYear = r.release_date
            ? new Date(r.release_date).getFullYear()
            : r.first_air_date
              ? new Date(r.first_air_date).getFullYear()
              : null;
          return releaseYear === year;
        });
        if (yearMatch) bestMatch = yearMatch;
      }

      if (bestMatch.media_type === 'movie') {
        const details = await this.getMovieDetails(bestMatch.id);
        return {
          source: 'tmdb',
          movieRating: details.vote_average,
          movieVotes: details.vote_count,
          popularity: details.popularity,
          found: true,
        };
      }

      const details = await this.getTvDetails(bestMatch.id);
      return {
        source: 'tmdb',
        tvRating: details.vote_average,
        tvVotes: details.vote_count,
        popularity: details.popularity,
        found: true,
      };
    } catch (error) {
      this.log.warn('Failed to get TMDB ratings', { title, error });
      return { source: 'tmdb', found: false };
    }
  }
}
