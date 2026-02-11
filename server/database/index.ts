import path from 'node:path';
import { DataSource } from 'typeorm';
import type { AppConfig } from '../config';
import { getChildLogger } from '../logger';

const log = getChildLogger('Database');

let _dataSource: DataSource | null = null;

/**
 * Initialize the TypeORM DataSource connection.
 * Call once at server startup. Throws on connection failure.
 */
export async function initializeDatabase(config: AppConfig): Promise<DataSource> {
  if (_dataSource?.isInitialized) {
    log.warn('Database already initialized, skipping');
    return _dataSource;
  }

  try {
    // Resolve DB_PATH relative to project root (unless it's :memory:)
    const dbPath = config.DB_PATH === ':memory:'
      ? ':memory:'
      : path.resolve(process.cwd(), config.DB_PATH);

    log.info('Initializing database connection', {
      path: dbPath,
      logging: config.DB_LOGGING,
    });

    _dataSource = new DataSource({
      type: 'sqlite',
      database: dbPath,
      synchronize: false, // Use migrations in production
      logging: config.DB_LOGGING ? ['query', 'error', 'warn'] : ['error'],
      entities: [], // Concrete entities will be registered here as they're created
      migrations: [], // Migrations will be registered here as they're created
      migrationsRun: config.NODE_ENV !== 'test', // Auto-run in dev/prod, manual in tests
    });

    await _dataSource.initialize();

    log.info('Database connection established', {
      migrations: _dataSource.migrations.length,
      entities: _dataSource.entityMetadatas.length,
    });

    return _dataSource;
  } catch (error) {
    log.error('Failed to initialize database', { error });
    throw error;
  }
}

/**
 * Get the initialized DataSource. Throws if not initialized.
 */
export function getDataSource(): DataSource {
  if (!_dataSource || !_dataSource.isInitialized) {
    throw new Error('Database not initialized. Call initializeDatabase() at startup.');
  }
  return _dataSource;
}

/**
 * Close the database connection. Used for graceful shutdown.
 */
export async function closeDatabase(): Promise<void> {
  if (_dataSource?.isInitialized) {
    log.info('Closing database connection');
    await _dataSource.destroy();
    _dataSource = null;
  }
}

/**
 * Reset database state. Only for use in tests.
 */
export async function _resetDatabase(): Promise<void> {
  await closeDatabase();
}
