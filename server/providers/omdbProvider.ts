import { BaseMetadataProvider } from './baseMetadataProvider';

export interface OmdbRatings {
  Source: string;
  Value: string;
}

export interface OmdbResponse {
  Title: string;
  Year: string;
  Type: 'movie' | 'series' | 'episode';
  imdbID: string;
  imdbRating: string;
  imdbVotes: string;
  Ratings: OmdbRatings[];
  Response: 'True' | 'False';
  Error?: string;
  Awards?: string;
  Director?: string;
  Actors?: string;
  Language?: string;
  Country?: string;
  BoxOffice?: string;
}

export interface OmdbRating {
  source: 'omdb';
  imdbRating?: number;
  imdbVotes?: number;
  rottenTomatoesRating?: number;
  metacriticRating?: number;
  found: boolean;
  awardWinner?: boolean;
  oscarWinner?: boolean;
  director?: string;
  actors?: string;
  language?: string;
  boxOffice?: number;
}

export class OmdbProvider extends BaseMetadataProvider {
  public async getRatings(title: string, year?: number): Promise<OmdbRating> {
    try {
      const params: Record<string, string> = {
        apikey: this.provider.apiKey || '',
        t: title,
        type: 'movie',
      };

      if (year) {
        params.y = year.toString();
      }

      const response = await this.client.get('', { searchParams: params });
      const data = await response.json<OmdbResponse>();

      if (data.Response === 'False') {
        params.type = 'series';
        const seriesResponse = await this.client.get('', { searchParams: params });
        const seriesData = await seriesResponse.json<OmdbResponse>();

        if (seriesData.Response === 'False') {
          return { source: 'omdb', found: false };
        }

        return this.parseRatings(seriesData);
      }

      return this.parseRatings(data);
    } catch (error) {
      this.log.warn('Failed to get OMDB ratings', { title, error });
      return { source: 'omdb', found: false };
    }
  }

  private parseRatings(data: OmdbResponse): OmdbRating {
    const result: OmdbRating = {
      source: 'omdb',
      found: true,
    };

    if (data.imdbRating && data.imdbRating !== 'N/A') {
      result.imdbRating = Number.parseFloat(data.imdbRating);
      result.imdbVotes = this.parseVotes(data.imdbVotes);
    }

    const rtRating = data.Ratings?.find((r) => r.Source === 'Rotten Tomatoes');
    if (rtRating) {
      const match = rtRating.Value.match(/(\d+)%/);
      if (match) {
        result.rottenTomatoesRating = Number.parseInt(match[1], 10);
      }
    }

    const mcRating = data.Ratings?.find((r) => r.Source === 'Metacritic');
    if (mcRating) {
      const match = mcRating.Value.match(/(\d+)\/100/);
      if (match) {
        result.metacriticRating = Number.parseInt(match[1], 10);
      }
    }

    const awards = data.Awards;
    result.awardWinner = !this.isNaOrEmpty(awards) && /won/i.test(awards as string);
    result.oscarWinner = !this.isNaOrEmpty(awards) && /won .+ oscar/i.test(awards as string);

    const director = this.presentValue(data.Director);
    if (director) result.director = director;

    const actors = this.presentValue(data.Actors);
    if (actors) result.actors = actors;

    const language = this.presentValue(data.Language);
    if (language) result.language = language;

    const boxOffice = this.parseBoxOffice(data.BoxOffice);
    if (boxOffice !== undefined) result.boxOffice = boxOffice;

    return result;
  }

  private isNaOrEmpty(value: string | undefined): boolean {
    return !value || value === 'N/A';
  }

  private presentValue(value: string | undefined): string | undefined {
    if (this.isNaOrEmpty(value)) return undefined;
    return (value as string).trim();
  }

  private parseBoxOffice(value: string | undefined): number | undefined {
    if (this.isNaOrEmpty(value)) return undefined;
    const parsed = Number.parseInt((value as string).replace(/[$,]/g, ''), 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private parseVotes(votes: string): number {
    if (!votes || votes === 'N/A') return 0;
    return Number.parseInt(votes.replace(/,/g, ''), 10);
  }
}
