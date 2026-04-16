CREATE TABLE `groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`filter_criteria` text NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_enrichment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_type` text NOT NULL,
	`tmdb_id` integer,
	`tvdb_id` integer,
	`imdb_id` text,
	`certification` text,
	`collection_id` integer,
	`collection_name` text,
	`keywords` text,
	`spoken_languages` text,
	`origin_country` text,
	`streaming_services` text,
	`award_winner` integer,
	`oscar_winner` integer,
	`director` text,
	`actors` text,
	`box_office` integer,
	`enriched_at` text,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UQ_enrichment_movie` ON `media_enrichment` (`media_type`,`tmdb_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `UQ_enrichment_series` ON `media_enrichment` (`media_type`,`tvdb_id`);--> statement-breakpoint
CREATE TABLE `rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`action_type` text NOT NULL,
	`action_params` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
