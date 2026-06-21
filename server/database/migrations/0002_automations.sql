CREATE TABLE `automations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`queryId` integer NOT NULL,
	`providerId` integer NOT NULL,
	`taskId` text NOT NULL,
	`schedule` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`lastRunAt` text,
	`lastRunItemCount` integer,
	`lastRunStatus` text,
	`lastRunError` text,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`queryId`) REFERENCES `media_queries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`providerId`) REFERENCES `metadata_provider`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `IDX_automations_status` ON `automations` (`status`);--> statement-breakpoint
CREATE TABLE `media_queries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`filters` text NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
