import { Cron } from 'croner';
import { type SQL, eq } from 'drizzle-orm';
import type { DrizzleDb } from '../database';
import {
  type Automation as AutomationRow,
  MetadataProviderType,
  type NewAutomation,
  automations,
  metadataProviders,
  savedQueries,
} from '../database/schema';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors';
import type { ContentType } from './savedQueryService';

export interface AutomationDraft {
  name: string;
  queryId: number;
  providerId: number;
  taskId: string;
  schedule: string;
}

export interface AutomationDto {
  id: number;
  name: string;
  kind: 'user' | 'system';
  query: { id: number; name: string; contentType: ContentType } | null;
  provider: { id: number; name: string; type: string } | null;
  taskId: string;
  schedule: string;
  status: 'active' | 'paused';
  lastRun?: {
    at: string;
    itemCount: number;
    status: 'success' | 'error';
    error?: string;
  };
  nextRun?: string;
  createdAt: string;
  updatedAt: string;
}

function computeNextRun(schedule: string): string | undefined {
  try {
    const job = new Cron(schedule, { paused: true });
    const next = job.nextRun();
    job.stop();
    return next?.toISOString();
  } catch {
    return undefined;
  }
}

const CONTENT_TYPE_PROVIDERS: Record<ContentType, MetadataProviderType[]> = {
  movie: [MetadataProviderType.RADARR, MetadataProviderType.PLEX, MetadataProviderType.JELLYFIN],
  show: [MetadataProviderType.SONARR, MetadataProviderType.PLEX, MetadataProviderType.JELLYFIN],
};

function rowToDto(
  row: AutomationRow,
  query: { id: number; name: string; contentType: string } | null,
  provider: { id: number; name: string; type: string } | null
): AutomationDto {
  const dto: AutomationDto = {
    id: row.id,
    name: row.name,
    kind: (row.kind ?? 'user') as 'user' | 'system',
    query: query
      ? { id: query.id, name: query.name, contentType: query.contentType as ContentType }
      : null,
    provider: provider ? { id: provider.id, name: provider.name, type: provider.type } : null,
    taskId: row.taskId,
    schedule: row.schedule,
    status: row.status as 'active' | 'paused',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  if (row.lastRunAt) {
    dto.lastRun = {
      at: row.lastRunAt,
      itemCount: row.lastRunItemCount ?? 0,
      status: (row.lastRunStatus as 'success' | 'error') ?? 'success',
      error: row.lastRunError ?? undefined,
    };
  }

  if (row.status === 'active') {
    dto.nextRun = computeNextRun(row.schedule);
  }

  return dto;
}

export class AutomationService {
  private readonly db: DrizzleDb;

  constructor({ db }: { db: DrizzleDb }) {
    this.db = db;
  }

  async getById(id: number): Promise<AutomationDto> {
    const rows = await this.db
      .select({
        automation: automations,
        queryId: savedQueries.id,
        queryName: savedQueries.name,
        queryContentType: savedQueries.contentType,
        providerId: metadataProviders.id,
        providerName: metadataProviders.name,
        providerType: metadataProviders.type,
      })
      .from(automations)
      .innerJoin(savedQueries, eq(automations.queryId, savedQueries.id))
      .innerJoin(metadataProviders, eq(automations.providerId, metadataProviders.id))
      .where(eq(automations.id, id));

    if (rows.length === 0) throw new NotFoundError(`Automation ${id} not found`);
    const r = rows[0];
    return rowToDto(
      r.automation,
      { id: r.queryId, name: r.queryName, contentType: r.queryContentType },
      { id: r.providerId, name: r.providerName, type: r.providerType }
    );
  }

  async list(options?: { kind?: 'user' | 'system' }): Promise<AutomationDto[]> {
    const where: SQL | undefined = options?.kind ? eq(automations.kind, options.kind) : undefined;
    const rows = await this.db
      .select({
        automation: automations,
        queryId: savedQueries.id,
        queryName: savedQueries.name,
        queryContentType: savedQueries.contentType,
        providerId: metadataProviders.id,
        providerName: metadataProviders.name,
        providerType: metadataProviders.type,
      })
      .from(automations)
      .leftJoin(savedQueries, eq(automations.queryId, savedQueries.id))
      .leftJoin(metadataProviders, eq(automations.providerId, metadataProviders.id))
      .where(where)
      .orderBy(automations.createdAt);

    return rows.map((r) => {
      const query =
        r.queryId !== null && r.queryName !== null && r.queryContentType !== null
          ? { id: r.queryId, name: r.queryName, contentType: r.queryContentType }
          : null;
      const provider =
        r.providerId !== null && r.providerName !== null && r.providerType !== null
          ? { id: r.providerId, name: r.providerName, type: r.providerType }
          : null;
      return rowToDto(r.automation, query, provider);
    });
  }

  async create(draft: AutomationDraft): Promise<AutomationDto> {
    // Validate cron expression
    try {
      new Cron(draft.schedule, { paused: true }).stop();
    } catch {
      throw new Error(`Invalid cron expression: ${draft.schedule}`);
    }

    // Validate query/provider contentType compatibility
    const [queryRow] = await this.db
      .select({ contentType: savedQueries.contentType })
      .from(savedQueries)
      .where(eq(savedQueries.id, draft.queryId));
    const [providerRow] = await this.db
      .select({ type: metadataProviders.type })
      .from(metadataProviders)
      .where(eq(metadataProviders.id, draft.providerId));

    if (queryRow && providerRow) {
      const contentType = queryRow.contentType as ContentType;
      const providerType = providerRow.type as MetadataProviderType;
      const allowed = CONTENT_TYPE_PROVIDERS[contentType] ?? [];
      if (!allowed.includes(providerType)) {
        throw new ValidationError(
          `Provider type "${providerType}" is not compatible with contentType "${contentType}"`
        );
      }
    }

    const insert: NewAutomation = {
      name: draft.name.trim(),
      queryId: draft.queryId,
      providerId: draft.providerId,
      taskId: draft.taskId,
      schedule: draft.schedule,
      status: 'active',
    };

    const [row] = await this.db.insert(automations).values(insert).returning();

    return this.getById(row.id);
  }

  private async assertMutable(id: number): Promise<void> {
    const [existing] = await this.db
      .select({ id: automations.id, kind: automations.kind })
      .from(automations)
      .where(eq(automations.id, id));
    if (!existing) throw new NotFoundError(`Automation ${id} not found`);
    if (existing.kind === 'system')
      throw new ForbiddenError('System automations cannot be modified');
  }

  async updateStatus(id: number, status: 'active' | 'paused'): Promise<AutomationDto> {
    await this.assertMutable(id);
    await this.db
      .update(automations)
      .set({ status, updatedAt: new Date() })
      .where(eq(automations.id, id));
    return this.getById(id);
  }

  async delete(id: number): Promise<void> {
    await this.assertMutable(id);
    await this.db.delete(automations).where(eq(automations.id, id));
  }

  async listActive(): Promise<{ id: number; name: string; schedule: string }[]> {
    return this.db
      .select({ id: automations.id, name: automations.name, schedule: automations.schedule })
      .from(automations)
      .where(eq(automations.status, 'active'));
  }

  async recordRun(
    id: number,
    result: { itemCount: number; status: 'success' | 'error'; error?: string }
  ): Promise<void> {
    await this.db
      .update(automations)
      .set({
        lastRunAt: new Date().toISOString(),
        lastRunItemCount: result.itemCount,
        lastRunStatus: result.status,
        lastRunError: result.error ?? null,
        updatedAt: new Date(),
      })
      .where(eq(automations.id, id));
  }
}
