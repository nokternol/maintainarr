export interface TaskDef {
  id: string;
  label: string;
  description: string;
  destructive: boolean;
}

export const PROVIDER_TASKS: Record<string, TaskDef[]> = {
  PLEX: [
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
  JELLYFIN: [
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
  RADARR: [
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
  SONARR: [
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
  TAUTULLI: [
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
};

export function getEnabledTasksForProvider(type: string, enabledIds: string[]): TaskDef[] {
  const all = PROVIDER_TASKS[type] ?? [];
  return all.filter((t) => enabledIds.includes(t.id));
}
