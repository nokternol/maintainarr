import { UnauthorizedError } from '@server/kernel/errors';
import { getChildLogger } from '@server/kernel/logger';
import ky from 'ky';

const log = getChildLogger('PlexService');

interface PlexUser {
  id: number;
  email: string;
  username: string;
  thumb?: string;
}

interface PlexApiUser {
  id: number;
  email: string;
  username?: string;
  title?: string;
  thumb?: string;
}

export class PlexService {
  private readonly baseUrl = 'https://plex.tv';

  async getUserByToken(authToken: string): Promise<PlexUser> {
    try {
      log.debug('Fetching Plex user info');

      const user = await ky
        .get(`${this.baseUrl}/api/v2/user`, {
          headers: { 'X-Plex-Token': authToken, Accept: 'application/json' },
        })
        .json<PlexApiUser>();

      log.info('Plex user fetched', { userId: user.id });

      return {
        id: user.id,
        email: user.email,
        username: user.username || user.title || '',
        thumb: user.thumb,
      };
    } catch (error) {
      log.error('Failed to fetch Plex user', { error });
      throw new UnauthorizedError('Invalid Plex token');
    }
  }
}
