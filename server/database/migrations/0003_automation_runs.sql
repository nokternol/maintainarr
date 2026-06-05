CREATE TABLE `automation_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`automationId` integer NOT NULL,
	`ranAt` text DEFAULT (datetime('now')) NOT NULL,
	`status` text NOT NULL,
	`itemCount` integer,
	`error` text,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`automationId`) REFERENCES `automations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `IDX_automation_runs_automationId` ON `automation_runs` (`automationId`);
