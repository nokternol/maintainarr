import { MetadataProviderType } from '../../../database/schema';
import type {
  OverseerrProvider,
  PlexProvider,
  TautulliProvider,
  TmdbProvider,
} from '../../providers';
import type { MediaItem } from '../mediaItem';
import { decorate } from './decorate';
import type { EnrichmentResult, MediaEnricher } from './enricher';
import { mapOverseerr, mapPlexItems, mapTautulliHistory } from './mappers';

export function plexEnricher(plex: PlexProvider): MediaEnricher<'playCount' | 'lastWatchedAt'> {
  return {
    enrich: async (items): Promise<EnrichmentResult<'playCount' | 'lastWatchedAt'>> => {
      const fieldsByKey = mapPlexItems(await plex.getAllItems());
      return {
        provider: MetadataProviderType.PLEX,
        items: decorate(items, (i) => i._sourceIds.plex, fieldsByKey),
      };
    },
  };
}

export function overseerrEnricher(
  overseerr: OverseerrProvider
): MediaEnricher<'overseerrRequestStatus' | 'overseerrHasIssue'> {
  return {
    enrich: async (
      items
    ): Promise<EnrichmentResult<'overseerrRequestStatus' | 'overseerrHasIssue'>> => {
      const [requests, issues] = await Promise.all([
        overseerr.getRequests(),
        overseerr.getIssues(),
      ]);
      const fieldsByKey = mapOverseerr(requests, issues);
      return {
        provider: MetadataProviderType.OVERSEERR,
        items: decorate(items, (i) => i._sourceIds.tmdb, fieldsByKey),
      };
    },
  };
}

export function tmdbEnricher(tmdb: TmdbProvider): MediaEnricher<'tmdbStatus'> {
  return {
    enrich: async (items): Promise<EnrichmentResult<'tmdbStatus'>> => {
      const fieldsByKey = new Map<number, Pick<MediaItem, 'tmdbStatus'>>();
      for (const item of items) {
        const tmdbId = item._sourceIds.tmdb;
        if (tmdbId === undefined || fieldsByKey.has(tmdbId)) continue;
        const status = await tmdb.getStatus(tmdbId);
        if (status !== undefined) fieldsByKey.set(tmdbId, { tmdbStatus: status });
      }
      return {
        provider: MetadataProviderType.TMDB,
        items: decorate(items, (i) => i._sourceIds.tmdb, fieldsByKey),
      };
    },
  };
}

export function tautulliEnricher(
  tautulli: TautulliProvider
): MediaEnricher<'playCount' | 'lastWatchedAt'> {
  return {
    enrich: async (items): Promise<EnrichmentResult<'playCount' | 'lastWatchedAt'>> => {
      const fieldsByKey = mapTautulliHistory(await tautulli.getHistory());
      return {
        provider: MetadataProviderType.TAUTULLI,
        items: decorate(items, (i) => i._sourceIds.plex, fieldsByKey),
      };
    },
  };
}
