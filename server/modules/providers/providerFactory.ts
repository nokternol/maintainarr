import type { MetadataProvider } from '@server/database/schema';
import { MetadataProviderType } from '@server/database/schema';
import type { Logger } from 'winston';
import { JellyfinProvider } from './connections/jellyfinProvider';
import { OmdbProvider } from './connections/omdbProvider';
import { OverseerrProvider } from './connections/overseerrProvider';
import { PlexProvider } from './connections/plexProvider';
import { RadarrProvider } from './connections/radarrProvider';
import { SonarrProvider } from './connections/sonarrProvider';
import { TautulliProvider } from './connections/tautulliProvider';
import { TmdbProvider } from './connections/tmdbProvider';
import { TvMazeProvider } from './connections/tvmazeProvider';

// TVmaze is a keyless public service — no configured provider required.
const TVMAZE_BASE_URL = 'https://api.tvmaze.com';

/** Every concrete provider the factory can construct from settings. */
export type AnyProvider =
  | RadarrProvider
  | SonarrProvider
  | PlexProvider
  | JellyfinProvider
  | TautulliProvider
  | OverseerrProvider
  | TmdbProvider
  | OmdbProvider;

/** Active providers resolved into typed, named slots — absent types stay undefined. */
export interface ProviderSet {
  radarr?: RadarrProvider;
  sonarr?: SonarrProvider;
  plex?: PlexProvider;
  tautulli?: TautulliProvider;
  overseerr?: OverseerrProvider;
  tmdb?: TmdbProvider;
}

export interface IProviderFactory {
  create(provider: MetadataProvider, logger: Logger): AnyProvider;
}

export class ProviderFactory implements IProviderFactory {
  /** Construct a single provider from its settings. The one place providers are `new`ed. */
  create(provider: MetadataProvider, logger: Logger): AnyProvider {
    switch (provider.type) {
      case MetadataProviderType.RADARR:
        return new RadarrProvider(provider, logger);
      case MetadataProviderType.SONARR:
        return new SonarrProvider(provider, logger);
      case MetadataProviderType.PLEX:
        return new PlexProvider(provider, logger);
      case MetadataProviderType.JELLYFIN:
        return new JellyfinProvider(provider, logger);
      case MetadataProviderType.TAUTULLI:
        return new TautulliProvider(provider, logger);
      case MetadataProviderType.OVERSEERR:
        return new OverseerrProvider(provider, logger);
      case MetadataProviderType.TMDB:
        return new TmdbProvider(provider, logger);
      case MetadataProviderType.OMDB:
        return new OmdbProvider(provider, logger);
      default:
        throw new Error(`Unsupported provider type: ${provider.type}`);
    }
  }

  /** Resolve a list of active provider settings into typed, named slots. */
  createMany(providers: MetadataProvider[], logger: Logger): ProviderSet {
    const set: ProviderSet = {};
    for (const settings of providers) {
      const provider = this.create(settings, logger);
      if (provider instanceof RadarrProvider) set.radarr = provider;
      else if (provider instanceof SonarrProvider) set.sonarr = provider;
      else if (provider instanceof PlexProvider) set.plex = provider;
      else if (provider instanceof TautulliProvider) set.tautulli = provider;
      else if (provider instanceof OverseerrProvider) set.overseerr = provider;
      else if (provider instanceof TmdbProvider) set.tmdb = provider;
    }
    return set;
  }

  /** The keyless TVmaze lookup provider, configured for the public TVmaze API. */
  createTvMaze(logger: Logger): TvMazeProvider {
    return new TvMazeProvider(
      { name: 'TVmaze', url: TVMAZE_BASE_URL, apiKey: null, settings: null },
      logger
    );
  }
}
