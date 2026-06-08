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

  async runForPlex(): Promise<void> {
    if (!this.deps.plexProvider) return;
    const items = await this.deps.plexProvider.getAllItems();
    for (const item of items) {
      for (const guid of item.guids ?? []) {
        const tmdbMatch = guid.id.match(/^tmdb:\/\/(\d+)$/);
        const tvdbMatch = guid.id.match(/^thetvdb:\/\/(\d+)$/);
        if (tmdbMatch) {
          await this.deps.db
            .update(mediaIdentity)
            .set({ plexRatingKey: item.ratingKey })
            .where(eq(mediaIdentity.tmdbId, Number.parseInt(tmdbMatch[1], 10)));
        } else if (tvdbMatch) {
          await this.deps.db
            .update(mediaIdentity)
            .set({ plexRatingKey: item.ratingKey })
            .where(eq(mediaIdentity.tvdbId, Number.parseInt(tvdbMatch[1], 10)));
        }
      }
    }
  }

  async runForSeries(): Promise<void> {
    if (!this.deps.sonarrProvider) return;
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
  }

  async runForMovies(): Promise<void> {
    if (!this.deps.radarrProvider) return;
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
  }
}
