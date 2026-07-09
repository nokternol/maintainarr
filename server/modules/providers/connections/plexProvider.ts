import { MetadataProviderType } from '@server/database/schema';
import type { MediaItem } from '@server/modules/media/mediaItem';
import { decorate } from '../enrichment/decorate';
import { mapPlexItems } from '../enrichment/mappers';
import {
  type ActuatorTask,
  type EnrichmentResult,
  type MediaActuator,
  type MediaEnricher,
  modelledRun,
} from '../roles';
import { BaseProviderConnection } from './baseProviderConnection';

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
export class PlexProvider
  extends BaseProviderConnection
  implements MediaEnricher<'playCount' | 'lastWatchedAt'>, MediaActuator
{
  public readonly actuatorType = MetadataProviderType.PLEX;

  public tasks(): ActuatorTask[] {
    return [
      {
        id: 'deleteFromLibrary',
        label: 'Delete from library',
        destructive: true,
        affects: 'media',
        run: modelledRun('deleteFromLibrary'),
      },
      {
        id: 'moveToTrash',
        label: 'Move to trash',
        destructive: true,
        affects: 'media',
        run: modelledRun('moveToTrash'),
      },
      {
        id: 'refreshMetadata',
        label: 'Refresh metadata',
        destructive: false,
        affects: 'media',
        run: modelledRun('refreshMetadata'),
      },
      {
        id: 'markPlayed',
        label: 'Mark as played',
        destructive: false,
        affects: 'media',
        run: modelledRun('markPlayed'),
      },
      {
        id: 'markUnplayed',
        label: 'Mark as unplayed',
        destructive: false,
        affects: 'media',
        run: modelledRun('markUnplayed'),
      },
    ];
  }

  async enrich(items: MediaItem[]): Promise<EnrichmentResult<'playCount' | 'lastWatchedAt'>> {
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
