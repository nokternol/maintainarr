import { desc, eq } from 'drizzle-orm';
import { automationRuns, automations } from '../../database/schema';
import type { DrizzleDb } from '../../kernel/db';

export interface AutomationRunDto {
  id: number;
  automationId: number;
  automationName: string;
  ranAt: Date;
  status: 'success' | 'error';
  itemCount: number | null;
  error: string | null;
  createdAt: Date;
}

export interface CreateRunData {
  automationId: number;
  status: 'success' | 'error';
  itemCount?: number;
  error?: string;
  kind?: 'user' | 'system';
}

export interface ListRunsOptions {
  automationId?: number;
  limit?: number;
  offset?: number;
}

function toDate(value: unknown): Date {
  return value as Date;
}

function rowToDto(row: {
  id: number;
  automationId: number;
  automationName: string;
  ranAt: unknown;
  status: string;
  itemCount: number | null;
  error: string | null;
  createdAt: unknown;
}): AutomationRunDto {
  return {
    id: row.id,
    automationId: row.automationId,
    automationName: row.automationName,
    ranAt: toDate(row.ranAt),
    status: row.status as 'success' | 'error',
    itemCount: row.itemCount ?? null,
    error: row.error ?? null,
    createdAt: toDate(row.createdAt),
  };
}

export class AutomationRunService {
  private readonly db: DrizzleDb;

  constructor({ db }: { db: DrizzleDb }) {
    this.db = db;
  }

  async createRun(data: CreateRunData): Promise<AutomationRunDto> {
    const [row] = await this.db
      .insert(automationRuns)
      .values({
        automationId: data.automationId,
        ranAt: new Date(),
        status: data.status,
        itemCount: data.itemCount ?? null,
        error: data.error ?? null,
        kind: data.kind ?? 'user',
      })
      .returning();

    const [automationRow] = await this.db
      .select({ name: automations.name })
      .from(automations)
      .where(eq(automations.id, data.automationId));

    return rowToDto({
      id: row.id,
      automationId: row.automationId,
      automationName: automationRow?.name ?? '',
      ranAt: row.ranAt,
      status: row.status,
      itemCount: row.itemCount ?? null,
      error: row.error ?? null,
      createdAt: row.createdAt,
    });
  }

  async listRuns(opts: ListRunsOptions = {}): Promise<AutomationRunDto[]> {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

    let query = this.db
      .select({
        id: automationRuns.id,
        automationId: automationRuns.automationId,
        automationName: automations.name,
        ranAt: automationRuns.ranAt,
        status: automationRuns.status,
        itemCount: automationRuns.itemCount,
        error: automationRuns.error,
        createdAt: automationRuns.createdAt,
      })
      .from(automationRuns)
      .innerJoin(automations, eq(automationRuns.automationId, automations.id))
      .orderBy(desc(automationRuns.ranAt), desc(automationRuns.id))
      .limit(limit)
      .offset(offset)
      .$dynamic();

    if (opts.automationId !== undefined) {
      query = query.where(eq(automationRuns.automationId, opts.automationId));
    }

    const rows = await query;
    return rows.map(rowToDto);
  }
}
