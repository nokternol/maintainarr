import { and, eq, gt, inArray, lt } from 'drizzle-orm';
import session from 'express-session';
import type { DrizzleDb } from './index';
import { sessions } from './schema';

interface DrizzleStoreOptions {
  db: DrizzleDb;
  /** Session time-to-live in seconds. Used when the session cookie has no maxAge. Default: 86400 (1 day). */
  ttl?: number;
  /** Number of expired sessions to purge per `set` call. 0 disables cleanup. Default: 2. */
  cleanupLimit?: number;
}

export class DrizzleStore extends session.Store {
  private readonly db: DrizzleDb;
  private readonly ttl: number;
  private readonly cleanupLimit: number;

  constructor({ db, ttl = 86400, cleanupLimit = 2 }: DrizzleStoreOptions) {
    super();
    this.db = db;
    this.ttl = ttl;
    this.cleanupLimit = cleanupLimit;
  }

  /** Retrieve a session by id. Returns null if not found or expired. */
  get(sid: string, callback: (err: unknown, session?: Express.SessionData | null) => void): void {
    this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sid), gt(sessions.expiredAt, Date.now())))
      .then((rows) => {
        const row = rows[0];
        callback(null, row ? (JSON.parse(row.json) as Express.SessionData) : null);
      })
      .catch((err) => callback(err));
  }

  /** Persist (or overwrite) a session. */
  set(sid: string, session: Express.SessionData, callback?: (err?: unknown) => void): void {
    const maxAge = session.cookie?.maxAge;
    const ttlMs = typeof maxAge === 'number' ? maxAge : this.ttl * 1000;
    const expiredAt = Date.now() + ttlMs;
    const json = JSON.stringify(session);

    this.db
      .insert(sessions)
      .values({ id: sid, expiredAt, json })
      .onConflictDoUpdate({ target: sessions.id, set: { expiredAt, json } })
      .then(() => this.purgeExpired())
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }

  /** Remove a session. */
  destroy(sid: string, callback?: (err?: unknown) => void): void {
    this.db
      .delete(sessions)
      .where(eq(sessions.id, sid))
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }

  /** Refresh the expiry of an existing session without changing its data. */
  touch(sid: string, session: Express.SessionData, callback?: (err?: unknown) => void): void {
    const maxAge = session.cookie?.maxAge;
    const ttlMs = typeof maxAge === 'number' ? maxAge : this.ttl * 1000;
    const expiredAt = Date.now() + ttlMs;

    this.db
      .update(sessions)
      .set({ expiredAt })
      .where(eq(sessions.id, sid))
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }

  /** Delete a small batch of expired sessions. Called on every `set`. */
  private async purgeExpired(): Promise<void> {
    if (this.cleanupLimit <= 0) return;

    const expired = await this.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(lt(sessions.expiredAt, Date.now()))
      .limit(this.cleanupLimit);

    if (expired.length === 0) return;

    await this.db.delete(sessions).where(
      inArray(
        sessions.id,
        expired.map((r) => r.id)
      )
    );
  }
}
