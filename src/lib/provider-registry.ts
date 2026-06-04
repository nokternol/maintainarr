export interface TaskDef {
  id: string;
  label: string;
  description: string;
  destructive: boolean;
}

export interface ProviderEntry {
  id: string;
  label: string;
  group: string;
  order: number;
  apiSuffix: string;
  defaultUrl: string | undefined;
  filterCapabilities: string[];
  tasks: TaskDef[];
}

export const PROVIDER_REGISTRY: Record<string, ProviderEntry> = {
  PLEX: {
    id: 'PLEX',
    label: 'Plex',
    group: 'PLEX',
    order: 0,
    apiSuffix: '',
    defaultUrl: undefined,
    filterCapabilities: ['Library contents', 'Item metadata'],
    tasks: [
      {
        id: 'deleteFromLibrary',
        label: 'Delete from library',
        description: 'Permanently removes the item and its files from Plex.',
        destructive: true,
      },
      {
        id: 'moveToTrash',
        label: 'Move to trash',
        description: 'Soft-deletes the item — recoverable from Plex trash.',
        destructive: true,
      },
      {
        id: 'refreshMetadata',
        label: 'Refresh metadata',
        description: 'Forces Plex to re-fetch metadata for matched items.',
        destructive: false,
      },
      {
        id: 'markPlayed',
        label: 'Mark as played',
        description: 'Marks matched items as watched for all users.',
        destructive: false,
      },
      {
        id: 'markUnplayed',
        label: 'Mark as unplayed',
        description: 'Clears the watched state for matched items.',
        destructive: false,
      },
    ],
  },
  JELLYFIN: {
    id: 'JELLYFIN',
    label: 'Jellyfin',
    group: 'JELLYFIN',
    order: 1,
    apiSuffix: '',
    defaultUrl: undefined,
    filterCapabilities: ['Library contents', 'Item metadata'],
    tasks: [
      {
        id: 'deleteItem',
        label: 'Delete item',
        description: 'Permanently removes the item from the Jellyfin library.',
        destructive: true,
      },
      {
        id: 'refreshMetadata',
        label: 'Refresh metadata',
        description: 'Forces Jellyfin to re-fetch metadata for matched items.',
        destructive: false,
      },
      {
        id: 'markPlayed',
        label: 'Mark as played',
        description: 'Marks matched items as watched.',
        destructive: false,
      },
      {
        id: 'markUnplayed',
        label: 'Mark as unplayed',
        description: 'Clears the watched state for matched items.',
        destructive: false,
      },
      {
        id: 'addToCollection',
        label: 'Add to collection',
        description: 'Adds matched items to a specified Jellyfin collection.',
        destructive: false,
      },
    ],
  },
  RADARR: {
    id: 'RADARR',
    label: 'Radarr',
    group: 'RADARR',
    order: 2,
    apiSuffix: '/api/v3',
    defaultUrl: undefined,
    filterCapabilities: ['Movie library', 'Quality profiles', 'Tags'],
    tasks: [
      {
        id: 'deleteMovieWithFiles',
        label: 'Delete movie + files',
        description: 'Removes the movie entry and deletes all associated files.',
        destructive: true,
      },
      {
        id: 'deleteMovieKeepFiles',
        label: 'Delete movie (keep files)',
        description: 'Removes the movie from Radarr but leaves files on disk.',
        destructive: true,
      },
      {
        id: 'unmonitorMovie',
        label: 'Unmonitor movie',
        description: 'Stops Radarr from searching for new releases for matched movies.',
        destructive: false,
      },
      {
        id: 'triggerSearch',
        label: 'Trigger download search',
        description: 'Sends a search request for new or upgraded releases.',
        destructive: false,
      },
      {
        id: 'changeQualityProfile',
        label: 'Change quality profile',
        description: 'Updates the quality profile on matched movies.',
        destructive: false,
      },
      {
        id: 'addTag',
        label: 'Add tag',
        description: 'Applies a specified tag to matched movies.',
        destructive: false,
      },
      {
        id: 'removeTag',
        label: 'Remove tag',
        description: 'Removes a specified tag from matched movies.',
        destructive: false,
      },
    ],
  },
  SONARR: {
    id: 'SONARR',
    label: 'Sonarr',
    group: 'SONARR',
    order: 3,
    apiSuffix: '/api/v3',
    defaultUrl: undefined,
    filterCapabilities: ['Series library', 'Quality profiles', 'Tags'],
    tasks: [
      {
        id: 'deleteSeriesWithFiles',
        label: 'Delete series + files',
        description: 'Removes the series entry and deletes all associated files.',
        destructive: true,
      },
      {
        id: 'deleteSeriesKeepFiles',
        label: 'Delete series (keep files)',
        description: 'Removes the series from Sonarr but leaves files on disk.',
        destructive: false,
      },
      {
        id: 'unmonitorSeries',
        label: 'Unmonitor series',
        description: 'Stops Sonarr from searching for new episodes for matched series.',
        destructive: false,
      },
      {
        id: 'triggerSearch',
        label: 'Trigger episode search',
        description: 'Sends a search request for missing or upgraded episodes.',
        destructive: false,
      },
      {
        id: 'changeQualityProfile',
        label: 'Change quality profile',
        description: 'Updates the quality profile on matched series.',
        destructive: false,
      },
      {
        id: 'addTag',
        label: 'Add tag',
        description: 'Applies a specified tag to matched series.',
        destructive: false,
      },
      {
        id: 'removeTag',
        label: 'Remove tag',
        description: 'Removes a specified tag from matched series.',
        destructive: false,
      },
    ],
  },
  TAUTULLI: {
    id: 'TAUTULLI',
    label: 'Tautulli',
    group: 'TAUTULLI',
    order: 4,
    apiSuffix: '',
    defaultUrl: undefined,
    filterCapabilities: ['Watch history', 'Play statistics', 'User activity'],
    tasks: [
      {
        id: 'deleteWatchHistory',
        label: 'Delete watch history',
        description: 'Removes play history entries for matched media in Tautulli.',
        destructive: true,
      },
      {
        id: 'sendNotification',
        label: 'Send notification',
        description: 'Triggers a Tautulli notifier for matched media.',
        destructive: false,
      },
      {
        id: 'terminateStream',
        label: 'Terminate active stream',
        description: 'Kills an active Tautulli stream for matched media.',
        destructive: true,
      },
    ],
  },
  OVERSEERR: {
    id: 'OVERSEERR',
    label: 'Overseerr',
    group: 'OVERSEERR',
    order: 5,
    apiSuffix: '',
    defaultUrl: undefined,
    filterCapabilities: ['Request queue'],
    tasks: [],
  },
  TMDB: {
    id: 'TMDB',
    label: 'TMDB',
    group: 'TMDB',
    order: 6,
    apiSuffix: '',
    defaultUrl: 'https://api.themoviedb.org/3',
    filterCapabilities: ['Ratings', 'Metadata'],
    tasks: [],
  },
  OMDB: {
    id: 'OMDB',
    label: 'OMDB',
    group: 'OMDB',
    order: 7,
    apiSuffix: '',
    defaultUrl: 'http://www.omdbapi.com',
    filterCapabilities: ['Ratings', 'Metadata'],
    tasks: [],
  },
};

export function getProviderEntry(type: string): ProviderEntry | undefined {
  return PROVIDER_REGISTRY[type];
}

export function getProviderOrder(): string[] {
  return Object.values(PROVIDER_REGISTRY)
    .sort((a, b) => a.order - b.order)
    .map((e) => e.id);
}

export function getProviderTypes(): readonly string[] {
  return getProviderOrder();
}
