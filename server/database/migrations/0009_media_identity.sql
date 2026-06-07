CREATE TABLE `media_identity` (
  `id`             INTEGER PRIMARY KEY AUTOINCREMENT,
  `sourceType`     TEXT NOT NULL,
  `sourceId`       INTEGER NOT NULL,
  `tmdbId`         INTEGER,
  `imdbId`         TEXT,
  `tvdbId`         INTEGER,
  `tvMazeId`       INTEGER,
  `plexRatingKey`  TEXT,
  `jellyfinItemId` TEXT,
  `resolvedAt`     INTEGER,
  UNIQUE(`sourceType`, `sourceId`)
);
--> statement-breakpoint
CREATE INDEX `idx_media_identity_tmdb` ON `media_identity`(`tmdbId`);
--> statement-breakpoint
CREATE INDEX `idx_media_identity_tvdb` ON `media_identity`(`tvdbId`);
--> statement-breakpoint
CREATE INDEX `idx_media_identity_imdb` ON `media_identity`(`imdbId`);
