import { BaseMetadataProvider } from './baseMetadataProvider';

export interface TvMazeSearchResult {
  score: number;
  show: TvMazeShow;
}

export interface TvMazeShow {
  id: number;
  name: string;
  type: string;
  language: string;
  genres: string[];
  status: string;
  premiered: string;
  rating: {
    average: number | null;
  };
  network: {
    name: string;
    country: { name: string };
  } | null;
  externals: {
    tvrage: number | null;
    thetvdb: number | null;
    imdb: string | null;
  };
}

export interface TvMazeRating {
  source: 'tvmaze';
  rating?: number;
  found: boolean;
}

export class TvMazeProvider extends BaseMetadataProvider {
  public async search(query: string): Promise<TvMazeSearchResult[]> {
    const response = await this.client.get('search/shows', {
      searchParams: { q: query },
    });
    return response.json<TvMazeSearchResult[]>();
  }

  public async getShow(tvmazeId: number): Promise<TvMazeShow> {
    return this.client.get(`shows/${tvmazeId}`).json();
  }

  public async getRatings(title: string, year?: number): Promise<TvMazeRating> {
    try {
      const results = await this.search(title);

      if (results.length === 0) {
        return { source: 'tvmaze', found: false };
      }

      let bestMatch = results[0].show;
      if (year && results.length > 1) {
        const yearMatch = results.find((r) => {
          const premiered = r.show.premiered;
          if (!premiered) return false;
          const premiereYear = new Date(premiered).getFullYear();
          return premiereYear === year;
        });
        if (yearMatch) bestMatch = yearMatch.show;
      }

      if (!bestMatch.rating?.average) {
        return { source: 'tvmaze', found: false };
      }

      return {
        source: 'tvmaze',
        rating: bestMatch.rating.average,
        found: true,
      };
    } catch (error) {
      this.log.warn('Failed to get TVMaze ratings', { title, error });
      return { source: 'tvmaze', found: false };
    }
  }
}
