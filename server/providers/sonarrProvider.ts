import type { NormalizedMovie } from '../domain/movie';
import type { NormalizedShow } from '../domain/show';
import { BaseMetadataProvider } from './baseMetadataProvider';
import type { MediaItemSet, MediaSource } from './mediaSource';
import { normalizeSonarrSeries } from './normalizeMedia';

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

export class SonarrProvider extends BaseMetadataProvider implements MediaSource {
  public readonly enrichmentSourceType = 'SONARR' as const;

  private get apiParams() {
    return { apikey: this.provider.apiKey || '' };
  }

  public async getMediaItems(): Promise<MediaItemSet> {
    return (await this.getSeries()).map(normalizeSonarrSeries);
  }

  public idOf(item: NormalizedMovie | NormalizedShow): number | undefined {
    return (item as NormalizedShow)._sourceIds.sonarr;
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
