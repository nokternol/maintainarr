import { MetadataProviderType } from '../../../database/schema';
import type {
  OverseerrProvider,
  PlexProvider,
  TautulliProvider,
  TmdbProvider,
} from '../../providers';
import type { EnrichmentFields, MediaFieldProvider } from '../mediaFieldProvider';
import {
  overseerrFieldProvider,
  plexFieldProvider,
  tautulliFieldProvider,
} from '../mediaFieldProvider';
import type { MediaItem } from '../mediaItem';
import { decorate } from './decorate';
import type { EnrichmentResult, MediaEnricher } from './enricher';

/** Runs a `MediaFieldProvider`'s two-step visit→transform pipeline over one raw payload. */
function toFieldsByKey<
  TRaw,
  TMediaField,
  TFields extends Partial<EnrichmentFields>,
  TKey extends string | number,
>(provider: MediaFieldProvider<TRaw, TMediaField, TFields, TKey>, raw: TRaw): Map<TKey, TFields> {
  return new Map(
    [...provider.visit(raw)].map(([key, native]) => [key, provider.toEnrichmentFields(native)])
  );
}

export function plexEnricher(plex: PlexProvider): MediaEnricher<'playCount' | 'lastWatchedAt'> {
  return {
    enrich: async (items): Promise<EnrichmentResult<'playCount' | 'lastWatchedAt'>> => {
      const fieldsByKey = toFieldsByKey(plexFieldProvider, await plex.getAllItems());
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
      const fieldsByKey = toFieldsByKey(overseerrFieldProvider, [requests, issues]);
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
      const fieldsByKey = toFieldsByKey(tautulliFieldProvider, await tautulli.getHistory());
      return {
        provider: MetadataProviderType.TAUTULLI,
        items: decorate(items, (i) => i._sourceIds.plex, fieldsByKey),
      };
    },
  };
}
