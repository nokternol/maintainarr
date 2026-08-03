CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`region` text,
	`primaryMediaServer` text DEFAULT 'PLEX' NOT NULL
);
