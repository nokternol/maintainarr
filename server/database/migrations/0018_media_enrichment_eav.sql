CREATE TABLE `enrichment_field` (
  `id`  INTEGER PRIMARY KEY AUTOINCREMENT,
  `key` TEXT NOT NULL UNIQUE
);
--> statement-breakpoint
INSERT INTO `enrichment_field` (`key`) VALUES
  ('playCount'),
  ('lastWatchedAt'),
  ('overseerrRequestStatus'),
  ('overseerrHasIssue'),
  ('tmdbStatus'),
  ('plexAddedAt');
--> statement-breakpoint
DROP TABLE IF EXISTS `media_enrichment`;
--> statement-breakpoint
CREATE TABLE `media_enrichment` (
  `id`               INTEGER PRIMARY KEY AUTOINCREMENT,
  `mediaIdentityId`  INTEGER NOT NULL REFERENCES `media_identity`(`id`) ON DELETE CASCADE,
  `fieldId`          INTEGER NOT NULL REFERENCES `enrichment_field`(`id`) ON DELETE CASCADE,
  `value`            TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_media_enrichment_identity_field` ON `media_enrichment`(`mediaIdentityId`, `fieldId`);
--> statement-breakpoint
ALTER TABLE `media_identity` ADD COLUMN `enrichedAt` INTEGER;
