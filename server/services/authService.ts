import { and, eq, or } from 'drizzle-orm';
import type { DrizzleDb } from '../database';
import { type PublicUser, UserType, users } from '../database/schema';
import { NotFoundError } from '../errors';
import { getChildLogger } from '../logger';
import type { PlexService } from './plexService';

const log = getChildLogger('AuthService');

// Columns returned by every standard user query — plexToken intentionally excluded
const publicUserColumns = {
  id: users.id,
  email: users.email,
  plexUsername: users.plexUsername,
  plexId: users.plexId,
  avatar: users.avatar,
  userType: users.userType,
  isActive: users.isActive,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

export class AuthService {
  private readonly db: DrizzleDb;
  private readonly plexService: PlexService;

  constructor({ db, plexService }: { db: DrizzleDb; plexService: PlexService }) {
    this.db = db;
    this.plexService = plexService;
  }

  async authenticateWithPlex(authToken: string): Promise<PublicUser> {
    const plexUser = await this.plexService.getUserByToken(authToken);
    const email = plexUser.email.toLowerCase();

    // Find by plexId OR email
    const existing = await this.db
      .select(publicUserColumns)
      .from(users)
      .where(or(eq(users.plexId, plexUser.id), eq(users.email, email)))
      .limit(1);

    if (existing.length === 0) {
      const [created] = await this.db
        .insert(users)
        .values({
          email,
          plexUsername: plexUser.username,
          plexId: plexUser.id,
          plexToken: authToken,
          avatar: plexUser.thumb ?? null,
          userType: UserType.PLEX,
          isActive: true,
        })
        .returning(publicUserColumns);

      log.info('Created new Plex user', { userId: created.id, plexId: plexUser.id });
      return created;
    }

    const [current] = existing;
    await this.db
      .update(users)
      .set({
        plexToken: authToken,
        plexUsername: plexUser.username,
        avatar: plexUser.thumb ?? null,
        ...(current.plexId === null ? { plexId: plexUser.id } : {}),
      })
      .where(eq(users.id, current.id));

    // Re-fetch with updated fields (updatedAt was auto-updated by $onUpdateFn)
    const [updated] = await this.db
      .select(publicUserColumns)
      .from(users)
      .where(eq(users.id, current.id));

    log.info('Updated Plex user', { userId: updated.id, plexId: plexUser.id });
    return updated;
  }

  async getUserById(userId: number): Promise<PublicUser> {
    const rows = await this.db
      .select(publicUserColumns)
      .from(users)
      .where(and(eq(users.id, userId), eq(users.isActive, true)));

    if (rows.length === 0) {
      throw new NotFoundError(`User ${userId} not found`);
    }

    return rows[0];
  }
}

export type AuthServiceType = AuthService;
