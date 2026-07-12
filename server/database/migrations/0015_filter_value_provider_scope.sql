-- Instance-qualification for provider-defined id-space filter values (quality profiles,
-- tags). Null means unqualified (today's semantics, unchanged for every existing row).
ALTER TABLE `media_query_filter_values` ADD COLUMN `providerId` INTEGER REFERENCES `metadata_provider`(`id`) ON DELETE SET NULL;
