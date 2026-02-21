import type { OmdbRating } from '@server/providers/omdbProvider';
import type { TmdbRating } from '@server/providers/tmdbProvider';
import type { TvMazeRating } from '@server/providers/tvmazeProvider';

export interface AggregatedRatings {
  title: string;
  year?: number;
  tmdb?: TmdbRating;
  omdb?: OmdbRating;
  tvmaze?: TvMazeRating;
  summary: {
    averageRating?: number;
    totalSources: number;
    foundSources: number;
  };
}

export class RatingsAggregationService {
  aggregate(
    title: string,
    year: number | undefined,
    tmdb?: TmdbRating,
    omdb?: OmdbRating,
    tvmaze?: TvMazeRating
  ): AggregatedRatings {
    const ratings: AggregatedRatings = {
      title,
      year,
      tmdb,
      omdb,
      tvmaze,
      summary: {
        totalSources: 0,
        foundSources: 0,
      },
    };

    if (tmdb) ratings.summary.totalSources++;
    if (omdb) ratings.summary.totalSources++;
    if (tvmaze) ratings.summary.totalSources++;

    if (tmdb?.found) ratings.summary.foundSources++;
    if (omdb?.found) ratings.summary.foundSources++;
    if (tvmaze?.found) ratings.summary.foundSources++;

    const normalizedRatings: number[] = [];

    if (tmdb?.found) {
      if (tmdb.movieRating) normalizedRatings.push(tmdb.movieRating);
      else if (tmdb.tvRating) normalizedRatings.push(tmdb.tvRating);
    }

    if (omdb?.found && omdb.imdbRating) {
      normalizedRatings.push(omdb.imdbRating);
    }

    if (tvmaze?.found && tvmaze.rating) {
      normalizedRatings.push(tvmaze.rating);
    }

    if (normalizedRatings.length > 0) {
      const sum = normalizedRatings.reduce((acc, r) => acc + r, 0);
      ratings.summary.averageRating = Number((sum / normalizedRatings.length).toFixed(2));
    }

    return ratings;
  }

  formatRating(rating: number | undefined, maxScale = 10): string {
    if (rating === undefined) return 'N/A';
    return `${rating.toFixed(1)}/${maxScale}`;
  }

  getSummary(aggregated: AggregatedRatings): string {
    const { foundSources, totalSources, averageRating } = aggregated.summary;

    if (foundSources === 0) {
      return `No ratings found from ${totalSources} source(s)`;
    }

    const avg = averageRating ? this.formatRating(averageRating) : 'N/A';
    return `Average: ${avg} from ${foundSources}/${totalSources} source(s)`;
  }
}
