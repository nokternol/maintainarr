import { eq } from 'drizzle-orm';
import type { DrizzleDb } from '../database';
import {
  type NewSavedQuery,
  type SavedQuery as SavedQueryRow,
  savedQueries,
} from '../database/schema';
import { NotFoundError } from '../errors';

export interface QueryFilters {
  [key: string]: string | number | boolean | undefined;
}

export interface SavedQueryDraft {
  name: string;
  filters: QueryFilters;
}

export interface SavedQueryDto {
  id: number;
  name: string;
  filters: QueryFilters;
  createdAt: string;
}

function toDto(row: SavedQueryRow): SavedQueryDto {
  return {
    id: row.id,
    name: row.name,
    filters: JSON.parse(row.filters) as QueryFilters,
    createdAt: (row.createdAt as unknown as Date).toISOString(),
  };
}

export class SavedQueryService {
  private readonly db: DrizzleDb;

  constructor({ db }: { db: DrizzleDb }) {
    this.db = db;
  }

  async list(): Promise<SavedQueryDto[]> {
    const rows = await this.db.select().from(savedQueries).orderBy(savedQueries.createdAt);
    return rows.map(toDto);
  }

  async create(draft: SavedQueryDraft): Promise<SavedQueryDto> {
    const insert: NewSavedQuery = {
      name: draft.name.trim(),
      filters: JSON.stringify(draft.filters),
    };
    const [row] = await this.db.insert(savedQueries).values(insert).returning();
    return toDto(row);
  }

  async findById(id: number): Promise<SavedQueryDto> {
    const [row] = await this.db.select().from(savedQueries).where(eq(savedQueries.id, id));
    if (!row) throw new NotFoundError(`Saved query ${id} not found`);
    return toDto(row);
  }

  async delete(id: number): Promise<void> {
    const [row] = await this.db.delete(savedQueries).where(eq(savedQueries.id, id)).returning();
    if (!row) throw new NotFoundError(`Saved query ${id} not found`);
  }
}
