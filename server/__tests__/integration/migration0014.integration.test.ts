import fs from 'node:fs';
import path from 'node:path';
/**
 * Verifies the `media_identity`/`media_item` split migration (0014) and the
 * filter-value provider scope migration (0015) against pre-split, production-shaped
 * data: preserves `media_identity.id` (so `media_enrichment` rows survive) for types
 * with an active provider instance, attributes each migrated group's copy to that
 * active instance, and drops rows whose owning type has no active instance.
 *
 * Runs the two migration files directly (rather than through the app's full
 * `initializeDatabase`) against a hand-built pre-0014 schema, so the test is
 * independent of every earlier migration's exact history.
 *
 * Run: vitest run --project server
 */
import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';

let client: ReturnType<typeof createClient> | undefined;

afterEach(() => {
  client?.close();
  client = undefined;
});

const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');

function readStatements(file: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
}

/**
 * Runs migration SQL the way `drizzle-orm`'s real migrator does: with
 * `PRAGMA foreign_keys=OFF` for the duration, so `DROP TABLE` on a table with
 * cascade-referencing children doesn't itself cascade-delete rows the rebuild
 * is trying to preserve. See `@libsql/client`'s `migrate()` implementation.
 */
async function runMigration(c: ReturnType<typeof createClient>, sql: string): Promise<void> {
  await c.execute('PRAGMA foreign_keys=OFF');
  await c.executeMultiple(sql);
  await c.execute('PRAGMA foreign_keys=ON');
}

async function seedPreSplitSchema(c: ReturnType<typeof createClient>): Promise<void> {
  await c.executeMultiple(`
    CREATE TABLE metadata_provider (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      apiKey TEXT,
      settings TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER,
      updatedAt INTEGER
    );
    CREATE TABLE media_identity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sourceType TEXT NOT NULL,
      sourceId INTEGER NOT NULL,
      tmdbId INTEGER,
      imdbId TEXT,
      tvdbId INTEGER,
      tvMazeId INTEGER,
      plexRatingKey TEXT,
      jellyfinItemId TEXT,
      resolvedAt INTEGER,
      UNIQUE(sourceType, sourceId)
    );
    CREATE TABLE media_enrichment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mediaIdentityId INTEGER NOT NULL REFERENCES media_identity(id) ON DELETE CASCADE,
      playCount INTEGER,
      lastWatchedAt TEXT,
      overseerrRequestStatus INTEGER,
      overseerrHasIssue INTEGER,
      tmdbStatus TEXT,
      enrichedAt INTEGER
    );
    CREATE TABLE media_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contentType TEXT NOT NULL DEFAULT 'movie',
      createdAt INTEGER
    );
    CREATE TABLE media_query_filter_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mediaQueryId INTEGER NOT NULL REFERENCES media_queries(id) ON DELETE CASCADE,
      filterKey TEXT NOT NULL,
      value TEXT NOT NULL
    );
  `);
}

describe('0014_media_identity_split + 0015_filter_value_provider_scope', () => {
  it('preserves media_identity.id and its media_enrichment row for a type with an active instance', async () => {
    client = createClient({ url: ':memory:' });
    await seedPreSplitSchema(client);

    await client.execute(
      `INSERT INTO metadata_provider (id, type, name, url, isActive) VALUES (1, 'RADARR', 'Radarr', 'http://r', 1)`
    );
    await client.execute(
      `INSERT INTO media_identity (id, sourceType, sourceId, tmdbId, resolvedAt) VALUES (7, 'RADARR', 1, 603, 1000)`
    );
    await client.execute('INSERT INTO media_enrichment (mediaIdentityId, playCount) VALUES (7, 3)');

    await runMigration(client, readStatements('0014_media_identity_split.sql'));
    await runMigration(client, readStatements('0015_filter_value_provider_scope.sql'));

    const identities = await client.execute('SELECT * FROM media_identity');
    expect(identities.rows).toHaveLength(1);
    expect(identities.rows[0].id).toBe(7);
    expect(identities.rows[0].kind).toBe('movie');
    expect(identities.rows[0].tmdbId).toBe(603);

    const items = await client.execute('SELECT * FROM media_item');
    expect(items.rows).toHaveLength(1);
    expect(items.rows[0].providerId).toBe(1);
    expect(items.rows[0].externalId).toBe(1);
    expect(items.rows[0].mediaIdentityId).toBe(7);

    const enrichment = await client.execute('SELECT * FROM media_enrichment');
    expect(enrichment.rows).toHaveLength(1);
    expect(enrichment.rows[0].mediaIdentityId).toBe(7);
  });

  it('drops the group and its enrichment when the owning type has no active instance', async () => {
    client = createClient({ url: ':memory:' });
    await seedPreSplitSchema(client);

    // Radarr configured but inactive — nothing can be attributed to it.
    await client.execute(
      `INSERT INTO metadata_provider (id, type, name, url, isActive) VALUES (1, 'RADARR', 'Radarr', 'http://r', 0)`
    );
    await client.execute(
      `INSERT INTO media_identity (id, sourceType, sourceId, tmdbId, resolvedAt) VALUES (9, 'RADARR', 1, 603, 1000)`
    );
    await client.execute('INSERT INTO media_enrichment (mediaIdentityId, playCount) VALUES (9, 3)');

    await runMigration(client, readStatements('0014_media_identity_split.sql'));
    await runMigration(client, readStatements('0015_filter_value_provider_scope.sql'));

    expect((await client.execute('SELECT * FROM media_identity')).rows).toHaveLength(0);
    expect((await client.execute('SELECT * FROM media_item')).rows).toHaveLength(0);
    expect((await client.execute('SELECT * FROM media_enrichment')).rows).toHaveLength(0);
  });

  it('adds a nullable providerId column to media_query_filter_values', async () => {
    client = createClient({ url: ':memory:' });
    await seedPreSplitSchema(client);
    await client.execute(
      `INSERT INTO metadata_provider (id, type, name, url) VALUES (1, 'RADARR', 'Radarr', 'http://r')`
    );
    await client.execute(`INSERT INTO media_queries (id, name) VALUES (1, 'Q')`);
    await client.execute(
      `INSERT INTO media_query_filter_values (mediaQueryId, filterKey, value) VALUES (1, 'tagIds', '1')`
    );

    await runMigration(client, readStatements('0014_media_identity_split.sql'));
    await runMigration(client, readStatements('0015_filter_value_provider_scope.sql'));

    const rows = await client.execute('SELECT * FROM media_query_filter_values');
    expect(rows.rows[0].providerId).toBeNull();
  });

  it('enforces one movie group per tmdbId and one show group per tvdbId', async () => {
    client = createClient({ url: ':memory:' });
    await seedPreSplitSchema(client);
    await client.execute(
      `INSERT INTO metadata_provider (id, type, name, url, isActive) VALUES (1, 'RADARR', 'Radarr', 'http://r', 1)`
    );
    await client.execute(
      `INSERT INTO media_identity (id, sourceType, sourceId, tmdbId, resolvedAt) VALUES (1, 'RADARR', 1, 603, 1000)`
    );

    await runMigration(client, readStatements('0014_media_identity_split.sql'));
    await runMigration(client, readStatements('0015_filter_value_provider_scope.sql'));

    await expect(
      client.execute(`INSERT INTO media_identity (kind, tmdbId) VALUES ('movie', 603)`)
    ).rejects.toThrow();
    // A tv-kind group with the same numeric id is a different title, not a collision.
    await expect(
      client.execute(`INSERT INTO media_identity (kind, tvdbId) VALUES ('show', 603)`)
    ).resolves.toBeDefined();
  });
});
