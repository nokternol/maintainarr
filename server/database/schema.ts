import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
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
// mediaEnrichment
// ---------------------------------------------------------------------------
export const mediaEnrichment = sqliteTable(
  'media_enrichment',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    mediaType: text('media_type').notNull(), // 'movie' | 'series'
    tmdbId: integer('tmdb_id'),
    tvdbId: integer('tvdb_id'),
    imdbId: text('imdb_id'),
    certification: text('certification'),
    collectionId: integer('collection_id'),
    collectionName: text('collection_name'),
    keywords: text('keywords'), // JSON: string[]
    spokenLanguages: text('spoken_languages'), // JSON: string[]
    originCountry: text('origin_country'), // JSON: string[]
    streamingServices: text('streaming_services'), // JSON: TmdbStreamingServices
    awardWinner: integer('award_winner', { mode: 'boolean' }),
    oscarWinner: integer('oscar_winner', { mode: 'boolean' }),
    director: text('director'),
    actors: text('actors'),
    boxOffice: integer('box_office'),
    enrichedAt: text('enriched_at'),
    createdAt: createdAt('createdAt'),
    updatedAt: updatedAt('updatedAt'),
  },
  (t) => [
    uniqueIndex('UQ_enrichment_movie').on(t.mediaType, t.tmdbId),
    uniqueIndex('UQ_enrichment_series').on(t.mediaType, t.tvdbId),
  ]
);

// ---------------------------------------------------------------------------
// groups
// ---------------------------------------------------------------------------
export const groups = sqliteTable('groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  filterCriteria: text('filter_criteria').notNull(), // JSON
  createdAt: createdAt('createdAt'),
  updatedAt: updatedAt('updatedAt'),
});

// ---------------------------------------------------------------------------
// rules
// ---------------------------------------------------------------------------
export const rules = sqliteTable('rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id')
    .notNull()
    .references(() => groups.id),
  actionType: text('action_type').notNull(),
  actionParams: text('action_params').notNull(), // JSON
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt('createdAt'),
  updatedAt: updatedAt('updatedAt'),
});

// ---------------------------------------------------------------------------
// Inferred row types (for use in service return types)
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
/** User shape returned from standard read queries — plexToken intentionally excluded */
export type PublicUser = Omit<User, 'plexToken'>;

/** Raw DB-inferred type — settings is a JSON string, dates are strings */
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

export type MediaEnrichment = typeof mediaEnrichment.$inferSelect;
export type NewMediaEnrichment = typeof mediaEnrichment.$inferInsert;

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;

export type Rule = typeof rules.$inferSelect;
export type NewRule = typeof rules.$inferInsert;
