import { MetadataProviderType } from '@server/database/schema';
import { type ActuatorTask, type MediaActuator, modelledRun, requireParameter } from '../roles';
import { BaseProviderConnection } from './baseProviderConnection';

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

export class RadarrProvider extends BaseProviderConnection implements MediaActuator {
  public readonly actuatorType = MetadataProviderType.RADARR;

  private get apiParams() {
    return { apikey: this.provider.apiKey || '' };
  }

  public tasks(): ActuatorTask[] {
    return [
      {
        id: 'unmonitorMovie',
        label: 'Unmonitor movie',
        destructive: false,
        affects: 'media',
        run: async (ids) => this.unmonitorMovies(ids.map(Number)),
      },
      {
        id: 'triggerSearch',
        label: 'Trigger download search',
        destructive: false,
        run: async (ids) => this.triggerMoviesSearch(ids.map(Number)),
      },
      {
        id: 'deleteMovieWithFiles',
        label: 'Delete movie + files',
        destructive: true,
        affects: 'media',
        run: async (ids) => this.deleteMovies(ids.map(Number)),
      },
      {
        id: 'deleteMovieKeepFiles',
        label: 'Delete movie (keep files)',
        destructive: true,
        affects: 'media',
        run: modelledRun('deleteMovieKeepFiles'),
      },
      {
        id: 'changeQualityProfile',
        label: 'Change quality profile',
        destructive: false,
        affects: 'media',
        parameter: { type: 'select', label: 'Quality profile', optionsRoute: 'quality-profiles' },
        run: async (ids, parameterValue) =>
          this.changeQualityProfile(
            ids.map(Number),
            Number(requireParameter('changeQualityProfile', parameterValue))
          ),
      },
      {
        id: 'addTag',
        label: 'Add tag',
        destructive: false,
        parameter: { type: 'select', label: 'Tag', optionsRoute: 'tags' },
        run: async (ids, parameterValue) =>
          this.applyTag(ids.map(Number), Number(requireParameter('addTag', parameterValue)), 'add'),
      },
      {
        id: 'removeTag',
        label: 'Remove tag',
        destructive: false,
        parameter: { type: 'select', label: 'Tag', optionsRoute: 'tags' },
        run: async (ids, parameterValue) =>
          this.applyTag(
            ids.map(Number),
            Number(requireParameter('removeTag', parameterValue)),
            'remove'
          ),
      },
    ];
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

  public async changeQualityProfile(movieIds: number[], qualityProfileId: number): Promise<void> {
    await this.client
      .put('movie/editor', {
        searchParams: this.apiParams,
        json: { movieIds, qualityProfileId },
      })
      .json();
  }

  public async applyTag(movieIds: number[], tagId: number, mode: 'add' | 'remove'): Promise<void> {
    await this.client
      .put('movie/editor', {
        searchParams: this.apiParams,
        json: { movieIds, tags: [tagId], applyTags: mode },
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
