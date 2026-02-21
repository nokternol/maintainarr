import { authHandlers } from './auth';
import { backdropsHandlers } from './backdrops';
import { jellyfinHandlers } from './jellyfin';
import { overseerrHandlers } from './overseerr';
import { plexProviderHandlers } from './plex';
import { providersHandlers } from './providers';
import { radarrHandlers } from './radarr';
import { sonarrHandlers } from './sonarr';
import { tautulliHandlers } from './tautulli';

export const handlers = [
  ...authHandlers,
  ...backdropsHandlers,
  ...radarrHandlers,
  ...sonarrHandlers,
  ...tautulliHandlers,
  ...jellyfinHandlers,
  ...overseerrHandlers,
  ...plexProviderHandlers,
  ...providersHandlers,
];
