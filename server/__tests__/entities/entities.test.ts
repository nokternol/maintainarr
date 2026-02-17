/**
 * Entity decorator & schema tests.
 *
 * These tests verify that TypeORM decorators (@Entity, @Column, @PrimaryGeneratedColumn, etc.)
 * are correctly applied at runtime. If TypeScript decorators are emitted in the wrong format
 * (e.g. Stage-3 / TC39 instead of the legacy experimentalDecorators format that TypeORM expects),
 * the metadata storage will be empty and the database schema will not be created, causing all
 * downstream tests to fail with cryptic "no such table" errors rather than a clear decorator error.
 *
 * Run: vitest run --project server
 */
import 'reflect-metadata';
import type { AppConfig } from '@server/config';
import { _resetDatabase, initializeDatabase } from '@server/database';
import { BaseEntity } from '@server/database/entities/BaseEntity';
import { Session } from '@server/database/entities/Session';
import { User, UserType } from '@server/database/entities/User';
import { getMetadataArgsStorage } from 'typeorm';
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
};

// ---------------------------------------------------------------------------
// Decorator metadata checks (pure unit - no DB needed)
// ---------------------------------------------------------------------------
describe('TypeORM decorator metadata', () => {
  it('User entity is registered in TypeORM metadata storage', () => {
    const storage = getMetadataArgsStorage();
    const tableArgs = storage.tables.filter((t) => t.target === User);

    // If @Entity() did not apply (e.g. wrong decorator emit format), this will be empty.
    expect(tableArgs).toHaveLength(1);
    expect(tableArgs[0].type).toBe('regular');
  });

  it('BaseEntity columns are registered (id, createdAt, updatedAt)', () => {
    const storage = getMetadataArgsStorage();

    // PrimaryGeneratedColumn comes from generations, not columns
    const generatedCols = storage.generations.filter(
      (g) => g.target === BaseEntity || g.target === User
    );
    expect(generatedCols.length).toBeGreaterThanOrEqual(1);
    const idGen = generatedCols.find((g) => g.propertyName === 'id');
    expect(idGen).toBeDefined();

    const cols = storage.columns.filter((c) => c.target === BaseEntity);
    const colNames = cols.map((c) => c.propertyName);
    expect(colNames).toContain('createdAt');
    expect(colNames).toContain('updatedAt');
  });

  it('User entity has all expected columns', () => {
    const storage = getMetadataArgsStorage();
    const cols = storage.columns.filter((c) => c.target === User);
    const colNames = cols.map((c) => c.propertyName);

    expect(colNames).toContain('email');
    expect(colNames).toContain('plexUsername');
    expect(colNames).toContain('plexId');
    expect(colNames).toContain('plexToken');
    expect(colNames).toContain('avatar');
    expect(colNames).toContain('userType');
    expect(colNames).toContain('isActive');
  });

  it('plexToken column has select: false (security)', () => {
    const storage = getMetadataArgsStorage();
    const plexTokenCol = storage.columns.find(
      (c) => c.target === User && c.propertyName === 'plexToken'
    );
    expect(plexTokenCol).toBeDefined();
    expect(plexTokenCol!.options.select).toBe(false);
  });

  it('Session entity is registered with correct table name', () => {
    const storage = getMetadataArgsStorage();
    const tableArgs = storage.tables.filter((t) => t.target === Session);
    expect(tableArgs).toHaveLength(1);
    expect(tableArgs[0].name).toBe('sessions');
  });

  it('Session entity has id, expiredAt, json columns', () => {
    const storage = getMetadataArgsStorage();
    const cols = storage.columns.filter((c) => c.target === Session);
    const colNames = cols.map((c) => c.propertyName);

    expect(colNames).toContain('id');
    expect(colNames).toContain('expiredAt');
    expect(colNames).toContain('json');
  });
});

// ---------------------------------------------------------------------------
// Schema integration checks (requires DB init + migration)
// ---------------------------------------------------------------------------
describe('User & Session schema (integration)', () => {
  beforeEach(async () => {
    const ds = await initializeDatabase(testConfig);
    // migrationsRun is false in test env — run manually so the tables exist
    await ds.runMigrations();
  });

  afterEach(async () => {
    await _resetDatabase();
  });

  it('creates the user table with correct columns', async () => {
    const { getDataSource } = await import('@server/database');
    const ds = getDataSource();

    const result: { name: string }[] = await ds.query("SELECT name FROM pragma_table_info('user')");
    const colNames = result.map((r) => r.name);

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
    const { getDataSource } = await import('@server/database');
    const ds = getDataSource();

    const result: { name: string }[] = await ds.query(
      "SELECT name FROM pragma_table_info('sessions')"
    );
    const colNames = result.map((r) => r.name);

    expect(colNames).toContain('id');
    expect(colNames).toContain('expiredAt');
    expect(colNames).toContain('json');
  });

  it('can save and retrieve a User entity', async () => {
    const { getDataSource } = await import('@server/database');
    const ds = getDataSource();
    const repo = ds.getRepository(User);

    const user = repo.create({
      email: 'test@example.com',
      plexUsername: 'testuser',
      plexId: 12345,
      plexToken: 'secret-token',
      userType: UserType.PLEX,
      isActive: true,
    });

    const saved = await repo.save(user);
    expect(saved.id).toBeDefined();
    expect(saved.createdAt).toBeInstanceOf(Date);

    // plexToken has select: false — not returned by default
    const found = await repo.findOneBy({ id: saved.id });
    expect(found).not.toBeNull();
    expect(found!.email).toBe('test@example.com');
    expect(found!.plexToken).toBeUndefined();
  });
});
