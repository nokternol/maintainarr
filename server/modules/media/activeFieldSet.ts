import { MetadataProviderType } from '../../database/schema';
import type { DomainEventBus } from '../../kernel/eventBus';
import type { EnrichmentFields } from './mediaFieldProvider';

/**
 * The single declared source of truth for which `EnrichmentFields` keys each
 * provider type's `MediaFieldProvider`/`MediaFieldSource` adapter(s) produce.
 * Hand-authored, mirroring `roles.ts`'s `SOURCE_OWNER_BY_KIND` — an adapter's
 * field coverage lives in its generic type parameters, not something a
 * runtime scan of `mediaFieldProvider.ts`'s exports could discover, so this
 * is the compiled-in declaration every consumer (gating, `sourceProviders`)
 * reads instead of re-deriving.
 */
export const fieldsByProviderType: Partial<
  Record<MetadataProviderType, readonly (keyof EnrichmentFields)[]>
> = {
  [MetadataProviderType.RADARR]: ['tags'],
  [MetadataProviderType.TAUTULLI]: ['playCount', 'lastWatchedAt'],
  [MetadataProviderType.PLEX]: ['playCount', 'lastWatchedAt'],
  [MetadataProviderType.OVERSEERR]: ['overseerrRequestStatus', 'overseerrHasIssue'],
  [MetadataProviderType.TMDB]: ['tmdbStatus'],
};

/**
 * The union of every currently-active provider type's declared fields —
 * membership only ("who can produce this field at all"), not precedence
 * (which only orders an already-established membership set).
 */
export function activeFieldSet(
  activeTypes: Set<MetadataProviderType>
): Set<keyof EnrichmentFields> {
  const fields = new Set<keyof EnrichmentFields>();
  for (const type of activeTypes) {
    for (const field of fieldsByProviderType[type] ?? []) {
      fields.add(field);
    }
  }
  return fields;
}

/** The narrow slice of `ProviderSettingsService` this cache depends on. */
export interface ActiveTypesSource {
  activeTypes(): Promise<Set<MetadataProviderType>>;
}

/**
 * Caches `activeFieldSet`'s union so `filterRegistry`/`gatedDescriptors` don't
 * recompute it (and re-query every provider's active state) per request.
 * Invalidates on `provider:changed` — the same event `ProviderSettingsService`
 * emits from `create`/`update`, kept decoupled via the kernel event bus so
 * `providers` never imports from `media`.
 */
export class ActiveFieldSetCache {
  private readonly source: ActiveTypesSource;
  private cached: Set<keyof EnrichmentFields> | null = null;

  constructor(deps: { providerSettingsService: ActiveTypesSource; eventBus?: DomainEventBus }) {
    this.source = deps.providerSettingsService;
    deps.eventBus?.on('provider:changed', () => {
      this.cached = null;
    });
  }

  async get(): Promise<Set<keyof EnrichmentFields>> {
    if (this.cached === null) {
      this.cached = activeFieldSet(await this.source.activeTypes());
    }
    return this.cached;
  }
}
