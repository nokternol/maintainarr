import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt, updatedAt } from './columns/datetime';
export { createdAt, updatedAt };

// ---------------------------------------------------------------------------
// Enums (plain TypeScript — SQLite has no native enum type)
// ---------------------------------------------------------------------------
export enum UserType {
  PLEX = 'plex',
}

export enum MetadataProviderType {
  RADARR = 'RADARR',
  SONARR = 'SONARR',
  TAUTULLI = 'TAUTULLI',
  PLEX = 'PLEX',
  JELLYFIN = 'JELLYFIN',
  OVERSEERR = 'OVERSEERR',
  SEERR = 'SEERR',
  TMDB = 'TMDB',
  OMDB = 'OMDB',
  TVMAZE = 'TVMAZE',
}

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export const users = sqliteTable(
  'user',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull().unique(),
    plexUsername: text('plexUsername'),
    plexId: integer('plexId'),
    // select: false equivalent — omit from all standard queries at the call site
    plexToken: text('plexToken'),
    avatar: text('avatar'),
    userType: text('userType').notNull().default(UserType.PLEX),
    isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
    createdAt: createdAt('createdAt'),
    updatedAt: updatedAt('updatedAt'),
  },
  (table) => [index('IDX_user_email').on(table.email), index('IDX_user_plexId').on(table.plexId)]
);

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiredAt: integer('expiredAt', { mode: 'number' }).notNull(),
    json: text('json').notNull(),
  },
  (table) => [index('IDX_session_expiredAt').on(table.expiredAt)]
);

// ---------------------------------------------------------------------------
// metadataProviders
// ---------------------------------------------------------------------------
export const metadataProviders = sqliteTable(
  'metadata_provider',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type').notNull(),
    name: text('name').notNull(),
    url: text('url').notNull(),
    // select: false equivalent — omit from all standard queries at the call site
    apiKey: text('apiKey'),
    settings: text('settings'),
    isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
    createdAt: createdAt('createdAt'),
    updatedAt: updatedAt('updatedAt'),
  },
  (table) => [index('IDX_metadata_provider_type').on(table.type)]
);

// ---------------------------------------------------------------------------
// Inferred row types (for use in service return types)
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
/** User shape returned from standard read queries — plexToken intentionally excluded */
export type PublicUser = Omit<User, 'plexToken'>;

/** Raw DB-inferred type — settings is a JSON string, dates are Date instances (fromDriver converts them) */
export type RawMetadataProvider = typeof metadataProviders.$inferSelect;
export type NewMetadataProvider = typeof metadataProviders.$inferInsert;

/**
 * Parsed domain type for MetadataProvider — used in provider classes and handlers.
 * Settings is a deserialized object, timestamps are Date instances,
 * and type is narrowed to the MetadataProviderType enum.
 */
export type MetadataProvider = {
  id: number;
  type: MetadataProviderType;
  name: string;
  url: string;
  apiKey: string | null;
  settings: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// savedQueries
// ---------------------------------------------------------------------------
export const savedQueries = sqliteTable('saved_queries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  filters: text('filters').notNull(), // JSON: QueryFilters
  createdAt: createdAt('createdAt'),
});

// ---------------------------------------------------------------------------
// automations
// ---------------------------------------------------------------------------
export const automations = sqliteTable(
  'automations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    queryId: integer('queryId').references(() => savedQueries.id, { onDelete: 'cascade' }),
    providerId: integer('providerId').references(() => metadataProviders.id, {
      onDelete: 'cascade',
    }),
    taskId: text('taskId').notNull(),
    schedule: text('schedule').notNull(), // cron expression
    status: text('status').notNull().default('active'), // 'active' | 'paused'
    lastRunAt: text('lastRunAt'),
    lastRunItemCount: integer('lastRunItemCount'),
    lastRunStatus: text('lastRunStatus'), // 'success' | 'error'
    lastRunError: text('lastRunError'),
    kind: text('kind').notNull().default('user'), // 'user' | 'system'
    createdAt: createdAt('createdAt'),
    updatedAt: updatedAt('updatedAt'),
  },
  (table) => [index('IDX_automations_status').on(table.status)]
);

export type SavedQuery = typeof savedQueries.$inferSelect;
export type NewSavedQuery = typeof savedQueries.$inferInsert;

export type Automation = typeof automations.$inferSelect;
export type NewAutomation = typeof automations.$inferInsert;

// ---------------------------------------------------------------------------
// automationRuns
// ---------------------------------------------------------------------------
export const automationRuns = sqliteTable(
  'automation_runs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    automationId: integer('automationId')
      .notNull()
      .references(() => automations.id, { onDelete: 'cascade' }),
    ranAt: createdAt('ranAt'),
    status: text('status').notNull(), // 'success' | 'error'
    itemCount: integer('itemCount'),
    error: text('error'),
    kind: text('kind').notNull().default('user'), // 'user' | 'system'
    createdAt: createdAt('createdAt'),
  },
  (table) => [index('IDX_automation_runs_automationId').on(table.automationId)]
);

export type AutomationRun = typeof automationRuns.$inferSelect;
export type NewAutomationRun = typeof automationRuns.$inferInsert;
