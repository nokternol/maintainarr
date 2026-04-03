import { and, eq, inArray } from 'drizzle-orm';
import type { DrizzleDb } from '../database';
import {
  type MetadataProvider,
  MetadataProviderType,
  type NewMetadataProvider,
  type RawMetadataProvider,
  metadataProviders,
} from '../database/schema';
import { NotFoundError } from '../errors';
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
    createdAt: new Date(raw.createdAt as unknown as string),
    updatedAt: new Date(raw.updatedAt as unknown as string),
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

  async create(draft: ProviderSettingsDraft): Promise<ProviderSummary> {
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

  async findActiveByTypes(types: MetadataProviderType[]): Promise<MetadataProvider[]> {
    if (types.length === 0) return [];

    const rows = await this.db
      .select()
      .from(metadataProviders)
      .where(and(eq(metadataProviders.isActive, true), inArray(metadataProviders.type, types)));

    return rows.map(parseRaw);
  }
}
