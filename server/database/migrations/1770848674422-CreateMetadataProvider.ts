import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMetadataProvider1770848674422 implements MigrationInterface {
  name = 'CreateMetadataProvider1770848674422';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "metadata_provider" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "type" varchar NOT NULL,
        "name" varchar NOT NULL,
        "url" varchar NOT NULL,
        "apiKey" varchar,
        "settings" text,
        "isActive" boolean NOT NULL DEFAULT (1),
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_metadata_provider_type" ON "metadata_provider" ("type")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_metadata_provider_type"`);
    await queryRunner.query(`DROP TABLE "metadata_provider"`);
  }
}
