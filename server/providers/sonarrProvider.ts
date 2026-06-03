import { BaseMetadataProvider } from './baseMetadataProvider';

export interface SonarrSeason {
  seasonNumber: number;
  monitored: boolean;
}

export interface SonarrImage {
  coverType: string;
  remoteUrl: string;
}

export interface SonarrSeries {
  id: number;
  title: string;
  year?: number;
  status: string;
  monitored: boolean;
  tvdbId: number;
  profileId: number;
  qualityProfileId: number;
  languageProfileId: number;
  tags: number[];
  path: string;
  seasons: SonarrSeason[];
  images?: SonarrImage[];
  genres?: string[];
  network?: string;
  seriesType?: string;
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

  public async lookupSeries(term: string): Promise<SonarrSeries[]> {
    return this.client
      .get('series/lookup', { searchParams: { ...this.apiParams, term } })
      .json<SonarrSeries[]>();
  }

  public async unmonitorSeries(seriesIds: number[]): Promise<void> {
    const all = await this.getSeries();
    const targets = all.filter((s) => seriesIds.includes(s.id));
    await Promise.all(
      targets.map((s) =>
        this.client
          .put(`series/${s.id}`, {
            searchParams: this.apiParams,
            json: { ...s, monitored: false },
          })
          .json()
      )
    );
  }

  public async triggerSeriesSearch(seriesIds: number[]): Promise<void> {
    await Promise.all(
      seriesIds.map((id) =>
        this.client
          .post('command', {
            searchParams: this.apiParams,
            json: { name: 'SeriesSearch', seriesId: id },
          })
          .json()
      )
    );
  }
}
