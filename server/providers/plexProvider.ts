import { MetadataProviderType } from '../database/schema';
import { decorate } from '../jobs/enrichment/decorate';
import { mapPlexItems } from '../jobs/enrichment/mappers';
import { BaseProviderConnection } from './baseProviderConnection';
import type { EnrichmentResult, MediaEnricher, MediaItem } from './roles';

export interface PlexLibrary {
  key: string;
  title: string;
  type: string;
}

export interface PlexMediaItem {
  ratingKey: string;
  title: string;
  type: string;
  year?: number;
  thumb?: string;
  guids?: { id: string }[];
  viewCount?: number;
  lastViewedAt?: number;
}

/**
 * PlexProvider handles metadata gathering from a Plex Media Server instance.
 * Auth token validation against plex.tv lives in services/plexService.ts (PlexService).
 */
export class PlexProvider extends BaseProviderConnection implements MediaEnricher {
  async enrich(items: MediaItem[]): Promise<EnrichmentResult> {
    const fieldsByKey = mapPlexItems(await this.getAllItems());
    return {
      provider: MetadataProviderType.PLEX,
      items: decorate(items, (i) => i._sourceIds.plex, fieldsByKey),
    };
  }

  private get authHeader() {
    return {
      'X-Plex-Token': this.provider.apiKey ?? '',
      Accept: 'application/json',
    };
  }

  public async getLibraries(): Promise<PlexLibrary[]> {
    const resp = await this.client
      .get('library/sections', { headers: this.authHeader })
      .json<{ MediaContainer: { Directory: PlexLibrary[] } }>();
    return resp.MediaContainer.Directory;
  }

  public async getLibraryContents(libraryKey: string): Promise<PlexMediaItem[]> {
    const resp = await this.client
      .get(`library/sections/${libraryKey}/all`, { headers: this.authHeader })
      .json<{ MediaContainer: { Metadata: PlexMediaItem[] } }>();
    return resp.MediaContainer.Metadata;
  }

  public async getAllItems(): Promise<PlexMediaItem[]> {
    const libraries = await this.getLibraries();
    const nested = await Promise.all(libraries.map((lib) => this.getLibraryContents(lib.key)));
    return nested.flat();
  }
}
