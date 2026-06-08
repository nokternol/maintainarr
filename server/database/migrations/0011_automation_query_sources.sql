-- 1. Create join table
CREATE TABLE `automation_query_sources` (
  `id`           INTEGER PRIMARY KEY AUTOINCREMENT,
  `automationId` INTEGER NOT NULL REFERENCES `automations`(`id`) ON DELETE CASCADE,
  `queryId`      INTEGER NOT NULL REFERENCES `saved_queries`(`id`) ON DELETE CASCADE,
  `role`         TEXT NOT NULL CHECK(`role` IN ('include', 'exclude')),
  `sortOrder`    INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX `IDX_aqsources_automationId` ON `automation_query_sources`(`automationId`);
--> statement-breakpoint

-- 2. Backfill: each existing automation's single queryId becomes an include row
INSERT INTO `automation_query_sources` (`automationId`, `queryId`, `role`, `sortOrder`)
SELECT `id`, `queryId`, 'include', 0
FROM `automations`
WHERE `queryId` IS NOT NULL;
--> statement-breakpoint

-- 3. Drop queryId from automations (SQLite requires recreate)
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `automations_new` (
  `id`               INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name`             TEXT NOT NULL,
  `providerId`       INTEGER REFERENCES `metadata_provider`(`id`) ON DELETE CASCADE,
  `taskId`           TEXT NOT NULL,
  `schedule`         TEXT NOT NULL,
  `kind`             TEXT NOT NULL DEFAULT 'user',
  `status`           TEXT NOT NULL DEFAULT 'active',
  `lastRunAt`        TEXT,
  `lastRunItemCount` INTEGER,
  `lastRunStatus`    TEXT,
  `lastRunError`     TEXT,
  `createdAt`        TEXT DEFAULT (datetime('now')) NOT NULL,
  `updatedAt`        TEXT DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `automations_new`
  SELECT `id`,`name`,`providerId`,`taskId`,`schedule`,`kind`,`status`,
         `lastRunAt`,`lastRunItemCount`,`lastRunStatus`,`lastRunError`,
         `createdAt`,`updatedAt`
  FROM `automations`;
--> statement-breakpoint
DROP TABLE `automations`;
--> statement-breakpoint
ALTER TABLE `automations_new` RENAME TO `automations`;
--> statement-breakpoint
CREATE INDEX `IDX_automations_status` ON `automations`(`status`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
