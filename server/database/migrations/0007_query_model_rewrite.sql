ALTER TABLE `saved_queries` RENAME COLUMN `mediaType` TO `contentType`;
--> statement-breakpoint
UPDATE `saved_queries` SET `contentType` = 'show' WHERE `contentType` = 'series';
--> statement-breakpoint
CREATE TABLE `saved_query_filter_values` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `savedQueryId` INTEGER NOT NULL REFERENCES `saved_queries`(`id`) ON DELETE CASCADE,
  `filterKey` TEXT NOT NULL,
  `value` TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX `IDX_sqfv_queryId` ON `saved_query_filter_values`(`savedQueryId`);
--> statement-breakpoint
INSERT INTO `saved_query_filter_values` (`savedQueryId`, `filterKey`, `value`)
SELECT
  sq.`id`,
  CASE kv.`key`
    WHEN 'tautulliWatched'           THEN 'watched'
    WHEN 'movieTagIds'               THEN 'tagIds'
    WHEN 'movieQualityProfileIds'    THEN 'qualityProfileIds'
    WHEN 'movieGenres'               THEN 'genres'
    WHEN 'radarrImdbRatingGte'       THEN 'imdbRatingGte'
    WHEN 'radarrImdbRatingLte'       THEN 'imdbRatingLte'
    WHEN 'seriesTagIds'              THEN 'tagIds'
    WHEN 'seriesQualityProfileIds'   THEN 'qualityProfileIds'
    WHEN 'seriesGenres'              THEN 'genres'
    WHEN 'sonarrRatingGte'           THEN 'communityRatingGte'
    WHEN 'sonarrRatingLte'           THEN 'communityRatingLte'
    WHEN 'sonarrEnded'               THEN 'ended'
    WHEN 'sonarrLastAiredDaysAgoGte' THEN 'lastAiredDaysAgoGte'
    WHEN 'sonarrLastAiredDaysAgoLte' THEN 'lastAiredDaysAgoLte'
    WHEN 'sonarrPercentEpisodesGte'  THEN 'episodePercentageGte'
    WHEN 'sonarrPercentEpisodesLte'  THEN 'episodePercentageLte'
    ELSE kv.`key`
  END,
  kv.`value`
FROM `saved_queries` sq,
  json_each(sq.`filters`) AS kv
WHERE sq.`filters` IS NOT NULL
  AND sq.`filters` != ''
  AND sq.`filters` != '{}';
--> statement-breakpoint
ALTER TABLE `saved_queries` DROP COLUMN `filters`;
