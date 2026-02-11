import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserAndSession1770848674421 implements MigrationInterface {
  name = 'CreateUserAndSession1770848674421';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "email" varchar NOT NULL,
        "plexUsername" varchar,
        "plexId" integer,
        "plexToken" varchar,
        "avatar" varchar,
        "userType" text NOT NULL DEFAULT 'plex',
        "isActive" boolean NOT NULL DEFAULT (1),
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "UQ_user_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_user_email" ON "user" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_plexId" ON "user" ("plexId")`);

    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" varchar(255) PRIMARY KEY NOT NULL,
        "expiredAt" bigint NOT NULL,
        "json" text NOT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_session_expiredAt" ON "sessions" ("expiredAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_session_expiredAt"`);
    await queryRunner.query(`DROP TABLE "sessions"`);
    await queryRunner.query(`DROP INDEX "IDX_user_plexId"`);
    await queryRunner.query(`DROP INDEX "IDX_user_email"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}
