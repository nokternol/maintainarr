import { and, eq, isNull } from 'drizzle-orm';

const defaultDelay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
import { mediaIdentity, mediaItems } from '@server/database/schema';
import type { DrizzleDb } from '@server/kernel/db';
import type { RadarrProvider } from './connections/radarrProvider';
import type { SonarrProvider } from './connections/sonarrProvider';
import { resolveGroup } from './groupResolver';

interface PlexBridgeProvider {
  getAllItems(): Promise<Array<{ ratingKey: string; guids?: { id: string }[] }>>;
}

interface TVMazeLookupProvider {
  lookupByTvdbId(tvdbId: number): Promise<{ id: number } | null>;
}

interface Deps {
  db: DrizzleDb;
  radarrProvider?: Pick<RadarrProvider, 'getMovies'>;
  /** The configured instance `radarrProvider` was constructed from — required alongside it. */
  radarrProviderId?: number;
  sonarrProvider?: Pick<SonarrProvider, 'getSeries'>;
  /** The configured instance `sonarrProvider` was constructed from — required alongside it. */
  sonarrProviderId?: number;
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
    if (!this.deps.sonarrProvider || this.deps.sonarrProviderId === undefined) return 0;
    const providerId = this.deps.sonarrProviderId;
    const series = await this.deps.sonarrProvider.getSeries();
    const now = Math.floor(Date.now() / 1000);
    let firstTVMazeCall = true;
    for (const s of series) {
      const identityId = await resolveGroup(this.deps.db, 'show', {
        tvdbId: s.tvdbId,
        tmdbId: s.tmdbId,
        imdbId: s.imdbId,
        tvMazeId: s.tvMazeId,
        title: s.title,
        year: s.year,
      });
      await this.upsertMediaItem(providerId, s.id, identityId, now);

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
            .where(and(eq(mediaIdentity.id, identityId), isNull(mediaIdentity.tvMazeId)));
        }
      }
    }

    return series.length;
  }

  async runForMovies(): Promise<number> {
    if (!this.deps.radarrProvider || this.deps.radarrProviderId === undefined) return 0;
    const providerId = this.deps.radarrProviderId;
    const movies = await this.deps.radarrProvider.getMovies();
    const now = Math.floor(Date.now() / 1000);
    for (const movie of movies) {
      const identityId = await resolveGroup(this.deps.db, 'movie', {
        tmdbId: movie.tmdbId,
        imdbId: movie.imdbId,
        title: movie.title,
        year: movie.year,
      });
      await this.upsertMediaItem(providerId, movie.id, identityId, now);
    }

    return movies.length;
  }

  /** Upsert a `media_item` row for one instance's copy, keyed `(providerId, externalId)`. */
  private async upsertMediaItem(
    providerId: number,
    externalId: number,
    mediaIdentityId: number,
    resolvedAt: number
  ): Promise<void> {
    await this.deps.db
      .insert(mediaItems)
      .values({ providerId, externalId, mediaIdentityId, resolvedAt })
      .onConflictDoUpdate({
        target: [mediaItems.providerId, mediaItems.externalId],
        set: { mediaIdentityId, resolvedAt },
      });
  }
}
