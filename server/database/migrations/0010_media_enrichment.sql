CREATE TABLE `media_enrichment` (
  `id`                     INTEGER PRIMARY KEY AUTOINCREMENT,
  `mediaIdentityId`        INTEGER NOT NULL REFERENCES `media_identity`(`id`) ON DELETE CASCADE,
  `tautulliPlayCount`      INTEGER,
  `tautulliLastPlayed`     INTEGER,
  `plexViewCount`          INTEGER,
  `plexLastViewedAt`       INTEGER,
  `overseerrRequestStatus` INTEGER,
  `overseerrHasIssue`      INTEGER,
  `tmdbStatus`             TEXT,
  `enrichedAt`             INTEGER
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_media_enrichment_identity` ON `media_enrichment`(`mediaIdentityId`);
