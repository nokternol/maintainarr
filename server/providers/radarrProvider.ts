import { BaseMetadataProvider } from './baseMetadataProvider';

export interface RadarrMovie {
  id: number;
  title: string;
  hasFile: boolean;
  monitored: boolean;
  tmdbId: number;
  profileId: number;
  qualityProfileId: number;
  tags: number[];
  folderName: string;
  path: string;
}

export interface RadarrProfile {
  id: number;
  name: string;
}

export interface RadarrRootFolder {
  id: number;
  path: string;
  freeSpace: number;
  unmappedFolders: unknown[];
}

export interface RadarrTag {
  id: number;
  label: string;
}

export class RadarrProvider extends BaseMetadataProvider {
  private get apiParams() {
    return { apikey: this.provider.apiKey || '' };
  }

  public async getMovies(): Promise<RadarrMovie[]> {
    return this.client.get('movie', { searchParams: this.apiParams }).json<RadarrMovie[]>();
  }

  public async getProfiles(): Promise<RadarrProfile[]> {
    return this.client
      .get('qualityprofile', { searchParams: this.apiParams })
      .json<RadarrProfile[]>();
  }

  public async getRootFolders(): Promise<RadarrRootFolder[]> {
    return this.client
      .get('rootfolder', { searchParams: this.apiParams })
      .json<RadarrRootFolder[]>();
  }

  public async getTags(): Promise<RadarrTag[]> {
    return this.client.get('tag', { searchParams: this.apiParams }).json<RadarrTag[]>();
  }
}
