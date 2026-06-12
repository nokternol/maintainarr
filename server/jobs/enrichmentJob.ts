import { eq } from 'drizzle-orm';
import type { DrizzleDb } from '../database';
import { mediaEnrichment, mediaIdentity } from '../database/schema';
import type { OverseerrIssue, OverseerrRequest } from '../providers/overseerrProvider';
import type { PlexMediaItem } from '../providers/plexProvider';
import type { TautulliHistoryItem } from '../providers/tautulliProvider';
import { type Token, mergeContributions } from '../utils/contributions';
import { mapOverseerr, mapPlexItems, mapTautulliHistory } from './enrichment/mappers';
import {
  type EnrichmentContribution,
  type EnrichmentKey,
  type EnrichmentValues,
  toEnrichmentValues,
} from './enrichment/types';

const STALENESS_SECONDS = 24 * 60 * 60;

interface Deps {
  db: DrizzleDb;
  tautulliProvider?: { getHistory(): Promise<TautulliHistoryItem[]> };
  overseerrProvider?: {
    getRequests(): Promise<OverseerrRequest[]>;
    getIssues(): Promise<OverseerrIssue[]>;
  };
  plexProvider?: { getAllItems(): Promise<PlexMediaItem[]> };
}

/**
 * Namespaced match tokens for an identity. Two records join when they share a token, so
 * each key dimension carries its own prefix — a `plexRatingKey` of "5" must never collide
 * with a `tmdbId` of 5.
 */
function identityTokens(identity: typeof mediaIdentity.$inferSelect): Token[] {
  const tokens: Token[] = [];
  if (identity.plexRatingKey != null) tokens.push(`plex:${identity.plexRatingKey}`);
  if (identity.tmdbId != null) tokens.push(`tmdb:${identity.tmdbId}`);
  return tokens;
}

/** The same namespaced tokens derived from a contribution's key dimensions. */
function keyTokens(key: EnrichmentKey): Token[] {
  const tokens: Token[] = [];
  if (key.plexRatingKey !== undefined) tokens.push(`plex:${key.plexRatingKey}`);
  if (key.tmdbId !== undefined) tokens.push(`tmdb:${key.tmdbId}`);
  return tokens;
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

    // ─── Collect contributions from every active bulk source (uniform) ────────
    const contributions = await this.collectBulkContributions();

    // ─── Merge into each identity by shared key — no per-provider branches ────
    const identities = toEnrich.map((r) => r.identity);
    const merged = mergeContributions<
      (typeof identities)[number],
      EnrichmentKey,
      Partial<EnrichmentValues>
    >(
      identities,
      contributions,
      identityTokens,
      keyTokens,
      (acc, next) => ({ ...acc, ...next }),
      () => ({})
    );
    const mergedById = new Map(merged.map((m) => [m.target.id, m.values]));

    // ─── Write rows ───────────────────────────────────────────────────────────
    for (const { identity, enrichment } of toEnrich) {
      // Materialize the merged partial into the canonical record (undefined → null).
      const values = toEnrichmentValues(mergedById.get(identity.id) ?? {});

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

  private async collectBulkContributions(): Promise<EnrichmentContribution[]> {
    const contributions: EnrichmentContribution[] = [];

    if (this.deps.tautulliProvider) {
      contributions.push(...mapTautulliHistory(await this.deps.tautulliProvider.getHistory()));
    }
    if (this.deps.plexProvider) {
      contributions.push(...mapPlexItems(await this.deps.plexProvider.getAllItems()));
    }
    if (this.deps.overseerrProvider) {
      const [requests, issues] = await Promise.all([
        this.deps.overseerrProvider.getRequests(),
        this.deps.overseerrProvider.getIssues(),
      ]);
      contributions.push(...mapOverseerr(requests, issues));
    }

    return contributions;
  }
}
