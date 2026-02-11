import { UnauthorizedError } from '@server/errors';
import type { AuthService } from '@server/services/authService';
import { defineRoute } from '@server/utils/defineRoute';
import { authSchemas } from './auth.schemas';

export function createAuthHandlers({ authService }: { authService: AuthService }) {
  return {
    plexLogin: defineRoute({
      schemas: authSchemas.plexLogin,
      handler: async ({ body, req }) => {
        const user = await authService.authenticateWithPlex(body.authToken);

        // Set session
        if (req.session) {
          req.session.userId = user.id;
        }

        // Remove sensitive field
        const { plexToken, ...safeUser } = user;
        return safeUser;
      },
    }),

    getMe: defineRoute({
      schemas: authSchemas.getMe,
      handler: async ({ req }) => {
        if (!req.user) {
          throw new UnauthorizedError('Not authenticated');
        }

        const { plexToken, ...safeUser } = req.user;
        return safeUser;
      },
    }),

    logout: defineRoute({
      schemas: authSchemas.logout,
      handler: async ({ req }) => {
        return new Promise((resolve, reject) => {
          req.session.destroy((err) => {
            if (err) reject(err);
            else resolve({ success: true });
          });
        });
      },
    }),
  };
}
