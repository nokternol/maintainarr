ALTER TABLE `media_queries` RENAME COLUMN `mediaType` TO `contentType`;
--> statement-breakpoint
UPDATE `media_queries` SET `contentType` = 'show' WHERE `contentType` = 'series';
--> statement-breakpoint
CREATE TABLE `media_query_filter_values` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `mediaQueryId` INTEGER NOT NULL REFERENCES `media_queries`(`id`) ON DELETE CASCADE,
  `filterKey` TEXT NOT NULL,
  `value` TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX `IDX_mqfv_queryId` ON `media_query_filter_values`(`mediaQueryId`);
--> statement-breakpoint
INSERT INTO `media_query_filter_values` (`mediaQueryId`, `filterKey`, `value`)
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
FROM `media_queries` sq,
  json_each(sq.`filters`) AS kv
WHERE sq.`filters` IS NOT NULL
  AND sq.`filters` != ''
  AND sq.`filters` != '{}';
--> statement-breakpoint
ALTER TABLE `media_queries` DROP COLUMN `filters`;
