import { MetadataProviderType } from '@server/database/schema';
import { type ActuatorTask, type MediaActuator, modelledRun } from '../roles';
import { BaseProviderConnection } from './baseProviderConnection';

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
  tmdbId?: number;
  imdbId?: string;
  tvMazeId?: number;
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
  added?: string;
  ended?: boolean;
  previousAiring?: string;
  certification?: string;
  ratings?: { votes: number; value: number };
  statistics?: {
    seasonCount: number;
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
    percentOfEpisodes: number;
  };
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

export class SonarrProvider extends BaseProviderConnection implements MediaActuator {
  public readonly actuatorType = MetadataProviderType.SONARR;

  private get apiParams() {
    return { apikey: this.provider.apiKey || '' };
  }

  public tasks(): ActuatorTask[] {
    return [
      {
        id: 'unmonitorSeries',
        label: 'Unmonitor series',
        destructive: false,
        affects: 'media',
        run: (ids) => this.unmonitorSeries(ids),
      },
      {
        id: 'triggerSearch',
        label: 'Trigger episode search',
        destructive: false,
        run: (ids) => this.triggerSeriesSearch(ids),
      },
      {
        id: 'deleteSeriesWithFiles',
        label: 'Delete series + files',
        destructive: true,
        affects: 'media',
        run: (ids) => this.deleteSeries(ids),
      },
      {
        id: 'deleteSeriesKeepFiles',
        label: 'Delete series (keep files)',
        destructive: true,
        affects: 'media',
        run: modelledRun('deleteSeriesKeepFiles'),
      },
      {
        id: 'changeQualityProfile',
        label: 'Change quality profile',
        destructive: false,
        affects: 'media',
        run: modelledRun('changeQualityProfile'),
      },
      { id: 'addTag', label: 'Add tag', destructive: false, run: modelledRun('addTag') },
      { id: 'removeTag', label: 'Remove tag', destructive: false, run: modelledRun('removeTag') },
    ];
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

  public async deleteSeries(seriesIds: number[]): Promise<void> {
    await Promise.all(
      seriesIds.map((id) =>
        this.client
          .delete(`series/${id}`, {
            searchParams: {
              ...this.apiParams,
              deleteFiles: 'true',
              addImportListExclusion: 'false',
            },
          })
          .json()
      )
    );
  }
}
