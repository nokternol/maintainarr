export interface ProviderEntry {
  id: string;
  label: string;
  group: string;
  order: number;
  apiSuffix: string;
  defaultUrl: string | undefined;
  filterCapabilities: string[];
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
  },
  JELLYFIN: {
    id: 'JELLYFIN',
    label: 'Jellyfin',
    group: 'JELLYFIN',
    order: 1,
    apiSuffix: '',
    defaultUrl: undefined,
    filterCapabilities: ['Library contents', 'Item metadata'],
  },
  RADARR: {
    id: 'RADARR',
    label: 'Radarr',
    group: 'RADARR',
    order: 2,
    apiSuffix: '/api/v3',
    defaultUrl: undefined,
    filterCapabilities: ['Movie library', 'Quality profiles', 'Tags'],
  },
  SONARR: {
    id: 'SONARR',
    label: 'Sonarr',
    group: 'SONARR',
    order: 3,
    apiSuffix: '/api/v3',
    defaultUrl: undefined,
    filterCapabilities: ['Series library', 'Quality profiles', 'Tags'],
  },
  TAUTULLI: {
    id: 'TAUTULLI',
    label: 'Tautulli',
    group: 'TAUTULLI',
    order: 4,
    apiSuffix: '',
    defaultUrl: undefined,
    filterCapabilities: ['Watch history', 'Play statistics', 'User activity'],
  },
  OVERSEERR: {
    id: 'OVERSEERR',
    label: 'Overseerr',
    group: 'OVERSEERR',
    order: 5,
    apiSuffix: '',
    defaultUrl: undefined,
    filterCapabilities: ['Request queue'],
  },
  TMDB: {
    id: 'TMDB',
    label: 'TMDB',
    group: 'TMDB',
    order: 6,
    apiSuffix: '',
    defaultUrl: 'https://api.themoviedb.org/3',
    filterCapabilities: ['Ratings', 'Metadata'],
  },
  OMDB: {
    id: 'OMDB',
    label: 'OMDB',
    group: 'OMDB',
    order: 7,
    apiSuffix: '',
    defaultUrl: 'http://www.omdbapi.com',
    filterCapabilities: ['Ratings', 'Metadata'],
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
