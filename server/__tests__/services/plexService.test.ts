import { UnauthorizedError } from '@server/kernel/errors';
import { PlexService } from '@server/services/plexService';
import { server } from '@tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

const PLEX_USER_URL = 'https://plex.tv/api/v2/user';

describe('PlexService', () => {
  const service = new PlexService();

  describe('getUserByToken()', () => {
    it('returns a shaped user on success', async () => {
      server.use(
        http.get(PLEX_USER_URL, () =>
          HttpResponse.json({
            id: 42,
            email: 'user@plex.tv',
            username: 'plexuser',
            thumb: 'https://plex.tv/avatar.png',
          })
        )
      );

      const user = await service.getUserByToken('valid-token');

      expect(user).toEqual({
        id: 42,
        email: 'user@plex.tv',
        username: 'plexuser',
        thumb: 'https://plex.tv/avatar.png',
      });
    });

    it('falls back to title when username is absent', async () => {
      server.use(
        http.get(PLEX_USER_URL, () =>
          HttpResponse.json({ id: 99, email: 'u@plex.tv', title: 'TitleUser' })
        )
      );

      const user = await service.getUserByToken('any-token');

      expect(user.username).toBe('TitleUser');
    });

    it('throws UnauthorizedError on HTTP failure', async () => {
      server.use(
        http.get(PLEX_USER_URL, () => HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      );

      await expect(service.getUserByToken('bad-token')).rejects.toThrow(UnauthorizedError);
    });
  });
});
