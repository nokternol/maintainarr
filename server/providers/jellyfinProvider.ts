import { MetadataProviderType } from '../database/schema';
import { BaseProviderConnection } from './baseProviderConnection';
import { type ActuatorTask, type MediaActuator, modelledRun } from './roles';

export interface JellyfinLibrary {
  Name: string;
  ItemId: string;
  CollectionType: string;
}

export interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  ProductionYear?: number;
}

interface JellyfinItemsResponse {
  Items: JellyfinItem[];
  TotalRecordCount: number;
}

export class JellyfinProvider extends BaseProviderConnection implements MediaActuator {
  public readonly actuatorType = MetadataProviderType.JELLYFIN;

  public tasks(): ActuatorTask[] {
    return [
      {
        id: 'deleteItem',
        label: 'Delete item',
        destructive: true,
        affects: 'media',
        run: modelledRun('deleteItem'),
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
      {
        id: 'addToCollection',
        label: 'Add to collection',
        destructive: false,
        affects: 'media',
        run: modelledRun('addToCollection'),
      },
    ];
  }

  private get authHeader() {
    return { 'X-Emby-Authorization': `MediaBrowser Token="${this.provider.apiKey}"` };
  }

  private get userId(): string {
    const userId = this.provider.settings?.userId;
    return typeof userId === 'string' ? userId : '';
  }

  public async getLibraries(): Promise<JellyfinLibrary[]> {
    return this.client
      .get('Library/VirtualFolders', { headers: this.authHeader })
      .json<JellyfinLibrary[]>();
  }

  public async getLibraryContents(libraryId: string): Promise<JellyfinItem[]> {
    const resp = await this.client
      .get(`Users/${this.userId}/Items`, {
        headers: this.authHeader,
        searchParams: { ParentId: libraryId, Recursive: 'true' },
      })
      .json<JellyfinItemsResponse>();
    return resp.Items;
  }
}
