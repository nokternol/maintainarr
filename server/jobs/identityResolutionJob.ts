import { and, eq, sql } from 'drizzle-orm';

const defaultDelay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
import type { DrizzleDb } from '../database';
import { mediaIdentity } from '../database/schema';
import type { RadarrProvider } from '../providers/radarrProvider';
import type { SonarrProvider } from '../providers/sonarrProvider';

interface PlexBridgeProvider {
  getAllItems(): Promise<Array<{ ratingKey: string; guids?: { id: string }[] }>>;
}

interface TVMazeLookupProvider {
  lookupByTvdbId(tvdbId: number): Promise<{ id: number } | null>;
}

interface Deps {
  db: DrizzleDb;
  radarrProvider?: Pick<RadarrProvider, 'getMovies'>;
  sonarrProvider?: Pick<SonarrProvider, 'getSeries'>;
  plexProvider?: PlexBridgeProvider;
  tvMazeLookup?: TVMazeLookupProvider;
  delay?: (ms: number) => Promise<void>;
}

export class IdentityResolutionJob {
  constructor(private deps: Deps) {}

  async runForPlex(): Promise<number> {
    if (!this.deps.plexProvider) return 0;
    const items = await this.deps.plexProvider.getAllItems();
    let changed = 0;
    for (const item of items) {
      for (const guid of item.guids ?? []) {
        const tmdbMatch = guid.id.match(/^tmdb:\/\/(\d+)$/);
        const tvdbMatch = guid.id.match(/^thetvdb:\/\/(\d+)$/);
        if (tmdbMatch) {
          changed += await this.setPlexRatingKey(
            mediaIdentity.tmdbId,
            Number.parseInt(tmdbMatch[1], 10),
            item.ratingKey
          );
        } else if (tvdbMatch) {
          changed += await this.setPlexRatingKey(
            mediaIdentity.tvdbId,
            Number.parseInt(tvdbMatch[1], 10),
            item.ratingKey
          );
        }
      }
    }

    return changed;
  }

  /** Stamp a Plex ratingKey onto identities matching `column = id`; returns rows actually changed. */
  private async setPlexRatingKey(
    column: typeof mediaIdentity.tmdbId | typeof mediaIdentity.tvdbId,
    id: number,
    ratingKey: string
  ): Promise<number> {
    const result = await this.deps.db
      .update(mediaIdentity)
      .set({ plexRatingKey: ratingKey })
      .where(eq(column, id));
    return result.rowsAffected;
  }

  async runForSeries(): Promise<number> {
    if (!this.deps.sonarrProvider) return 0;
    const series = await this.deps.sonarrProvider.getSeries();
    const now = Math.floor(Date.now() / 1000);
    let firstTVMazeCall = true;
    for (const s of series) {
      await this.deps.db
        .insert(mediaIdentity)
        .values({
          sourceType: 'SONARR',
          sourceId: s.id,
          tvdbId: s.tvdbId,
          tmdbId: s.tmdbId ?? null,
          imdbId: s.imdbId ?? null,
          tvMazeId: s.tvMazeId ?? null,
          resolvedAt: now,
        })
        .onConflictDoUpdate({
          target: [mediaIdentity.sourceType, mediaIdentity.sourceId],
          set: {
            tvdbId: sql`excluded.tvdbId`,
            tmdbId: sql`excluded.tmdbId`,
            imdbId: sql`excluded.imdbId`,
            tvMazeId: sql`excluded.tvMazeId`,
            resolvedAt: sql`excluded.resolvedAt`,
          },
        });

      if (!s.tvMazeId && this.deps.tvMazeLookup && s.tvdbId) {
        if (!firstTVMazeCall) {
          await (this.deps.delay ?? defaultDelay)(500);
        }
        firstTVMazeCall = false;
        const result = await this.deps.tvMazeLookup.lookupByTvdbId(s.tvdbId);
        if (result) {
          await this.deps.db
            .update(mediaIdentity)
            .set({ tvMazeId: result.id })
            .where(and(eq(mediaIdentity.sourceType, 'SONARR'), eq(mediaIdentity.sourceId, s.id)));
        }
      }
    }

    return series.length;
  }

  async runForMovies(): Promise<number> {
    if (!this.deps.radarrProvider) return 0;
    const movies = await this.deps.radarrProvider.getMovies();
    const now = Math.floor(Date.now() / 1000);
    for (const movie of movies) {
      await this.deps.db
        .insert(mediaIdentity)
        .values({
          sourceType: 'RADARR',
          sourceId: movie.id,
          tmdbId: movie.tmdbId,
          imdbId: movie.imdbId ?? null,
          resolvedAt: now,
        })
        .onConflictDoUpdate({
          target: [mediaIdentity.sourceType, mediaIdentity.sourceId],
          set: {
            tmdbId: sql`excluded.tmdbId`,
            imdbId: sql`excluded.imdbId`,
            resolvedAt: sql`excluded.resolvedAt`,
          },
        });
    }

    return movies.length;
  }
}
