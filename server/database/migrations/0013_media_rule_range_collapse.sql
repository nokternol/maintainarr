-- Phase 4 Stage 1 renamed/collapsed rule keys server-side (yearMin/yearMax and every
-- *Gte/*Lte pair -> one range-shaped key). Without this migration, already-persisted
-- `media_query_filter_values` rows under the old keys silently stop matching: `getRule()`
-- no longer resolves them, and the engine treats an unresolved key as an automatic pass
-- (`matchItems` -> `if (!rule) return true`), not a hard failure. That is a silent
-- correctness regression for every saved query/automation using a bounded filter, not
-- just a rename.
--
-- Each pair below collapses its rows into one row per `mediaQueryId` holding a JSON
-- `{ "min"?: number, "max"?: number }` value. The CASE/MAX branching (rather than
-- `json_set` with a bound SQL NULL) is deliberate: passing a NULL argument to
-- `json_set` writes a literal JSON `null` for that key on this driver, not omission —
-- and `{"max": null}` reads back as `max: null`, which fails `!== undefined` and lets
-- a numeric comparison against `null` (coerced to 0) silently reintroduce a bound that
-- was never set. Branching explicitly on which bound(s) exist avoids emitting the key
-- at all when absent.

-- yearMin / yearMax -> year
INSERT INTO `media_query_filter_values` (`mediaQueryId`, `filterKey`, `value`)
SELECT
  `mediaQueryId`,
  'year',
  CASE
    WHEN MAX(CASE WHEN `filterKey` = 'yearMin' THEN 1 END) IS NOT NULL AND MAX(CASE WHEN `filterKey` = 'yearMax' THEN 1 END) IS NOT NULL THEN json_object('min', MAX(CASE WHEN `filterKey` = 'yearMin' THEN CAST(`value` AS REAL) END), 'max', MAX(CASE WHEN `filterKey` = 'yearMax' THEN CAST(`value` AS REAL) END))
    WHEN MAX(CASE WHEN `filterKey` = 'yearMin' THEN 1 END) IS NOT NULL THEN json_object('min', MAX(CASE WHEN `filterKey` = 'yearMin' THEN CAST(`value` AS REAL) END))
    ELSE json_object('max', MAX(CASE WHEN `filterKey` = 'yearMax' THEN CAST(`value` AS REAL) END))
  END
FROM `media_query_filter_values`
WHERE `filterKey` IN ('yearMin', 'yearMax')
GROUP BY `mediaQueryId`;
--> statement-breakpoint
DELETE FROM `media_query_filter_values` WHERE `filterKey` IN ('yearMin', 'yearMax');
--> statement-breakpoint

-- addedDaysAgoGte / addedDaysAgoLte -> addedDaysAgo
INSERT INTO `media_query_filter_values` (`mediaQueryId`, `filterKey`, `value`)
SELECT
  `mediaQueryId`,
  'addedDaysAgo',
  CASE
    WHEN MAX(CASE WHEN `filterKey` = 'addedDaysAgoGte' THEN 1 END) IS NOT NULL AND MAX(CASE WHEN `filterKey` = 'addedDaysAgoLte' THEN 1 END) IS NOT NULL THEN json_object('min', MAX(CASE WHEN `filterKey` = 'addedDaysAgoGte' THEN CAST(`value` AS REAL) END), 'max', MAX(CASE WHEN `filterKey` = 'addedDaysAgoLte' THEN CAST(`value` AS REAL) END))
    WHEN MAX(CASE WHEN `filterKey` = 'addedDaysAgoGte' THEN 1 END) IS NOT NULL THEN json_object('min', MAX(CASE WHEN `filterKey` = 'addedDaysAgoGte' THEN CAST(`value` AS REAL) END))
    ELSE json_object('max', MAX(CASE WHEN `filterKey` = 'addedDaysAgoLte' THEN CAST(`value` AS REAL) END))
  END
FROM `media_query_filter_values`
WHERE `filterKey` IN ('addedDaysAgoGte', 'addedDaysAgoLte')
GROUP BY `mediaQueryId`;
--> statement-breakpoint
DELETE FROM `media_query_filter_values` WHERE `filterKey` IN ('addedDaysAgoGte', 'addedDaysAgoLte');
--> statement-breakpoint

-- sizeOnDiskGbGte / sizeOnDiskGbLte -> sizeOnDiskGb
INSERT INTO `media_query_filter_values` (`mediaQueryId`, `filterKey`, `value`)
SELECT
  `mediaQueryId`,
  'sizeOnDiskGb',
  CASE
    WHEN MAX(CASE WHEN `filterKey` = 'sizeOnDiskGbGte' THEN 1 END) IS NOT NULL AND MAX(CASE WHEN `filterKey` = 'sizeOnDiskGbLte' THEN 1 END) IS NOT NULL THEN json_object('min', MAX(CASE WHEN `filterKey` = 'sizeOnDiskGbGte' THEN CAST(`value` AS REAL) END), 'max', MAX(CASE WHEN `filterKey` = 'sizeOnDiskGbLte' THEN CAST(`value` AS REAL) END))
    WHEN MAX(CASE WHEN `filterKey` = 'sizeOnDiskGbGte' THEN 1 END) IS NOT NULL THEN json_object('min', MAX(CASE WHEN `filterKey` = 'sizeOnDiskGbGte' THEN CAST(`value` AS REAL) END))
    ELSE json_object('max', MAX(CASE WHEN `filterKey` = 'sizeOnDiskGbLte' THEN CAST(`value` AS REAL) END))
  END
FROM `media_query_filter_values`
WHERE `filterKey` IN ('sizeOnDiskGbGte', 'sizeOnDiskGbLte')
GROUP BY `mediaQueryId`;
--> statement-breakpoint
DELETE FROM `media_query_filter_values` WHERE `filterKey` IN ('sizeOnDiskGbGte', 'sizeOnDiskGbLte');
--> statement-breakpoint

-- imdbRatingGte / imdbRatingLte -> imdbRating
INSERT INTO `media_query_filter_values` (`mediaQueryId`, `filterKey`, `value`)
SELECT
  `mediaQueryId`,
  'imdbRating',
  CASE
    WHEN MAX(CASE WHEN `filterKey` = 'imdbRatingGte' THEN 1 END) IS NOT NULL AND MAX(CASE WHEN `filterKey` = 'imdbRatingLte' THEN 1 END) IS NOT NULL THEN json_object('min', MAX(CASE WHEN `filterKey` = 'imdbRatingGte' THEN CAST(`value` AS REAL) END), 'max', MAX(CASE WHEN `filterKey` = 'imdbRatingLte' THEN CAST(`value` AS REAL) END))
    WHEN MAX(CASE WHEN `filterKey` = 'imdbRatingGte' THEN 1 END) IS NOT NULL THEN json_object('min', MAX(CASE WHEN `filterKey` = 'imdbRatingGte' THEN CAST(`value` AS REAL) END))
    ELSE json_object('max', MAX(CASE WHEN `filterKey` = 'imdbRatingLte' THEN CAST(`value` AS REAL) END))
  END
FROM `media_query_filter_values`
WHERE `filterKey` IN ('imdbRatingGte', 'imdbRatingLte')
GROUP BY `mediaQueryId`;
--> statement-breakpoint
DELETE FROM `media_query_filter_values` WHERE `filterKey` IN ('imdbRatingGte', 'imdbRatingLte');
--> statement-breakpoint

-- communityRatingGte / communityRatingLte -> communityRating
INSERT INTO `media_query_filter_values` (`mediaQueryId`, `filterKey`, `value`)
SELECT
  `mediaQueryId`,
  'communityRating',
  CASE
    WHEN MAX(CASE WHEN `filterKey` = 'communityRatingGte' THEN 1 END) IS NOT NULL AND MAX(CASE WHEN `filterKey` = 'communityRatingLte' THEN 1 END) IS NOT NULL THEN json_object('min', MAX(CASE WHEN `filterKey` = 'communityRatingGte' THEN CAST(`value` AS REAL) END), 'max', MAX(CASE WHEN `filterKey` = 'communityRatingLte' THEN CAST(`value` AS REAL) END))
    WHEN MAX(CASE WHEN `filterKey` = 'communityRatingGte' THEN 1 END) IS NOT NULL THEN json_object('min', MAX(CASE WHEN `filterKey` = 'communityRatingGte' THEN CAST(`value` AS REAL) END))
    ELSE json_object('max', MAX(CASE WHEN `filterKey` = 'communityRatingLte' THEN CAST(`value` AS REAL) END))
  END
FROM `media_query_filter_values`
WHERE `filterKey` IN ('communityRatingGte', 'communityRatingLte')
GROUP BY `mediaQueryId`;
--> statement-breakpoint
DELETE FROM `media_query_filter_values` WHERE `filterKey` IN ('communityRatingGte', 'communityRatingLte');
--> statement-breakpoint

-- lastAiredDaysAgoGte / lastAiredDaysAgoLte -> lastAiredDaysAgo
INSERT INTO `media_query_filter_values` (`mediaQueryId`, `filterKey`, `value`)
SELECT
  `mediaQueryId`,
  'lastAiredDaysAgo',
  CASE
    WHEN MAX(CASE WHEN `filterKey` = 'lastAiredDaysAgoGte' THEN 1 END) IS NOT NULL AND MAX(CASE WHEN `filterKey` = 'lastAiredDaysAgoLte' THEN 1 END) IS NOT NULL THEN json_object('min', MAX(CASE WHEN `filterKey` = 'lastAiredDaysAgoGte' THEN CAST(`value` AS REAL) END), 'max', MAX(CASE WHEN `filterKey` = 'lastAiredDaysAgoLte' THEN CAST(`value` AS REAL) END))
    WHEN MAX(CASE WHEN `filterKey` = 'lastAiredDaysAgoGte' THEN 1 END) IS NOT NULL THEN json_object('min', MAX(CASE WHEN `filterKey` = 'lastAiredDaysAgoGte' THEN CAST(`value` AS REAL) END))
    ELSE json_object('max', MAX(CASE WHEN `filterKey` = 'lastAiredDaysAgoLte' THEN CAST(`value` AS REAL) END))
  END
FROM `media_query_filter_values`
WHERE `filterKey` IN ('lastAiredDaysAgoGte', 'lastAiredDaysAgoLte')
GROUP BY `mediaQueryId`;
--> statement-breakpoint
DELETE FROM `media_query_filter_values` WHERE `filterKey` IN ('lastAiredDaysAgoGte', 'lastAiredDaysAgoLte');
--> statement-breakpoint

-- episodePercentageGte / episodePercentageLte -> episodePercentage
INSERT INTO `media_query_filter_values` (`mediaQueryId`, `filterKey`, `value`)
SELECT
  `mediaQueryId`,
  'episodePercentage',
  CASE
    WHEN MAX(CASE WHEN `filterKey` = 'episodePercentageGte' THEN 1 END) IS NOT NULL AND MAX(CASE WHEN `filterKey` = 'episodePercentageLte' THEN 1 END) IS NOT NULL THEN json_object('min', MAX(CASE WHEN `filterKey` = 'episodePercentageGte' THEN CAST(`value` AS REAL) END), 'max', MAX(CASE WHEN `filterKey` = 'episodePercentageLte' THEN CAST(`value` AS REAL) END))
    WHEN MAX(CASE WHEN `filterKey` = 'episodePercentageGte' THEN 1 END) IS NOT NULL THEN json_object('min', MAX(CASE WHEN `filterKey` = 'episodePercentageGte' THEN CAST(`value` AS REAL) END))
    ELSE json_object('max', MAX(CASE WHEN `filterKey` = 'episodePercentageLte' THEN CAST(`value` AS REAL) END))
  END
FROM `media_query_filter_values`
WHERE `filterKey` IN ('episodePercentageGte', 'episodePercentageLte')
GROUP BY `mediaQueryId`;
--> statement-breakpoint
DELETE FROM `media_query_filter_values` WHERE `filterKey` IN ('episodePercentageGte', 'episodePercentageLte');
--> statement-breakpoint

-- lastWatchedDaysAgoGte / lastWatchedDaysAgoLte -> lastWatchedDaysAgo
INSERT INTO `media_query_filter_values` (`mediaQueryId`, `filterKey`, `value`)
SELECT
  `mediaQueryId`,
  'lastWatchedDaysAgo',
  CASE
    WHEN MAX(CASE WHEN `filterKey` = 'lastWatchedDaysAgoGte' THEN 1 END) IS NOT NULL AND MAX(CASE WHEN `filterKey` = 'lastWatchedDaysAgoLte' THEN 1 END) IS NOT NULL THEN json_object('min', MAX(CASE WHEN `filterKey` = 'lastWatchedDaysAgoGte' THEN CAST(`value` AS REAL) END), 'max', MAX(CASE WHEN `filterKey` = 'lastWatchedDaysAgoLte' THEN CAST(`value` AS REAL) END))
    WHEN MAX(CASE WHEN `filterKey` = 'lastWatchedDaysAgoGte' THEN 1 END) IS NOT NULL THEN json_object('min', MAX(CASE WHEN `filterKey` = 'lastWatchedDaysAgoGte' THEN CAST(`value` AS REAL) END))
    ELSE json_object('max', MAX(CASE WHEN `filterKey` = 'lastWatchedDaysAgoLte' THEN CAST(`value` AS REAL) END))
  END
FROM `media_query_filter_values`
WHERE `filterKey` IN ('lastWatchedDaysAgoGte', 'lastWatchedDaysAgoLte')
GROUP BY `mediaQueryId`;
--> statement-breakpoint
DELETE FROM `media_query_filter_values` WHERE `filterKey` IN ('lastWatchedDaysAgoGte', 'lastWatchedDaysAgoLte');
