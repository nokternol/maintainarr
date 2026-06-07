import { eq } from 'drizzle-orm';
import type { DrizzleDb } from '../database';
import { mediaEnrichment, mediaIdentity } from '../database/schema';
import type { TautulliHistoryItem } from '../providers/tautulliProvider';

const STALENESS_SECONDS = 24 * 60 * 60;

interface Deps {
  db: DrizzleDb;
  tautulliProvider?: { getHistory(): Promise<TautulliHistoryItem[]> };
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

    if (this.deps.tautulliProvider) {
      const history = await this.deps.tautulliProvider.getHistory();
      const playCountByKey = new Map<string, number>();
      for (const item of history) {
        playCountByKey.set(item.rating_key, (playCountByKey.get(item.rating_key) ?? 0) + 1);
      }

      for (const { identity, enrichment } of toEnrich) {
        if (!identity.plexRatingKey) continue;
        const playCount = playCountByKey.get(identity.plexRatingKey) ?? 0;

        if (enrichment) {
          await this.deps.db
            .update(mediaEnrichment)
            .set({ tautulliPlayCount: playCount, enrichedAt: now })
            .where(eq(mediaEnrichment.mediaIdentityId, identity.id));
        } else {
          await this.deps.db
            .insert(mediaEnrichment)
            .values({ mediaIdentityId: identity.id, tautulliPlayCount: playCount, enrichedAt: now });
        }
      }
    }
  }
}
