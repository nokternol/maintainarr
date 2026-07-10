/**
 * Public interface of the media module.
 *
 * Everything the HTTP layer and other modules may consume from the media
 * domain is exported here, chosen export by export — this is a designed
 * contract, not a barrel. Anything not exported is module-private, and a
 * growing export list is a design smell to challenge.
 */

// HTTP surface — mounted by the API router. Absorbs the filterFields,
// backdrops, and search route-drawn modules; each keeps its own URL mount.
export { createMediaHandlers } from './media.handler';
export { createMediaRoutes } from './media.routes';
export { createFilterFieldsRoutes } from './media.filterFields.routes';
export { createBackdropsRoutes } from './media.backdrops.routes';
export { createSearchRoutes } from './media.search.routes';

// Container contribution — the app builder composes Cradle from this slice
// and calls the registration; classes registered here stay module-private
// unless consumers construct them directly.
export { registerMediaDependencies } from './media.registrations';
export type { MediaCradle } from './media.registrations';

// Canonical item shapes every provider role (Source, Enricher) operates on.
export type { MediaItem, MediaItemSet } from './mediaItem';
export type { NormalizedMovie } from './movie';
export type { NormalizedShow } from './show';

// Per-provider DTO → canonical shape translation.
export { normalizeRadarrMovie, normalizeSonarrSeries } from './normalizeMedia';

// The read role a media-owning provider plays for the query engine, and the
// adapters that bind providers' native connections to it.
export type { MediaSource } from './mediaSource';
export { mediaSourceFor, radarrMediaSource, sonarrMediaSource } from './sourceAdapters';

// Owner-type policy: which provider type owns each content type, resolved to
// a bound MediaSource.
export { sourceOwnership } from './mediaSourceFactory';
export type { MediaSourceDescriptor, MediaSourceFactory } from './mediaSourceFactory';

// Enrichment roles and the adapters that bind providers' native connections
// to them.
export type { EnrichableField, EnrichmentResult, MediaEnricher } from './enrichment/enricher';
export {
  overseerrEnricher,
  plexEnricher,
  tautulliEnricher,
  tmdbEnricher,
} from './enrichment/enricherAdapters';

// The rule vocabulary and its client-facing projection.
export type {
  ContentType,
  FilterValue,
  FilterValueEntry,
  MediaRule,
  MediaRuleDescriptor,
  RangeValue,
} from './filterRegistry';
export { MEDIA_RULES, getRule, toDescriptor } from './filterRegistry';

// The query engine — matches a MediaSource against a MediaQuerySpec.
export { MediaQueryEngine, matchItems } from './mediaQueryEngine';
export type { MediaQuery, MediaQuerySource, MediaQuerySpec } from './mediaQueryEngine';

// Enrichment — the identity → media_enrichment materialization.
export { mergeEnrichment } from './enrichmentMerge';
export { EnrichmentJobFactory } from './enrichmentJobFactory';
export type { EnrichmentJobFactoryDeps } from './enrichmentJobFactory';
