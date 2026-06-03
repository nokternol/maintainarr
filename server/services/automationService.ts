import { Cron } from 'croner';
import { and, eq } from 'drizzle-orm';
import type { DrizzleDb } from '../database';
import {
  type Automation as AutomationRow,
  type NewAutomation,
  automations,
  metadataProviders,
  savedQueries,
} from '../database/schema';
import { NotFoundError } from '../errors';
import type { QueryFilters } from './savedQueryService';

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
  query: { id: number; name: string; filters: QueryFilters };
  provider: { id: number; name: string; type: string };
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

function rowToDto(
  row: AutomationRow,
  query: { id: number; name: string; filters: string },
  provider: { id: number; name: string; type: string }
): AutomationDto {
  const dto: AutomationDto = {
    id: row.id,
    name: row.name,
    query: {
      id: query.id,
      name: query.name,
      filters: JSON.parse(query.filters) as QueryFilters,
    },
    provider: { id: provider.id, name: provider.name, type: provider.type },
    taskId: row.taskId,
    schedule: row.schedule,
    status: row.status as 'active' | 'paused',
    createdAt: (row.createdAt as unknown as Date).toISOString(),
    updatedAt: (row.updatedAt as unknown as Date).toISOString(),
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

  async list(): Promise<AutomationDto[]> {
    const rows = await this.db
      .select({
        automation: automations,
        queryId: savedQueries.id,
        queryName: savedQueries.name,
        queryFilters: savedQueries.filters,
        providerId: metadataProviders.id,
        providerName: metadataProviders.name,
        providerType: metadataProviders.type,
      })
      .from(automations)
      .innerJoin(savedQueries, eq(automations.queryId, savedQueries.id))
      .innerJoin(metadataProviders, eq(automations.providerId, metadataProviders.id))
      .orderBy(automations.createdAt);

    return rows.map((r) =>
      rowToDto(
        r.automation,
        { id: r.queryId, name: r.queryName, filters: r.queryFilters },
        { id: r.providerId, name: r.providerName, type: r.providerType }
      )
    );
  }

  async create(draft: AutomationDraft): Promise<AutomationDto> {
    // Validate cron expression
    try {
      new Cron(draft.schedule, { paused: true }).stop();
    } catch {
      throw new Error(`Invalid cron expression: ${draft.schedule}`);
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

    const [queryRow] = await this.db
      .select()
      .from(savedQueries)
      .where(eq(savedQueries.id, row.queryId));
    const [providerRow] = await this.db
      .select({
        id: metadataProviders.id,
        name: metadataProviders.name,
        type: metadataProviders.type,
      })
      .from(metadataProviders)
      .where(eq(metadataProviders.id, row.providerId));

    return rowToDto(
      row,
      { id: queryRow.id, name: queryRow.name, filters: queryRow.filters },
      { id: providerRow.id, name: providerRow.name, type: providerRow.type }
    );
  }

  async updateStatus(id: number, status: 'active' | 'paused'): Promise<AutomationDto> {
    const [row] = await this.db
      .update(automations)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(automations.id, id)))
      .returning();

    if (!row) throw new NotFoundError(`Automation ${id} not found`);

    const [queryRow] = await this.db
      .select()
      .from(savedQueries)
      .where(eq(savedQueries.id, row.queryId));
    const [providerRow] = await this.db
      .select({
        id: metadataProviders.id,
        name: metadataProviders.name,
        type: metadataProviders.type,
      })
      .from(metadataProviders)
      .where(eq(metadataProviders.id, row.providerId));

    return rowToDto(
      row,
      { id: queryRow.id, name: queryRow.name, filters: queryRow.filters },
      { id: providerRow.id, name: providerRow.name, type: providerRow.type }
    );
  }

  async delete(id: number): Promise<void> {
    const [row] = await this.db.delete(automations).where(eq(automations.id, id)).returning();
    if (!row) throw new NotFoundError(`Automation ${id} not found`);
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
