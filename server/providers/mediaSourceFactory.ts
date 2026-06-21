import { MetadataProviderType } from '../database/schema';
import { getChildLogger } from '../logger';
import type { ProviderSettingsService } from '../services/providerSettingsService';
import type { ContentType } from '../utils/filterRegistry';
import type { MediaSource } from './mediaSource';
import type { IProviderFactory } from './providerFactory';

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

export { OWNER_TYPE };
