import styles from './RatingsDisplay.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TmdbRating {
  source: 'tmdb';
  tvRating?: number;
  tvVotes?: number;
  popularity?: number;
  found: boolean;
}

export interface OmdbRating {
  source: 'omdb';
  imdbRating?: number;
  imdbVotes?: number;
  rottenTomatoesRating?: number;
  metacriticRating?: number;
  found: boolean;
}

export interface TvmazeRating {
  source: 'tvmaze';
  rating?: number;
  found: boolean;
}

export interface RatingSummary {
  averageRating: number;
  totalSources: number;
  foundSources: number;
}

export interface AggregatedRatings {
  title: string;
  year?: number;
  tmdb?: TmdbRating;
  omdb?: OmdbRating;
  tvmaze?: TvmazeRating;
  summary: RatingSummary;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SourceCardProps {
  name: string;
  found: boolean;
  children?: React.ReactNode;
}

const SourceCard = ({ name, found, children }: SourceCardProps) => (
  <div className={styles.sourceCard}>
    <div className={styles.sourceHeader}>
      <span className={styles.sourceName}>{name}</span>
      {!found && <span className={styles.notFound}>Not found</span>}
    </div>
    {found && children && <div className={styles.sourceBody}>{children}</div>}
  </div>
);

interface RatingRowProps {
  label: string;
  value?: number | string;
}

const RatingRow = ({ label, value }: RatingRowProps) => {
  if (value === undefined || value === null) return null;
  return (
    <div className={styles.ratingRow}>
      <span className={styles.ratingLabel}>{label}</span>
      <span className={styles.ratingValue}>{value}</span>
    </div>
  );
};

// ─── Root Component ───────────────────────────────────────────────────────────

interface RatingsDisplayProps {
  ratings: AggregatedRatings | null;
}

const Root = ({ ratings }: RatingsDisplayProps) => {
  if (!ratings) return null;

  const { title, year, tmdb, omdb, tvmaze, summary } = ratings;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>{title}</h2>
          {year && <span className={styles.year}>{year}</span>}
        </div>
        <div className={styles.averageBlock}>
          <span className={styles.averageLabel}>Average</span>
          <span className={styles.averageValue}>{summary.averageRating.toFixed(2)}</span>
          <span className={styles.sourcesCount}>
            {summary.foundSources} of {summary.totalSources} sources
          </span>
        </div>
      </div>

      {/* Source Ratings */}
      <div className={styles.sources}>
        {tmdb && (
          <SourceCard name="TMDB" found={tmdb.found}>
            <RatingRow label="TV Rating" value={tmdb.tvRating} />
            <RatingRow label="Votes" value={tmdb.tvVotes?.toLocaleString()} />
            <RatingRow label="Popularity" value={tmdb.popularity?.toFixed(1)} />
          </SourceCard>
        )}

        {omdb && (
          <SourceCard name="OMDB" found={omdb.found}>
            <RatingRow label="IMDb Rating" value={omdb.imdbRating} />
            <RatingRow label="IMDb Votes" value={omdb.imdbVotes?.toLocaleString()} />
            <RatingRow
              label="Rotten Tomatoes"
              value={
                omdb.rottenTomatoesRating !== undefined
                  ? `${omdb.rottenTomatoesRating}%`
                  : undefined
              }
            />
            <RatingRow label="Metacritic" value={omdb.metacriticRating} />
          </SourceCard>
        )}

        {tvmaze && (
          <SourceCard name="TVMaze" found={tvmaze.found}>
            <RatingRow label="Rating" value={tvmaze.rating} />
          </SourceCard>
        )}
      </div>
    </div>
  );
};

export const RatingsDisplay = Object.assign(Root, {
  SourceCard,
  RatingRow,
});

export default RatingsDisplay;
