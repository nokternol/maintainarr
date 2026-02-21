import { BaseMetadataProvider } from './baseMetadataProvider';

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

export class JellyfinProvider extends BaseMetadataProvider {
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
