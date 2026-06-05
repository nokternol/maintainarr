import { authHandlers } from './auth';
import { automationRunHandlers } from './automationRuns';
import { automationsHandlers, savedQueriesHandlers } from './automations';
import { backdropsHandlers } from './backdrops';
import { jellyfinHandlers } from './jellyfin';
import { mediaHandlers } from './media';
import { overseerrHandlers } from './overseerr';
import { plexProviderHandlers } from './plex';
import { providersHandlers } from './providers';
import { radarrHandlers } from './radarr';
import { settingsHandlers } from './settings';
import { sonarrHandlers } from './sonarr';
import { tautulliHandlers } from './tautulli';

export const handlers = [
  ...authHandlers,
  ...automationsHandlers,
  ...savedQueriesHandlers,
  ...automationRunHandlers,
  ...backdropsHandlers,
  ...radarrHandlers,
  ...sonarrHandlers,
  ...tautulliHandlers,
  ...jellyfinHandlers,
  ...overseerrHandlers,
  ...plexProviderHandlers,
  ...providersHandlers,
  ...settingsHandlers,
  ...mediaHandlers,
];
