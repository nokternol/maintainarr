-- Recreate automations to make queryId and providerId nullable.
-- System automations (kind='system') have no query or provider.
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `automations_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`queryId` integer,
	`providerId` integer,
	`taskId` text NOT NULL,
	`schedule` text NOT NULL,
	`kind` text NOT NULL DEFAULT 'user',
	`status` text DEFAULT 'active' NOT NULL,
	`lastRunAt` text,
	`lastRunItemCount` integer,
	`lastRunStatus` text,
	`lastRunError` text,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`queryId`) REFERENCES `saved_queries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`providerId`) REFERENCES `metadata_provider`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `automations_new` SELECT `id`,`name`,`queryId`,`providerId`,`taskId`,`schedule`,`kind`,`status`,`lastRunAt`,`lastRunItemCount`,`lastRunStatus`,`lastRunError`,`createdAt`,`updatedAt` FROM `automations`;
--> statement-breakpoint
DROP TABLE `automations`;
--> statement-breakpoint
ALTER TABLE `automations_new` RENAME TO `automations`;
--> statement-breakpoint
CREATE INDEX `IDX_automations_status` ON `automations` (`status`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
