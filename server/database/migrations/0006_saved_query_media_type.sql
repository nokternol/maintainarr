ALTER TABLE `media_queries` ADD `mediaType` text NOT NULL DEFAULT 'movie';
--> statement-breakpoint
UPDATE `media_queries`
SET `mediaType` = 'series'
WHERE `id` IN (
  SELECT `queryId` FROM `automations`
  WHERE `queryId` IS NOT NULL
    AND `providerId` IN (
      SELECT `id` FROM `metadata_provider` WHERE `type` = 'SONARR'
    )
);
