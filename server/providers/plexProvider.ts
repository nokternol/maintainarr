import { BaseMetadataProvider } from './baseMetadataProvider';

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
}

/**
 * PlexProvider handles metadata gathering from a Plex Media Server instance.
 * Auth token validation against plex.tv lives in services/plexService.ts (PlexService).
 */
export class PlexProvider extends BaseMetadataProvider {
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
}
