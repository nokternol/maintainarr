import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt, updatedAt } from './columns/datetime';

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
  (table) => [
    index('IDX_user_email').on(table.email),
    index('IDX_user_plexId').on(table.plexId),
  ]
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
export type MetadataProvider = typeof metadataProviders.$inferSelect;
export type NewMetadataProvider = typeof metadataProviders.$inferInsert;
