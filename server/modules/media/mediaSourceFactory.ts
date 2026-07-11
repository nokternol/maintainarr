import type { MetadataProviderType } from '@server/database/schema';
import { getChildLogger } from '@server/kernel/logger';
import {
  type IProviderFactory,
  type ProviderSettingsService,
  type RadarrProvider,
  SOURCE_OWNER_BY_KIND,
  type SonarrProvider,
} from '@server/modules/providers';
import type { ContentType } from './filterRegistry';
import type { MediaSource } from './mediaSource';
import { mediaSourceFor } from './sourceAdapters';

const log = getChildLogger('MediaSourceFactory');

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
      SOURCE_OWNER_BY_KIND[contentType],
    ]);
    if (!settings) return undefined;
    const provider = this.deps.providerFactory.create(settings, log) as
      | RadarrProvider
      | SonarrProvider;
    return mediaSourceFor(provider, settings.id);
  }
}

/** One content type's ownership, joined with whether the owner is configured. */
export interface MediaSourceDescriptor {
  contentType: ContentType;
  ownerType: MetadataProviderType;
  configured: boolean;
}

/**
 * Projects `SOURCE_OWNER_BY_KIND` for the client: which provider type owns each
 * content type, and whether an active instance of it exists. The wire surface of
 * the single ownership authority — clients derive from this, never re-declare it.
 */
export function sourceOwnership(configuredTypes: ReadonlySet<string>): MediaSourceDescriptor[] {
  return (Object.entries(SOURCE_OWNER_BY_KIND) as [ContentType, MetadataProviderType][]).map(
    ([contentType, ownerType]) => ({
      contentType,
      ownerType,
      configured: configuredTypes.has(ownerType),
    })
  );
}
