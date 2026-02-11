import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppConfig } from '../config';
import { _resetDatabase, getDataSource, initializeDatabase } from '../database';

describe('database', () => {
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

  afterEach(async () => {
    await _resetDatabase();
  });

  describe('initializeDatabase', () => {
    it('successfully initializes with valid config', async () => {
      const dataSource = await initializeDatabase(testConfig);

      expect(dataSource).toBeDefined();
      expect(dataSource.isInitialized).toBe(true);
    });

    it('returns existing connection if already initialized', async () => {
      const first = await initializeDatabase(testConfig);
      const second = await initializeDatabase(testConfig);

      expect(second).toBe(first);
    });

    it('creates connection with correct database type', async () => {
      const dataSource = await initializeDatabase(testConfig);

      expect(dataSource.driver.options.type).toBe('sqlite');
    });

    it('respects DB_LOGGING config', async () => {
      const configWithLogging = { ...testConfig, DB_LOGGING: true };
      const dataSource = await initializeDatabase(configWithLogging);

      expect(dataSource.driver.options.logging).toEqual(['query', 'error', 'warn']);
    });

    it('disables logging when DB_LOGGING is false', async () => {
      const dataSource = await initializeDatabase(testConfig);

      expect(dataSource.driver.options.logging).toEqual(['error']);
    });
  });

  describe('getDataSource', () => {
    it('throws if database not initialized', () => {
      expect(() => getDataSource()).toThrow('Database not initialized');
    });

    it('returns DataSource after initialization', async () => {
      const initialized = await initializeDatabase(testConfig);
      const retrieved = getDataSource();

      expect(retrieved).toBe(initialized);
      expect(retrieved.isInitialized).toBe(true);
    });
  });

  describe('_resetDatabase', () => {
    it('cleans up database state for tests', async () => {
      await initializeDatabase(testConfig);
      expect(getDataSource().isInitialized).toBe(true);

      await _resetDatabase();

      expect(() => getDataSource()).toThrow('Database not initialized');
    });

    it('handles reset when database was never initialized', async () => {
      await expect(_resetDatabase()).resolves.not.toThrow();
    });
  });
});
