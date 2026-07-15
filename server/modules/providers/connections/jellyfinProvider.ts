import { MetadataProviderType } from '@server/database/schema';
import { type ActuatorTask, type MediaActuator, requireParameter } from '../roles';
import { BaseProviderConnection } from './baseProviderConnection';

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
        run: async (ids) => this.deleteItems(ids.map(String)),
      },
      {
        id: 'refreshMetadata',
        label: 'Refresh metadata',
        destructive: false,
        affects: 'media',
        run: async (ids) => this.refreshMetadata(ids.map(String)),
      },
      {
        id: 'markPlayed',
        label: 'Mark as played',
        destructive: false,
        affects: 'media',
        run: async (ids) => this.markPlayed(ids.map(String)),
      },
      {
        id: 'markUnplayed',
        label: 'Mark as unplayed',
        destructive: false,
        affects: 'media',
        run: async (ids) => this.markUnplayed(ids.map(String)),
      },
      {
        id: 'addToCollection',
        label: 'Add to collection',
        destructive: false,
        affects: 'media',
        parameter: { label: 'Collection' },
        run: async (ids, parameterValue) =>
          this.addToCollection(
            ids.map(String),
            requireParameter('addToCollection', parameterValue)
          ),
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

  public async deleteItems(itemIds: string[]): Promise<void> {
    await Promise.all(
      itemIds.map((id) => this.client.delete(`Items/${id}`, { headers: this.authHeader }))
    );
  }

  public async refreshMetadata(itemIds: string[]): Promise<void> {
    await Promise.all(
      itemIds.map((id) =>
        this.client.post(`Items/${id}/Refresh`, {
          headers: this.authHeader,
          searchParams: { metadataRefreshMode: 'FullRefresh', imageRefreshMode: 'FullRefresh' },
        })
      )
    );
  }

  public async markPlayed(itemIds: string[]): Promise<void> {
    await Promise.all(
      itemIds.map((id) =>
        this.client.post(`UserPlayedItems/${id}`, {
          headers: this.authHeader,
          searchParams: { userId: this.userId },
        })
      )
    );
  }

  public async markUnplayed(itemIds: string[]): Promise<void> {
    await Promise.all(
      itemIds.map((id) =>
        this.client.delete(`UserPlayedItems/${id}`, {
          headers: this.authHeader,
          searchParams: { userId: this.userId },
        })
      )
    );
  }

  public async addToCollection(itemIds: string[], collectionId: string): Promise<void> {
    await this.client.post(`Collections/${collectionId}/Items`, {
      headers: this.authHeader,
      searchParams: { ids: itemIds.join(',') },
    });
  }
}
