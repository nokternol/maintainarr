import { eq } from 'drizzle-orm';
import type { DrizzleDb } from '../database';
import { mediaEnrichment, mediaIdentity } from '../database/schema';
import type { OverseerrIssue, OverseerrRequest } from '../providers/overseerrProvider';
import type { PlexMediaItem } from '../providers/plexProvider';
import type { TautulliHistoryItem } from '../providers/tautulliProvider';

const STALENESS_SECONDS = 24 * 60 * 60;

interface Deps {
  db: DrizzleDb;
  tautulliProvider?: { getHistory(): Promise<TautulliHistoryItem[]> };
  overseerrProvider?: {
    getRequests(): Promise<OverseerrRequest[]>;
    getIssues(): Promise<OverseerrIssue[]>;
  };
  plexProvider?: { getAllItems(): Promise<PlexMediaItem[]> };
  tmdbProvider?: { getStatus(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<string | null> };
}

interface EnrichmentValues {
  tautulliPlayCount?: number;
  tautulliLastPlayed?: number | null;
  overseerrRequestStatus?: number | null;
  overseerrHasIssue?: boolean | null;
  plexViewCount?: number | null;
  plexLastViewedAt?: number | null;
  tmdbStatus?: string | null;
}

export class EnrichmentJob {
  constructor(private deps: Deps) {}

  async run(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const staleThreshold = now - STALENESS_SECONDS;

    const rows = await this.deps.db
      .select({ identity: mediaIdentity, enrichment: mediaEnrichment })
      .from(mediaIdentity)
      .leftJoin(mediaEnrichment, eq(mediaEnrichment.mediaIdentityId, mediaIdentity.id));

    const toEnrich = rows.filter(
      ({ enrichment }) => !enrichment || (enrichment.enrichedAt ?? 0) < staleThreshold
    );

    if (toEnrich.length === 0) return;

    // ─── Collect tautulli values ─────────────────────────────────────────────
    const playCountByKey = new Map<string, number>();
    const lastPlayedByKey = new Map<string, number>();
    if (this.deps.tautulliProvider) {
      const history = await this.deps.tautulliProvider.getHistory();
      for (const item of history) {
        playCountByKey.set(item.rating_key, (playCountByKey.get(item.rating_key) ?? 0) + 1);
        if (item.played_at !== undefined) {
          const current = lastPlayedByKey.get(item.rating_key) ?? 0;
          if (item.played_at > current) lastPlayedByKey.set(item.rating_key, item.played_at);
        }
      }
    }

    // ─── Collect overseerr values ────────────────────────────────────────────
    const overseerrStatusByTmdbId = new Map<number, number>();
    const tmdbIdsWithIssues = new Set<number>();
    if (this.deps.overseerrProvider) {
      const [requests, issues] = await Promise.all([
        this.deps.overseerrProvider.getRequests(),
        this.deps.overseerrProvider.getIssues(),
      ]);
      for (const req of requests) {
        overseerrStatusByTmdbId.set(req.media.tmdbId, req.status);
      }
      for (const issue of issues) {
        tmdbIdsWithIssues.add(issue.media.tmdbId);
      }
    }

    // ─── Collect Plex values ─────────────────────────────────────────────────
    const plexViewCountByKey = new Map<string, number>();
    const plexLastViewedAtByKey = new Map<string, number>();
    if (this.deps.plexProvider) {
      const items = await this.deps.plexProvider.getAllItems();
      for (const item of items) {
        if (item.viewCount !== undefined) plexViewCountByKey.set(item.ratingKey, item.viewCount);
        if (item.lastViewedAt !== undefined)
          plexLastViewedAtByKey.set(item.ratingKey, item.lastViewedAt);
      }
    }

    // ─── Write enrichment rows ───────────────────────────────────────────────
    for (const { identity, enrichment } of toEnrich) {
      const values: EnrichmentValues = {};

      if (this.deps.tautulliProvider && identity.plexRatingKey) {
        values.tautulliPlayCount = playCountByKey.get(identity.plexRatingKey) ?? 0;
        values.tautulliLastPlayed = lastPlayedByKey.get(identity.plexRatingKey) ?? null;
      }

      if (this.deps.plexProvider && identity.plexRatingKey) {
        values.plexViewCount = plexViewCountByKey.get(identity.plexRatingKey) ?? null;
        values.plexLastViewedAt = plexLastViewedAtByKey.get(identity.plexRatingKey) ?? null;
      }

      if (this.deps.tmdbProvider && identity.tmdbId !== null) {
        const mediaType = identity.sourceType === 'SONARR' ? 'tv' : 'movie';
        values.tmdbStatus = await this.deps.tmdbProvider.getStatus(identity.tmdbId, mediaType);
      }

      if (this.deps.overseerrProvider && identity.tmdbId !== null) {
        values.overseerrRequestStatus = overseerrStatusByTmdbId.get(identity.tmdbId) ?? null;
        values.overseerrHasIssue = tmdbIdsWithIssues.has(identity.tmdbId);
      }

      if (enrichment) {
        await this.deps.db
          .update(mediaEnrichment)
          .set({ ...values, enrichedAt: now })
          .where(eq(mediaEnrichment.mediaIdentityId, identity.id));
      } else {
        await this.deps.db
          .insert(mediaEnrichment)
          .values({ mediaIdentityId: identity.id, ...values, enrichedAt: now });
      }
    }
  }
}
