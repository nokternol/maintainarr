import { sql } from 'drizzle-orm';
import { text } from 'drizzle-orm/sqlite-core';

/** SQLite datetime format: 'YYYY-MM-DD HH:MM:SS' (UTC) */
const nowUtc = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/**
 * A text column storing UTC datetime in SQLite's native format.
 * Defaults to the current time on INSERT.
 */
export const createdAt = (name: string) =>
  text(name).notNull().default(sql`(datetime('now'))`);

/**
 * A text column storing UTC datetime in SQLite's native format.
 * Defaults to the current time on INSERT and auto-updates on every UPDATE
 * via Drizzle's client-side $onUpdateFn hook.
 */
export const updatedAt = (name: string) =>
  text(name)
    .notNull()
    .default(sql`(datetime('now'))`)
    .$onUpdateFn(nowUtc);
