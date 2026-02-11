# Database

TypeORM-based persistence layer using SQLite. Entities, migrations, and repositories.

## Architecture

```
server/database/
  index.ts           # DataSource initialization (fail-fast pattern)
  entities/          # TypeORM entities (database models)
    BaseEntity.ts    # Base class with id, createdAt, updatedAt
  migrations/        # Database migrations (schema changes)
  DATABASE.md        # This file
```

## Core Patterns

### Fail-Fast Initialization

The database follows the same fail-fast pattern as config:

```typescript
// server/index.ts startup sequence
const config = loadConfig();
const dataSource = await initializeDatabase(config);

// Later in services or handlers
const dataSource = getDataSource(); // Throws if not initialized
```

**Why:** If the database connection fails, the server won't start. This prevents requests from hitting broken paths.

### BaseEntity

All entities extend `BaseEntity` which provides common columns:

```typescript
import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../BaseEntity';

@Entity()
export class Example extends BaseEntity {
  // BaseEntity provides: id, createdAt, updatedAt

  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;
}
```

**Columns provided by BaseEntity:**
- `id` - Auto-incrementing primary key
- `createdAt` - Timestamp of record creation
- `updatedAt` - Timestamp of last update

## Configuration

Environment variables (defined in `server/config.ts`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PATH` | `./config/db/maintainarr.db` | SQLite database file path |
| `DB_LOGGING` | `false` | Enable TypeORM query logging (dev only) |

## Working with Entities

### Creating a New Entity

1. **Create the entity file**: `server/database/entities/YourEntity.ts`

```typescript
import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './BaseEntity';

@Entity()
export class YourEntity extends BaseEntity {
  @Column()
  @Index()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'boolean', default: false })
  isActive!: boolean;
}
```

2. **TypeORM will auto-discover it** via the glob pattern in `server/database/index.ts`:
   ```typescript
   entities: [path.join(__dirname, 'entities', '**', '*.{ts,js}')]
   ```

3. **Generate a migration** (see Migrations section below)

4. **Use it in services** via the repository pattern:

```typescript
import { getChildLogger } from '../logger';
import { NotFoundError } from '../errors';
import type { DataSource } from 'typeorm';
import { YourEntity } from '../database/entities/YourEntity';

const log = getChildLogger('YourService');

export class YourService {
  constructor(private readonly dataSource: DataSource) {}

  async getById(id: number): Promise<YourEntity> {
    const repo = this.dataSource.getRepository(YourEntity);
    const entity = await repo.findOneBy({ id });
    if (!entity) {
      throw new NotFoundError(`YourEntity ${id} not found`);
    }
    return entity;
  }

  async create(data: { name: string; description?: string }): Promise<YourEntity> {
    const repo = this.dataSource.getRepository(YourEntity);
    const entity = repo.create(data);
    await repo.save(entity);
    log.info('Created YourEntity', { id: entity.id });
    return entity;
  }
}
```

## Migrations

TypeORM migrations track schema changes. Never use `synchronize: true` in production.

### Generating Migrations

After creating or modifying entities:

```bash
# Generate migration from entity changes
npx typeorm migration:generate -d server/database/index.ts server/database/migrations/YourMigrationName

# Create empty migration for manual changes
npx typeorm migration:create server/database/migrations/YourMigrationName
```

### Running Migrations

Migrations run automatically at startup via `migrationsRun: true` (except in test environment).

Manual migration commands:

```bash
# Run pending migrations
npx typeorm migration:run -d server/database/index.ts

# Revert last migration
npx typeorm migration:revert -d server/database/index.ts

# Show migration status
npx typeorm migration:show -d server/database/index.ts
```

### Migration Example

```typescript
// server/database/migrations/1234567890123-CreateYourEntity.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateYourEntity1234567890123 implements MigrationInterface {
  name = 'CreateYourEntity1234567890123';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "your_entity" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        "isActive" boolean NOT NULL DEFAULT (0),
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_your_entity_name" ON "your_entity" ("name")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_your_entity_name"`);
    await queryRunner.query(`DROP TABLE "your_entity"`);
  }
}
```

## Using the DataSource in Services

Services receive the `DataSource` via dependency injection:

```typescript
// Service constructor
constructor(private readonly dataSource: DataSource) {}

// In handler factory
export function createYourHandlers({ yourService }: { yourService: YourService }) {
  // ...
}

// Registered in container
container.register({
  yourService: asClass(YourService).scoped(),
});
```

The `DataSource` is automatically injected by Awilix from the container's cradle.

## Repository Pattern

Always use repositories, not direct queries:

```typescript
// ✅ Good - Type-safe, handles null checks
const repo = dataSource.getRepository(Entity);
const result = await repo.findOneBy({ id });

// ❌ Avoid - Raw queries bypass type safety
const result = await dataSource.query('SELECT * FROM entity WHERE id = ?', [id]);
```

### Common Repository Methods

```typescript
const repo = dataSource.getRepository(Entity);

// Find
await repo.findOneBy({ id });               // Single record or null
await repo.findOneOrFail({ where: { id } }); // Throws EntityNotFoundError
await repo.find({ where: { active: true } }); // Array of records
await repo.findAndCount({ take: 10, skip: 0 }); // Paginated [records, total]

// Create
const entity = repo.create({ name: 'foo' }); // Creates instance, doesn't save
await repo.save(entity);                     // Persists to database

// Update
await repo.update({ id }, { name: 'bar' });  // Update by criteria
entity.name = 'bar';
await repo.save(entity);                     // Save modified instance

// Delete
await repo.delete({ id });                   // Delete by criteria
await repo.remove(entity);                   // Delete instance
```

## Testing with Database

Tests should use an in-memory SQLite database or a separate test database file:

```typescript
// server/__tests__/yourService.test.ts
import { DataSource } from 'typeorm';
import { YourEntity } from '@server/database/entities/YourEntity';
import { YourService } from '@server/services/yourService';

describe('YourService', () => {
  let dataSource: DataSource;
  let service: YourService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [YourEntity],
      synchronize: true, // OK for tests
      logging: false,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    service = new YourService(dataSource);
    await dataSource.synchronize(true); // Drop and recreate schema
  });

  it('creates an entity', async () => {
    const result = await service.create({ name: 'test' });
    expect(result.id).toBeDefined();
    expect(result.name).toBe('test');
  });
});
```

## Troubleshooting

### Database Locked Errors

SQLite doesn't handle concurrent writes well. If you see "database is locked":
- Ensure only one server instance is running
- Check for orphaned processes holding the DB file open
- Consider adding `busyTimeout: 5000` to DataSource options

### Migration Generation Issues

TypeORM's migration generation requires:
- Entities are properly decorated with `@Entity()`, `@Column()`, etc.
- The DataSource is correctly configured
- No syntax errors in entity files

If generation fails:
```bash
# Check TypeORM can load your entities
npx typeorm schema:log -d server/database/index.ts
```

### TypeScript Compilation in Migrations

Migrations are TypeScript files. Ensure `ts-node` is installed:
```bash
yarn add -D ts-node
```

## Adding the Database to the Container

The DataSource is registered as a singleton in the DI container:

```typescript
// server/container.ts
container.register({
  dataSource: asValue(dataSource), // Passed from startup
});
```

Services automatically receive it via constructor injection.
