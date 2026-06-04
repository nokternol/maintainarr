/**
 * Drizzle schema shape + database integration tests.
 *
 * Phase 1: Schema structure (pure unit, no DB needed) — verifies the schema
 *          objects have the correct table names, column sets, and enum values.
 *
 * Phase 2: DB integration — runs migrations and verifies the actual SQLite
 *          tables are created with the expected columns.
 *
 * Run: vitest run --project server
 */
import type { AppConfig } from '@server/config';
import { _resetDatabase, getDb, initializeDatabase } from '@server/database';
import {
  MetadataProviderType,
  UserType,
  mediaEnrichment,
  metadataProviders,
  sessions,
  users,
} from '@server/database/schema';
import { eq } from 'drizzle-orm';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const testConfig: AppConfig = {
  NODE_ENV: 'test',
  PORT: 5057,
  COMMIT_TAG: 'test',
  LOG_LEVEL: 'error',
  LOG_DIR: './config/logs',
  DB_PATH: ':memory:',
  DB_LOGGING: false,
  TRUST_PROXY: false,
  TMDB_API_KEY: 'test-tmdb-key',
  SESSION_SECRET: 'test-session-secret',
};

// ---------------------------------------------------------------------------
// Phase 1: Schema shape (no DB needed)
// ---------------------------------------------------------------------------
describe('Drizzle schema shape', () => {
  describe('users table', () => {
    it('has correct table name', () => {
      expect(getTableName(users)).toBe('user');
    });

    it('has all required columns', () => {
      const cols = Object.keys(getTableColumns(users));
      expect(cols).toContain('id');
      expect(cols).toContain('email');
      expect(cols).toContain('plexUsername');
      expect(cols).toContain('plexId');
      expect(cols).toContain('plexToken');
      expect(cols).toContain('avatar');
      expect(cols).toContain('userType');
      expect(cols).toContain('isActive');
      expect(cols).toContain('createdAt');
      expect(cols).toContain('updatedAt');
    });
  });

  describe('sessions table', () => {
    it('has correct table name', () => {
      expect(getTableName(sessions)).toBe('sessions');
    });

    it('has id, expiredAt, json columns', () => {
      const cols = Object.keys(getTableColumns(sessions));
      expect(cols).toContain('id');
      expect(cols).toContain('expiredAt');
      expect(cols).toContain('json');
    });
  });

  describe('metadataProviders table', () => {
    it('has correct table name', () => {
      expect(getTableName(metadataProviders)).toBe('metadata_provider');
    });

    it('has all required columns', () => {
      const cols = Object.keys(getTableColumns(metadataProviders));
      expect(cols).toContain('id');
      expect(cols).toContain('type');
      expect(cols).toContain('name');
      expect(cols).toContain('url');
      expect(cols).toContain('apiKey');
      expect(cols).toContain('settings');
      expect(cols).toContain('isActive');
      expect(cols).toContain('createdAt');
      expect(cols).toContain('updatedAt');
    });
  });

  describe('enums', () => {
    it('UserType has PLEX value', () => {
      expect(UserType.PLEX).toBe('plex');
    });

    it('MetadataProviderType has expected values', () => {
      expect(MetadataProviderType.RADARR).toBe('RADARR');
      expect(MetadataProviderType.SONARR).toBe('SONARR');
      expect(MetadataProviderType.PLEX).toBe('PLEX');
      expect(MetadataProviderType.JELLYFIN).toBe('JELLYFIN');
      expect(MetadataProviderType.TAUTULLI).toBe('TAUTULLI');
    });
  });

  describe('mediaEnrichment table', () => {
    it('has correct table name', () => {
      expect(getTableName(mediaEnrichment)).toBe('media_enrichment');
    });

    it('has all required columns', () => {
      const cols = Object.keys(getTableColumns(mediaEnrichment));
      expect(cols).toContain('id');
      expect(cols).toContain('mediaType');
      expect(cols).toContain('tmdbId');
      expect(cols).toContain('tvdbId');
      expect(cols).toContain('imdbId');
      expect(cols).toContain('certification');
      expect(cols).toContain('collectionId');
      expect(cols).toContain('collectionName');
      expect(cols).toContain('keywords');
      expect(cols).toContain('spokenLanguages');
      expect(cols).toContain('originCountry');
      expect(cols).toContain('streamingServices');
      expect(cols).toContain('awardWinner');
      expect(cols).toContain('oscarWinner');
      expect(cols).toContain('director');
      expect(cols).toContain('actors');
      expect(cols).toContain('boxOffice');
      expect(cols).toContain('enrichedAt');
      expect(cols).toContain('createdAt');
      expect(cols).toContain('updatedAt');
    });
  });

});

// ---------------------------------------------------------------------------
// Phase 2: DB integration (migrations must create tables correctly)
// ---------------------------------------------------------------------------
describe('Schema DB integration', () => {
  beforeEach(async () => {
    // initializeDatabase runs migrations automatically — no separate call needed
    await initializeDatabase(testConfig);
  });

  afterEach(async () => {
    await _resetDatabase();
  });

  it('creates the user table with correct columns', async () => {
    const db = getDb();
    const result = await db.$client.execute("SELECT name FROM pragma_table_info('user')");
    const colNames = result.rows.map((r) => r[0] as string);

    expect(colNames).toContain('id');
    expect(colNames).toContain('email');
    expect(colNames).toContain('plexUsername');
    expect(colNames).toContain('plexId');
    expect(colNames).toContain('plexToken');
    expect(colNames).toContain('avatar');
    expect(colNames).toContain('userType');
    expect(colNames).toContain('isActive');
    expect(colNames).toContain('createdAt');
    expect(colNames).toContain('updatedAt');
  });

  it('creates the sessions table with correct columns', async () => {
    const db = getDb();
    const result = await db.$client.execute("SELECT name FROM pragma_table_info('sessions')");
    const colNames = result.rows.map((r) => r[0] as string);

    expect(colNames).toContain('id');
    expect(colNames).toContain('expiredAt');
    expect(colNames).toContain('json');
  });

  it('creates the metadata_provider table with correct columns', async () => {
    const db = getDb();
    const result = await db.$client.execute(
      "SELECT name FROM pragma_table_info('metadata_provider')"
    );
    const colNames = result.rows.map((r) => r[0] as string);

    expect(colNames).toContain('id');
    expect(colNames).toContain('type');
    expect(colNames).toContain('name');
    expect(colNames).toContain('url');
    expect(colNames).toContain('apiKey');
    expect(colNames).toContain('settings');
    expect(colNames).toContain('isActive');
    expect(colNames).toContain('createdAt');
    expect(colNames).toContain('updatedAt');
  });

  it('can insert and retrieve a user row', async () => {
    const db = getDb();

    await db.insert(users).values({
      email: 'test@example.com',
      plexUsername: 'testuser',
      plexId: 12345,
      plexToken: 'secret-token',
      userType: UserType.PLEX,
      isActive: true,
    });

    const found = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, 'test@example.com'));

    expect(found).toHaveLength(1);
    expect(found[0].email).toBe('test@example.com');
  });

  it('can insert and retrieve a metadataProvider row', async () => {
    const db = getDb();

    await db.insert(metadataProviders).values({
      type: MetadataProviderType.RADARR,
      name: 'Local Radarr',
      url: 'http://localhost:7878',
      apiKey: 'secret-api-key',
      settings: JSON.stringify({ profileId: 1 }),
      isActive: true,
    });

    const found = await db
      .select({ id: metadataProviders.id, name: metadataProviders.name })
      .from(metadataProviders);

    expect(found).toHaveLength(1);
    expect(found[0].name).toBe('Local Radarr');
  });

  it('creates the media_enrichment table with correct columns', async () => {
    const db = getDb();
    const result = await db.$client.execute(
      "SELECT name FROM pragma_table_info('media_enrichment')"
    );
    const colNames = result.rows.map((r) => r[0] as string);

    expect(colNames).toContain('id');
    expect(colNames).toContain('media_type');
    expect(colNames).toContain('tmdb_id');
    expect(colNames).toContain('tvdb_id');
    expect(colNames).toContain('imdb_id');
    expect(colNames).toContain('certification');
    expect(colNames).toContain('collection_id');
    expect(colNames).toContain('collection_name');
    expect(colNames).toContain('keywords');
    expect(colNames).toContain('spoken_languages');
    expect(colNames).toContain('origin_country');
    expect(colNames).toContain('streaming_services');
    expect(colNames).toContain('award_winner');
    expect(colNames).toContain('oscar_winner');
    expect(colNames).toContain('director');
    expect(colNames).toContain('actors');
    expect(colNames).toContain('box_office');
    expect(colNames).toContain('enriched_at');
    expect(colNames).toContain('createdAt');
    expect(colNames).toContain('updatedAt');
  });

  it('can insert a media_enrichment row', async () => {
    const db = getDb();

    await db.insert(mediaEnrichment).values({
      mediaType: 'movie',
      tmdbId: 12345,
      certification: 'R',
      awardWinner: true,
      streamingServices: JSON.stringify({
        netflix: true,
        prime: false,
        disney: false,
        hulu: false,
        apple: false,
        hbo: false,
        paramount: false,
        peacock: false,
      }),
    });

    const found = await db
      .select({
        certification: mediaEnrichment.certification,
        awardWinner: mediaEnrichment.awardWinner,
      })
      .from(mediaEnrichment);

    expect(found).toHaveLength(1);
    expect(found[0].certification).toBe('R');
    expect(found[0].awardWinner).toBe(true);
  });
});
