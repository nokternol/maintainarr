import { and, eq, inArray } from 'drizzle-orm';
import type { DrizzleDb } from '../database';
import {
  type MetadataProvider,
  type MetadataProviderType,
  type NewMetadataProvider,
  type RawMetadataProvider,
  metadataProviders,
} from '../database/schema';
import { NotFoundError, ValidationError } from '../errors';
import { getChildLogger } from '../logger';

const log = getChildLogger('ProviderSettingsService');

export interface ProviderSettingsDraft {
  type: MetadataProviderType;
  name: string;
  url: string;
  apiKey?: string;
  settings?: Record<string, unknown>;
  isActive?: boolean;
}

export interface ProviderSummary {
  id: number;
  type: MetadataProviderType;
  name: string;
  url: string;
  /** Always '***' when an apiKey was saved; null when no apiKey was provided. */
  apiKey: '***' | null;
  settings: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function parseRaw(raw: RawMetadataProvider): MetadataProvider {
  return {
    id: raw.id,
    type: raw.type as MetadataProviderType,
    name: raw.name,
    url: raw.url,
    apiKey: raw.apiKey ?? null,
    settings: raw.settings ? (JSON.parse(raw.settings) as Record<string, unknown>) : null,
    isActive: raw.isActive,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function redact(provider: MetadataProvider): ProviderSummary {
  return {
    ...provider,
    apiKey: provider.apiKey !== null ? '***' : null,
  };
}

export class ProviderSettingsService {
  private readonly db: DrizzleDb;

  constructor({ db }: { db: DrizzleDb }) {
    this.db = db;
  }

  async list(): Promise<ProviderSummary[]> {
    const rows = await this.db.select().from(metadataProviders);
    return rows.map((r) => redact(parseRaw(r)));
  }

  /** The set of provider types with an active configured instance. */
  async activeTypes(): Promise<Set<MetadataProviderType>> {
    const providers = await this.list();
    return new Set(providers.filter((p) => p.isActive).map((p) => p.type));
  }

  /**
   * Enforces the single-active-provider-per-type invariant (D8): rejects when an
   * active provider of `type` already exists. `excludeId` omits the row being updated
   * so re-saving an already-active provider is not treated as a conflict.
   */
  private async assertNoActiveConflict(
    type: MetadataProviderType,
    excludeId?: number
  ): Promise<void> {
    const active = await this.findActiveByTypes([type]);
    if (active.some((p) => p.id !== excludeId)) {
      throw new ValidationError(`An active ${type} provider already exists; deactivate it first`);
    }
  }

  async create(draft: ProviderSettingsDraft): Promise<ProviderSummary> {
    if (draft.isActive ?? true) {
      await this.assertNoActiveConflict(draft.type);
    }

    const insert: NewMetadataProvider = {
      type: draft.type,
      name: draft.name,
      url: draft.url,
      apiKey: draft.apiKey ?? null,
      settings: draft.settings ? JSON.stringify(draft.settings) : null,
      isActive: draft.isActive ?? true,
    };

    const [raw] = await this.db.insert(metadataProviders).values(insert).returning();
    log.debug('Provider created', { id: raw.id, type: raw.type });
    return redact(parseRaw(raw));
  }

  async update(id: number, patch: Partial<ProviderSettingsDraft>): Promise<ProviderSummary> {
    if (patch.isActive === true) {
      const current = await this.findById(id);
      await this.assertNoActiveConflict(current.type, id);
    }

    const updateValues: Partial<NewMetadataProvider> = {};

    if (patch.name !== undefined) updateValues.name = patch.name;
    if (patch.url !== undefined) updateValues.url = patch.url;
    if (patch.apiKey !== undefined) updateValues.apiKey = patch.apiKey;
    if (patch.settings !== undefined)
      updateValues.settings = patch.settings ? JSON.stringify(patch.settings) : null;
    if (patch.isActive !== undefined) updateValues.isActive = patch.isActive;

    const [raw] = await this.db
      .update(metadataProviders)
      .set(updateValues)
      .where(eq(metadataProviders.id, id))
      .returning();

    if (!raw) {
      throw new NotFoundError(`Provider with id ${id} not found`);
    }

    log.debug('Provider updated', { id });
    return redact(parseRaw(raw));
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(metadataProviders).where(eq(metadataProviders.id, id));
    log.debug('Provider deleted', { id });
  }

  async findById(id: number): Promise<MetadataProvider> {
    const [raw] = await this.db
      .select()
      .from(metadataProviders)
      .where(eq(metadataProviders.id, id));
    if (!raw) throw new NotFoundError(`Provider with id ${id} not found`);
    return parseRaw(raw);
  }

  async findActiveByTypes(types: MetadataProviderType[]): Promise<MetadataProvider[]> {
    if (types.length === 0) return [];

    const rows = await this.db
      .select()
      .from(metadataProviders)
      .where(and(eq(metadataProviders.isActive, true), inArray(metadataProviders.type, types)));

    return rows.map(parseRaw);
  }
}
