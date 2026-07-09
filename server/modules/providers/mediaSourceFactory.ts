import { MetadataProviderType } from '@server/database/schema';
import { getChildLogger } from '@server/kernel/logger';
// Leaf type import, not the media interface: importing the module index here
// would be circular (media's index pulls in providers' index via
// mediaQueryEngine.ts, which this file is part of).
import type { ContentType } from '@server/modules/media/filterRegistry';
import type { MediaSource } from './mediaSource';
import type { IProviderFactory } from './providerFactory';
import type { ProviderSettingsService } from './providerSettingsService';

const log = getChildLogger('MediaSourceFactory');

/** The provider type that owns each content type under the single-active invariant. */
const OWNER_TYPE: Record<ContentType, MetadataProviderType> = {
  movie: MetadataProviderType.RADARR,
  show: MetadataProviderType.SONARR,
};

interface Deps {
  providerSettingsService: ProviderSettingsService;
  providerFactory: IProviderFactory;
}

/**
 * Resolves a content type to the active owner provider bound as a `MediaSource`.
 * Consolidates owner-type lookup, active-settings resolution, and provider
 * construction so handlers ask only "give me the source for this content type".
 */
export class MediaSourceFactory {
  constructor(private readonly deps: Deps) {}

  async forContentType(contentType: ContentType): Promise<MediaSource | undefined> {
    const [settings] = await this.deps.providerSettingsService.findActiveByTypes([
      OWNER_TYPE[contentType],
    ]);
    if (!settings) return undefined;
    return this.deps.providerFactory.create(settings, log) as MediaSource;
  }
}

/** One content type's ownership, joined with whether the owner is configured. */
export interface MediaSourceDescriptor {
  contentType: ContentType;
  ownerType: MetadataProviderType;
  configured: boolean;
}

/**
 * Projects `OWNER_TYPE` for the client: which provider type owns each content
 * type, and whether an active instance of it exists. The wire surface of the
 * single ownership authority — clients derive from this, never re-declare it.
 */
export function sourceOwnership(configuredTypes: ReadonlySet<string>): MediaSourceDescriptor[] {
  return (Object.entries(OWNER_TYPE) as [ContentType, MetadataProviderType][]).map(
    ([contentType, ownerType]) => ({
      contentType,
      ownerType,
      configured: configuredTypes.has(ownerType),
    })
  );
}

export { OWNER_TYPE };
