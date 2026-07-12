import { and, eq, isNull, notInArray } from 'drizzle-orm';

const defaultDelay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
import { mediaIdentity, mediaItems } from '@server/database/schema';
import type { DrizzleDb } from '@server/kernel/db';
import type { RadarrProvider } from './connections/radarrProvider';
import type { SonarrProvider } from './connections/sonarrProvider';
import { resolveGroup } from './groupResolver';
import type { MediaKind } from './roles';

interface PlexBridgeProvider {
  getAllItems(): Promise<Array<{ ratingKey: string; type?: string; guids?: { id: string }[] }>>;
}

interface TVMazeLookupProvider {
  lookupByTvdbId(tvdbId: number): Promise<{ id: number } | null>;
}

const PLEX_KIND: Record<string, MediaKind> = { movie: 'movie', show: 'show' };

interface Deps {
  db: DrizzleDb;
  /** One entry per active Radarr instance. Never collapsed to one. */
  movieSources?: Array<{ providerId: number; provider: Pick<RadarrProvider, 'getMovies'> }>;
  /** One entry per active Sonarr instance. Never collapsed to one. */
  seriesSources?: Array<{ providerId: number; provider: Pick<SonarrProvider, 'getSeries'> }>;
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
      const kind = item.type ? PLEX_KIND[item.type] : undefined;
      for (const guid of item.guids ?? []) {
        const tmdbMatch = guid.id.match(/^tmdb:\/\/(\d+)$/);
        const tvdbMatch = guid.id.match(/^thetvdb:\/\/(\d+)$/);
        if (tmdbMatch) {
          changed += await this.setPlexRatingKey(
            mediaIdentity.tmdbId,
            Number.parseInt(tmdbMatch[1], 10),
            item.ratingKey,
            kind
          );
        } else if (tvdbMatch) {
          changed += await this.setPlexRatingKey(
            mediaIdentity.tvdbId,
            Number.parseInt(tvdbMatch[1], 10),
            item.ratingKey,
            kind
          );
        }
      }
    }

    return changed;
  }

  /**
   * Stamp a Plex ratingKey onto identities matching `column = id`, scoped by `kind` when
   * known (an unscoped match could otherwise cross the movie/tv id namespaces — a TMDB
   * movie id and a TMDB tv id with the same number are different titles). Returns rows
   * actually changed.
   */
  private async setPlexRatingKey(
    column: typeof mediaIdentity.tmdbId | typeof mediaIdentity.tvdbId,
    id: number,
    ratingKey: string,
    kind: MediaKind | undefined
  ): Promise<number> {
    const result = await this.deps.db
      .update(mediaIdentity)
      .set({ plexRatingKey: ratingKey })
      .where(kind ? and(eq(column, id), eq(mediaIdentity.kind, kind)) : eq(column, id));
    return result.rowsAffected;
  }

  async runForSeries(): Promise<number> {
    const sources = this.deps.seriesSources ?? [];
    if (sources.length === 0) return 0;

    let total = 0;
    let firstTVMazeCall = true;
    for (const { providerId, provider } of sources) {
      const series = await provider.getSeries();
      const now = Math.floor(Date.now() / 1000);
      const fetchedExternalIds: number[] = [];
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
        fetchedExternalIds.push(s.id);

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
      await this.pruneStaleItems(providerId, fetchedExternalIds);
      total += series.length;
    }

    await this.sweepOrphanGroups();
    return total;
  }

  async runForMovies(): Promise<number> {
    const sources = this.deps.movieSources ?? [];
    if (sources.length === 0) return 0;

    let total = 0;
    for (const { providerId, provider } of sources) {
      const movies = await provider.getMovies();
      const now = Math.floor(Date.now() / 1000);
      const fetchedExternalIds: number[] = [];
      for (const movie of movies) {
        const identityId = await resolveGroup(this.deps.db, 'movie', {
          tmdbId: movie.tmdbId,
          imdbId: movie.imdbId,
          title: movie.title,
          year: movie.year,
        });
        await this.upsertMediaItem(providerId, movie.id, identityId, now);
        fetchedExternalIds.push(movie.id);
      }
      await this.pruneStaleItems(providerId, fetchedExternalIds);
      total += movies.length;
    }

    await this.sweepOrphanGroups();
    return total;
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

  /** Delete this instance's `media_item` rows whose externalId is no longer in its fetched set. */
  private async pruneStaleItems(providerId: number, fetchedExternalIds: number[]): Promise<void> {
    await this.deps.db
      .delete(mediaItems)
      .where(
        fetchedExternalIds.length > 0
          ? and(
              eq(mediaItems.providerId, providerId),
              notInArray(mediaItems.externalId, fetchedExternalIds)
            )
          : eq(mediaItems.providerId, providerId)
      );
  }

  /** Delete groups left with zero `media_item` rows — enrichment cascades. */
  private async sweepOrphanGroups(): Promise<void> {
    const remaining = await this.deps.db
      .selectDistinct({ id: mediaItems.mediaIdentityId })
      .from(mediaItems);
    const remainingIds = remaining.map((r) => r.id);
    await this.deps.db
      .delete(mediaIdentity)
      .where(remainingIds.length > 0 ? notInArray(mediaIdentity.id, remainingIds) : undefined);
  }
}
