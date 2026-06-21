import { MetadataProviderType } from '../database/schema';
import type { NormalizedMovie } from '../domain/movie';
import type { NormalizedShow } from '../domain/show';
import { BaseProviderConnection } from './baseProviderConnection';
import type { MediaItemSet, MediaSource } from './mediaSource';
import { normalizeRadarrMovie } from './normalizeMedia';
import type { MediaActuator } from './roles';

export interface RadarrImage {
  coverType: string;
  remoteUrl: string;
}

export interface RadarrMovie {
  id: number;
  title: string;
  year?: number;
  hasFile: boolean;
  monitored: boolean;
  tmdbId: number;
  imdbId?: string;
  profileId: number;
  qualityProfileId: number;
  tags: number[];
  folderName: string;
  path: string;
  images?: RadarrImage[];
  genres?: string[];
  added?: string;
  certification?: string;
  ratings?: {
    imdb?: { value: number; votes: number; type: string };
    tmdb?: { value: number; votes: number; type: string };
    metacritic?: { value: number; votes: number; type: string };
    rottenTomatoes?: { value: number; votes: number; type: string };
    trakt?: { value: number; votes: number; type: string };
  };
  statistics?: {
    movieFileCount: number;
    sizeOnDisk: number;
    releaseGroups: string[];
  };
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

export class RadarrProvider extends BaseProviderConnection implements MediaSource, MediaActuator {
  public readonly enrichmentSourceType = 'RADARR' as const;
  public readonly actuatorType = MetadataProviderType.RADARR;

  private get apiParams() {
    return { apikey: this.provider.apiKey || '' };
  }

  public async getMediaItems(): Promise<MediaItemSet> {
    return (await this.getMovies()).map(normalizeRadarrMovie);
  }

  public idOf(item: NormalizedMovie | NormalizedShow): number | undefined {
    return (item as NormalizedMovie)._sourceIds.radarr;
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

  public async lookupMovies(term: string): Promise<RadarrMovie[]> {
    return this.client
      .get('movie/lookup', { searchParams: { ...this.apiParams, term } })
      .json<RadarrMovie[]>();
  }

  public async unmonitorMovies(movieIds: number[]): Promise<void> {
    const all = await this.getMovies();
    const targets = all.filter((m) => movieIds.includes(m.id));
    await Promise.all(
      targets.map((movie) =>
        this.client
          .put(`movie/${movie.id}`, {
            searchParams: this.apiParams,
            json: { ...movie, monitored: false },
          })
          .json()
      )
    );
  }

  public async triggerMoviesSearch(movieIds: number[]): Promise<void> {
    if (movieIds.length === 0) return;
    await this.client
      .post('command', {
        searchParams: this.apiParams,
        json: { name: 'MoviesSearch', movieIds },
      })
      .json();
  }

  public async deleteMovies(movieIds: number[]): Promise<void> {
    await Promise.all(
      movieIds.map((id) =>
        this.client
          .delete(`movie/${id}`, {
            searchParams: { ...this.apiParams, deleteFiles: 'true', addImportExclusion: 'false' },
          })
          .json()
      )
    );
  }
}
