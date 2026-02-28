import { sql } from 'drizzle-orm';
import { customType } from 'drizzle-orm/sqlite-core';

/** SQLite UTC datetime format: 'YYYY-MM-DD HH:MM:SS' ↔ Date */
const sqliteDateTime = customType<{ data: Date; driverData: string }>({
  dataType: () => 'text',
  fromDriver: (value: string) => new Date(`${value.replace(' ', 'T')}Z`),
  toDriver: (value: Date) => value.toISOString().slice(0, 19).replace('T', ' '),
});

/**
 * A text column storing UTC datetime in SQLite's native format.
 * Returns a Date on read, accepts a Date on write.
 * Defaults to the current time on INSERT.
 */
export const createdAt = (name: string) =>
  sqliteDateTime(name).notNull().default(sql`(datetime('now'))`);

/**
 * A text column storing UTC datetime in SQLite's native format.
 * Returns a Date on read, accepts a Date on write.
 * Defaults to the current time on INSERT and auto-updates on every UPDATE.
 */
export const updatedAt = (name: string) =>
  sqliteDateTime(name)
    .notNull()
    .default(sql`(datetime('now'))`)
    .$onUpdateFn(() => new Date());
