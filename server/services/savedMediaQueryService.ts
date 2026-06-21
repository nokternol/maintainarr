import { eq } from 'drizzle-orm';
import type { DrizzleDb } from '../database';
import {
  type MetadataProviderType,
  metadataProviders,
  savedQueries,
  savedQueryFilterValues,
} from '../database/schema';
import { NotFoundError, ValidationError } from '../errors';
import type { ContentType, FilterValue } from '../utils/filterRegistry';
import { FILTER_REGISTRY, getFilterDef } from '../utils/filterRegistry';

export type { ContentType, FilterValue };

export interface FilterValueEntry {
  key: string;
  value: FilterValue;
}

export interface SavedMediaQueryDraft {
  name: string;
  contentType: ContentType;
  filterValues: FilterValueEntry[];
}

/** @deprecated ubiquitous-language alias — use `SavedMediaQueryDraft`. */
export type SavedQueryDraft = SavedMediaQueryDraft;

export interface ProviderStatus {
  providerType: MetadataProviderType;
  required: boolean;
  configured: boolean;
  affectedFilterKeys: string[];
}

export interface QueryHealth {
  status: 'healthy' | 'degraded' | 'unavailable';
  providerStatus: ProviderStatus[];
}

/**
 * A persisted query: a `MediaQuerySpec` (contentType + sources) given a database
 * identity and presentation metadata. The persisted form carries its single
 * include source as the `filterValues` convenience accessor
 * (`sources: [{ filterValues, role: 'include' }]`); the full multi-source
 * projection is reserved for the client phase.
 */
export interface SavedMediaQuery {
  id: number;
  name: string;
  contentType: ContentType;
  filterValues: FilterValueEntry[];
  health: QueryHealth;
  createdAt: string;
}

/** @deprecated ubiquitous-language alias — use `SavedMediaQuery`. */
export type SavedQueryDto = SavedMediaQuery;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function coerceValue(raw: string, dataType: string): FilterValue {
  if (dataType === 'boolean') return raw === 'true' || raw === '1';
  if (dataType === 'number') return Number(raw);
  return raw;
}

function computeHealth(
  filterEntries: FilterValueEntry[],
  contentType: ContentType,
  activeProviderTypes: Set<MetadataProviderType>
): QueryHealth {
  if (filterEntries.length === 0) {
    return { status: 'healthy', providerStatus: [] };
  }

  // Collect per-providerType requirements across all filter keys
  const providerMap = new Map<MetadataProviderType, { required: boolean; keys: string[] }>();

  for (const { key } of filterEntries) {
    const def = getFilterDef(key, contentType);
    if (!def) continue;
    for (const pt of def.sourceProviders) {
      const existing = providerMap.get(pt);
      if (existing) {
        existing.keys.push(key);
        if (def.required) existing.required = true;
      } else {
        providerMap.set(pt, { required: def.required, keys: [key] });
      }
    }
  }

  const providerStatus: ProviderStatus[] = [];
  let hasUnavailable = false;
  let hasDegraded = false;

  for (const [providerType, { required, keys }] of providerMap) {
    const configured = activeProviderTypes.has(providerType);
    providerStatus.push({ providerType, required, configured, affectedFilterKeys: keys });
    if (!configured) {
      if (required) hasUnavailable = true;
      else hasDegraded = true;
    }
  }

  const status = hasUnavailable ? 'unavailable' : hasDegraded ? 'degraded' : 'healthy';
  return { status, providerStatus };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class SavedMediaQueryService {
  private readonly db: DrizzleDb;

  constructor({ db }: { db: DrizzleDb }) {
    this.db = db;
  }

  async list(): Promise<SavedMediaQuery[]> {
    const rows = await this.db.select().from(savedQueries).orderBy(savedQueries.createdAt);
    const fvRows = await this.db.select().from(savedQueryFilterValues);

    const activeRows = await this.db
      .select({ type: metadataProviders.type })
      .from(metadataProviders)
      .where(eq(metadataProviders.isActive, true));
    const activeProviderTypes = new Set(activeRows.map((r) => r.type as MetadataProviderType));

    // Group filter value rows by savedQueryId
    const fvByQueryId = new Map<number, FilterValueEntry[]>();
    for (const fv of fvRows) {
      const def = FILTER_REGISTRY.find((d) => d.key === fv.filterKey);
      const dataType = def?.dataType ?? 'string';
      const entry: FilterValueEntry = { key: fv.filterKey, value: coerceValue(fv.value, dataType) };
      const arr = fvByQueryId.get(fv.savedQueryId) ?? [];
      arr.push(entry);
      fvByQueryId.set(fv.savedQueryId, arr);
    }

    return rows.map((row) => {
      const filterValues = fvByQueryId.get(row.id) ?? [];
      const health = computeHealth(
        filterValues,
        row.contentType as ContentType,
        activeProviderTypes
      );
      return {
        id: row.id,
        name: row.name,
        contentType: row.contentType as ContentType,
        filterValues,
        health,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  async create(draft: SavedMediaQueryDraft): Promise<SavedMediaQuery> {
    // Validate all filter keys exist in the registry for this contentType
    for (const { key } of draft.filterValues) {
      const def = getFilterDef(key, draft.contentType);
      if (!def) {
        throw new ValidationError(
          `Filter key '${key}' is not valid for contentType '${draft.contentType}'`
        );
      }
    }

    const [row] = await this.db
      .insert(savedQueries)
      .values({ name: draft.name.trim(), contentType: draft.contentType })
      .returning();

    if (draft.filterValues.length > 0) {
      await this.db.insert(savedQueryFilterValues).values(
        draft.filterValues.map(({ key, value }) => ({
          savedQueryId: row.id,
          filterKey: key,
          value: String(value),
        }))
      );
    }

    const activeRows = await this.db
      .select({ type: metadataProviders.type })
      .from(metadataProviders)
      .where(eq(metadataProviders.isActive, true));
    const activeProviderTypes = new Set(activeRows.map((r) => r.type as MetadataProviderType));

    const health = computeHealth(draft.filterValues, draft.contentType, activeProviderTypes);

    return {
      id: row.id,
      name: row.name,
      contentType: row.contentType as ContentType,
      filterValues: draft.filterValues,
      health,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getById(id: number): Promise<SavedMediaQuery> {
    const [row] = await this.db.select().from(savedQueries).where(eq(savedQueries.id, id));
    if (!row) throw new NotFoundError(`Saved query ${id} not found`);

    const fvRows = await this.db
      .select()
      .from(savedQueryFilterValues)
      .where(eq(savedQueryFilterValues.savedQueryId, id));

    const activeRows = await this.db
      .select({ type: metadataProviders.type })
      .from(metadataProviders)
      .where(eq(metadataProviders.isActive, true));
    const activeProviderTypes = new Set(activeRows.map((r) => r.type as MetadataProviderType));

    const filterValues: FilterValueEntry[] = fvRows.map((fv) => {
      const def = FILTER_REGISTRY.find((d) => d.key === fv.filterKey);
      const dataType = def?.dataType ?? 'string';
      return { key: fv.filterKey, value: coerceValue(fv.value, dataType) };
    });

    const health = computeHealth(filterValues, row.contentType as ContentType, activeProviderTypes);

    return {
      id: row.id,
      name: row.name,
      contentType: row.contentType as ContentType,
      filterValues,
      health,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async delete(id: number): Promise<void> {
    const [row] = await this.db.delete(savedQueries).where(eq(savedQueries.id, id)).returning();
    if (!row) throw new NotFoundError(`Saved query ${id} not found`);
  }
}

/** @deprecated ubiquitous-language alias — use `SavedMediaQueryService`. */
export { SavedMediaQueryService as SavedQueryService };
