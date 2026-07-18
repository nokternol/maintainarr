/**
 * The browse-path range-rule key contract, by content type — deliberately zero
 * imports. This is the one file in `media` safe for the client to import a type
 * from directly: importing a type from any other module file (even type-only)
 * forces the type-checker to resolve that file's whole transitive import graph,
 * which for `filterRegistry.ts` reaches `container.ts`'s Express-specific type
 * augmentations and breaks the Next.js build (verified — not a hypothetical).
 *
 * Hand-authored, not derived from `MEDIA_RULES`, for exactly that reason — but not
 * free-floating: `filterRegistry.ts`'s `assertBrowseRangeKeysMatch` (checked at
 * that file's own compile time, server-side only, no boundary risk) fails to
 * compile if these lists and `MEDIA_RULES`' actual range-dataType rules disagree
 * in either direction, so this file can't silently drift from the registry.
 */
export type MovieRangeRuleKey =
  | 'year'
  | 'addedDaysAgo'
  | 'plexAddedDaysAgo'
  | 'sizeOnDiskGb'
  | 'imdbRating'
  | 'lastWatchedDaysAgo';

export type ShowRangeRuleKey =
  | 'year'
  | 'addedDaysAgo'
  | 'plexAddedDaysAgo'
  | 'sizeOnDiskGb'
  | 'communityRating'
  | 'lastAiredDaysAgo'
  | 'episodePercentage'
  | 'lastWatchedDaysAgo';
