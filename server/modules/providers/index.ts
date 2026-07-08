/**
 * Public interface of the providers module.
 *
 * Everything the HTTP layer and other modules may consume from the providers
 * domain is exported here, chosen export by export — this is a designed
 * contract, not a barrel. Anything not exported is module-private, and a
 * growing export list is a design smell to challenge.
 *
 * The per-system connection classes and their payload types are part of the
 * contract while the media domain (enrichment, search, media handler) still
 * lives outside this module; Phase 4 of the North Star plan pulls those
 * consumers into `modules/media/`, after which this surface should shrink.
 */

// HTTP surface — mounted by the API router.
export { createProvidersRoutes } from './providers.routes';

// Provider roles — the capability vocabulary connections implement.
export type {
  ActuatorTask,
  ActuatorTaskDescriptor,
  EnrichmentResult,
  MediaActuator,
  MediaEnricher,
} from './roles';

// Canonical source shapes the rest of the system consumes.
export type { MediaItem, MediaItemSet, MediaSource } from './mediaSource';

// Factories: connections from stored settings, sources from connections.
export { ProviderFactory } from './providerFactory';
export type { IProviderFactory } from './providerFactory';
export { MediaSourceFactory, sourceOwnership } from './mediaSourceFactory';
export type { MediaSourceDescriptor } from './mediaSourceFactory';

// Provider settings — persistence and projection of configured providers.
export { ProviderSettingsService } from './providerSettingsService';
export type { ProviderSettingsDraft, ProviderSummary } from './providerSettingsService';

// Per-provider task enablement read by automations.
export { readEnabledTaskIds } from './taskEnablement';

// Standalone provider-backed services.
export { PlexService } from './plexService';
export { TmdbService } from './tmdbService';

// Identity resolution — the system job that stitches source identities.
export { IdentityJobFactory } from './identityJobFactory';

// Connection classes + payload types still consumed outside the module
// (search handler, media handler, enrichment mappers) until Phase 4.
export { JellyfinProvider } from './connections/jellyfinProvider';
export { OverseerrProvider } from './connections/overseerrProvider';
export type { OverseerrIssue, OverseerrRequest } from './connections/overseerrProvider';
export { PlexProvider } from './connections/plexProvider';
export type { PlexMediaItem } from './connections/plexProvider';
export { RadarrProvider } from './connections/radarrProvider';
export type { RadarrMovie, RadarrProfile, RadarrTag } from './connections/radarrProvider';
export { SonarrProvider } from './connections/sonarrProvider';
export type { SonarrProfile, SonarrSeries, SonarrTag } from './connections/sonarrProvider';
export { TautulliProvider } from './connections/tautulliProvider';
export type { TautulliHistoryItem } from './connections/tautulliProvider';
export type { OmdbRating } from './connections/omdbProvider';
export type { TmdbRating } from './connections/tmdbProvider';
export type { TvMazeRating } from './connections/tvmazeProvider';
