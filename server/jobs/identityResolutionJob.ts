import { eq, sql } from 'drizzle-orm';
import type { DrizzleDb } from '../database';
import { mediaIdentity } from '../database/schema';
import type { RadarrProvider } from '../providers/radarrProvider';
import type { SonarrProvider } from '../providers/sonarrProvider';

interface PlexBridgeProvider {
  getAllItems(): Promise<Array<{ ratingKey: string; guids?: { id: string }[] }>>;
}

interface Deps {
  db: DrizzleDb;
  radarrProvider?: Pick<RadarrProvider, 'getMovies'>;
  sonarrProvider?: Pick<SonarrProvider, 'getSeries'>;
  plexProvider?: PlexBridgeProvider;
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
