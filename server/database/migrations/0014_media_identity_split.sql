-- Splits `media_identity` into the group (`media_identity`, no per-source coordinate) and
-- one row per concrete source copy (`media_item`, keyed `(providerId, externalId)`). Table
-- rebuild rather than in-place ALTERs so the per-kind partial-unique indexes can be created
-- cleanly; `media_identity.id` values are preserved so `media_enrichment` rows survive.
--
-- Rows whose owning type has no active provider instance cannot be attributed to a
-- `providerId` without guessing, so they (and their enrichment) are dropped here; the
-- identity job recreates them the moment the instance is active again. Cache-shaped data
-- may be rebuilt, never guessed.
CREATE TABLE `media_item` (
  `id`             INTEGER PRIMARY KEY AUTOINCREMENT,
  `providerId`     INTEGER NOT NULL REFERENCES `metadata_provider`(`id`) ON DELETE CASCADE,
  `externalId`     INTEGER NOT NULL,
  `mediaIdentityId` INTEGER NOT NULL REFERENCES `media_identity`(`id`) ON DELETE CASCADE,
  `resolvedAt`     INTEGER
);
--> statement-breakpoint
CREATE TABLE `media_identity_new` (
  `id`             INTEGER PRIMARY KEY AUTOINCREMENT,
  `kind`           TEXT NOT NULL,
  `tmdbId`         INTEGER,
  `imdbId`         TEXT,
  `tvdbId`         INTEGER,
  `tvMazeId`       INTEGER,
  `plexRatingKey`  TEXT,
  `jellyfinItemId` TEXT,
  `title`          TEXT,
  `year`           INTEGER,
  `resolvedAt`     INTEGER
);
--> statement-breakpoint
INSERT INTO `media_identity_new`
  (`id`, `kind`, `tmdbId`, `imdbId`, `tvdbId`, `tvMazeId`, `plexRatingKey`, `jellyfinItemId`, `resolvedAt`)
SELECT `id`,
       CASE `sourceType` WHEN 'RADARR' THEN 'movie' ELSE 'show' END,
       `tmdbId`, `imdbId`, `tvdbId`, `tvMazeId`, `plexRatingKey`, `jellyfinItemId`, `resolvedAt`
FROM `media_identity`
WHERE EXISTS (
  SELECT 1 FROM `metadata_provider` p WHERE p.`type` = `media_identity`.`sourceType` AND p.`isActive` = 1
);
--> statement-breakpoint
INSERT INTO `media_item` (`providerId`, `externalId`, `mediaIdentityId`, `resolvedAt`)
SELECT (SELECT p.`id` FROM `metadata_provider` p
        WHERE p.`type` = mi.`sourceType` AND p.`isActive` = 1 LIMIT 1),
       mi.`sourceId`, mi.`id`, mi.`resolvedAt`
FROM `media_identity` mi
WHERE EXISTS (
  SELECT 1 FROM `metadata_provider` p WHERE p.`type` = mi.`sourceType` AND p.`isActive` = 1
);
--> statement-breakpoint
DELETE FROM `media_enrichment`
WHERE `mediaIdentityId` NOT IN (SELECT `id` FROM `media_identity_new`);
--> statement-breakpoint
UPDATE `media_identity_new`
SET `tmdbId` = NULL
WHERE `tmdbId` IS NOT NULL
  AND `id` NOT IN (
    SELECT MIN(`id`) FROM `media_identity_new` WHERE `tmdbId` IS NOT NULL GROUP BY `kind`, `tmdbId`
  );
--> statement-breakpoint
UPDATE `media_identity_new`
SET `tvdbId` = NULL
WHERE `tvdbId` IS NOT NULL
  AND `id` NOT IN (
    SELECT MIN(`id`) FROM `media_identity_new` WHERE `tvdbId` IS NOT NULL GROUP BY `kind`, `tvdbId`
  );
--> statement-breakpoint
DROP TABLE `media_identity`;
--> statement-breakpoint
ALTER TABLE `media_identity_new` RENAME TO `media_identity`;
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_media_identity_movie_tmdb` ON `media_identity`(`tmdbId`) WHERE `kind` = 'movie' AND `tmdbId` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_media_identity_show_tvdb` ON `media_identity`(`tvdbId`) WHERE `kind` = 'show' AND `tvdbId` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_media_identity_tmdb` ON `media_identity`(`tmdbId`);
--> statement-breakpoint
CREATE INDEX `idx_media_identity_tvdb` ON `media_identity`(`tvdbId`);
--> statement-breakpoint
CREATE INDEX `idx_media_identity_imdb` ON `media_identity`(`imdbId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_media_item_provider_external` ON `media_item`(`providerId`, `externalId`);
--> statement-breakpoint
CREATE INDEX `idx_media_item_identity` ON `media_item`(`mediaIdentityId`);
