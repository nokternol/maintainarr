import { eq } from 'drizzle-orm';
import { appSettings } from '../../database/schema';
import type { DrizzleDb } from '../../kernel/db';

export interface AppSettingsValue {
  region: string | null;
  primaryMediaServer: 'PLEX' | 'JELLYFIN';
}

export class AppSettingsService {
  private readonly db: DrizzleDb;

  constructor({ db }: { db: DrizzleDb }) {
    this.db = db;
  }

  async get(): Promise<AppSettingsValue> {
    const row = await this.getRow();
    if (!row) return { region: null, primaryMediaServer: 'PLEX' };
    return {
      region: row.region,
      primaryMediaServer: row.primaryMediaServer as AppSettingsValue['primaryMediaServer'],
    };
  }

  async update(patch: Partial<AppSettingsValue>): Promise<AppSettingsValue> {
    const current = await this.getRow();
    if (!current) {
      await this.db.insert(appSettings).values({
        region: patch.region ?? null,
        primaryMediaServer: patch.primaryMediaServer ?? 'PLEX',
      });
    } else {
      await this.db
        .update(appSettings)
        .set({
          region: patch.region ?? current.region,
          primaryMediaServer: patch.primaryMediaServer ?? current.primaryMediaServer,
        })
        .where(eq(appSettings.id, current.id));
    }
    return this.get();
  }

  private async getRow() {
    const [row] = await this.db.select().from(appSettings);
    return row;
  }
}
