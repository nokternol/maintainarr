import type { DataSource } from 'typeorm';
import { User, UserType } from '../database/entities/User';
import { NotFoundError } from '../errors';
import { getChildLogger } from '../logger';
import type { PlexService } from './plexService';

const log = getChildLogger('AuthService');

export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly plexService: PlexService
  ) {}

  async authenticateWithPlex(authToken: string): Promise<User> {
    const userRepo = this.dataSource.getRepository(User);

    // Validate token with Plex
    const plexUser = await this.plexService.getUserByToken(authToken);

    // Find existing user
    let user = await userRepo
      .createQueryBuilder('user')
      .where('user.plexId = :plexId', { plexId: plexUser.id })
      .orWhere('user.email = :email', { email: plexUser.email.toLowerCase() })
      .getOne();

    if (!user) {
      // Create new user
      user = userRepo.create({
        email: plexUser.email.toLowerCase(),
        plexUsername: plexUser.username,
        plexId: plexUser.id,
        plexToken: authToken,
        avatar: plexUser.thumb ?? null,
        userType: UserType.PLEX,
        isActive: true,
      });

      await userRepo.save(user);
      log.info('Created new Plex user', { userId: user.id, plexId: plexUser.id });
    } else {
      // Update existing user
      user.plexToken = authToken;
      user.plexUsername = plexUser.username;
      user.avatar = plexUser.thumb ?? null;
      if (!user.plexId) user.plexId = plexUser.id;

      await userRepo.save(user);
      log.info('Updated Plex user', { userId: user.id, plexId: plexUser.id });
    }

    return user;
  }

  async getUserById(userId: number): Promise<User> {
    const userRepo = this.dataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId, isActive: true } });

    if (!user) {
      throw new NotFoundError(`User ${userId} not found`);
    }

    return user;
  }
}
