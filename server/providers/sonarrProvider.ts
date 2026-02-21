import { BaseMetadataProvider } from './baseMetadataProvider';

export interface SonarrSeason {
  seasonNumber: number;
  monitored: boolean;
}

export interface SonarrSeries {
  id: number;
  title: string;
  status: string;
  monitored: boolean;
  tvdbId: number;
  profileId: number;
  qualityProfileId: number;
  languageProfileId: number;
  tags: number[];
  path: string;
  seasons: SonarrSeason[];
}

export interface SonarrProfile {
  id: number;
  name: string;
}

export interface SonarrRootFolder {
  id: number;
  path: string;
  freeSpace: number;
  unmappedFolders: unknown[];
}

export interface SonarrTag {
  id: number;
  label: string;
}

export class SonarrProvider extends BaseMetadataProvider {
  private get apiParams() {
    return { apikey: this.provider.apiKey || '' };
  }

  public async getSeries(): Promise<SonarrSeries[]> {
    return this.client.get('series', { searchParams: this.apiParams }).json<SonarrSeries[]>();
  }

  public async getProfiles(): Promise<SonarrProfile[]> {
    return this.client
      .get('qualityprofile', { searchParams: this.apiParams })
      .json<SonarrProfile[]>();
  }

  public async getRootFolders(): Promise<SonarrRootFolder[]> {
    return this.client
      .get('rootfolder', { searchParams: this.apiParams })
      .json<SonarrRootFolder[]>();
  }

  public async getTags(): Promise<SonarrTag[]> {
    return this.client.get('tag', { searchParams: this.apiParams }).json<SonarrTag[]>();
  }
}
