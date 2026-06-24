-- Collapse media_enrichment provider-shaped columns into resolved canonical columns.
-- Precedence is resolved at write time by the enrichment job, so storage holds the
-- already-resolved canonical value rather than provider columns side by side.
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `media_enrichment_new` (
  `id`                     INTEGER PRIMARY KEY AUTOINCREMENT,
  `mediaIdentityId`        INTEGER NOT NULL REFERENCES `media_identity`(`id`) ON DELETE CASCADE,
  `playCount`              INTEGER,
  `lastWatchedAt`          TEXT,
  `overseerrRequestStatus` INTEGER,
  `overseerrHasIssue`      INTEGER,
  `tmdbStatus`             TEXT,
  `enrichedAt`             INTEGER
);
--> statement-breakpoint
INSERT INTO `media_enrichment_new`
  (`id`, `mediaIdentityId`, `playCount`, `lastWatchedAt`,
   `overseerrRequestStatus`, `overseerrHasIssue`, `tmdbStatus`, `enrichedAt`)
SELECT
  `id`,
  `mediaIdentityId`,
  COALESCE(`tautulliPlayCount`, `plexViewCount`),
  CASE
    WHEN COALESCE(`tautulliLastPlayed`, `plexLastViewedAt`) IS NOT NULL
      THEN strftime('%Y-%m-%dT%H:%M:%S.000Z', COALESCE(`tautulliLastPlayed`, `plexLastViewedAt`), 'unixepoch')
    ELSE NULL
  END,
  `overseerrRequestStatus`,
  `overseerrHasIssue`,
  `tmdbStatus`,
  `enrichedAt`
FROM `media_enrichment`;
--> statement-breakpoint
DROP TABLE `media_enrichment`;
--> statement-breakpoint
ALTER TABLE `media_enrichment_new` RENAME TO `media_enrichment`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_media_enrichment_identity` ON `media_enrichment`(`mediaIdentityId`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
