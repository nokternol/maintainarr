CREATE TABLE `metadata_provider` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`apiKey` text,
	`settings` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `IDX_metadata_provider_type` ON `metadata_provider` (`type`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expiredAt` integer NOT NULL,
	`json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `IDX_session_expiredAt` ON `sessions` (`expiredAt`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`plexUsername` text,
	`plexId` integer,
	`plexToken` text,
	`avatar` text,
	`userType` text DEFAULT 'plex' NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `IDX_user_email` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `IDX_user_plexId` ON `user` (`plexId`);