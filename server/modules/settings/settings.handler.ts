import { isAuthenticated } from '@server/middleware/auth';
import { defineRoute } from '@server/utils/defineRoute';
import type { ProviderSettingsService } from '@server/services/providerSettingsService';
import { settingsSchemas } from './settings.schemas';

interface SettingsCradle {
  providerSettingsService: ProviderSettingsService;
}

export function createSettingsHandlers(cradle: SettingsCradle) {
  const { providerSettingsService } = cradle;

  return {
    listProviders: [
      isAuthenticated(),
      defineRoute({
        handler: async () => {
          return providerSettingsService.list();
        },
      }),
    ],

    createProvider: [
      isAuthenticated(),
      defineRoute({
        schemas: settingsSchemas.createProvider,
        handler: async ({ body }) => {
          return providerSettingsService.create(body);
        },
      }),
    ],

    updateProvider: [
      isAuthenticated(),
      defineRoute({
        schemas: settingsSchemas.updateProvider,
        handler: async ({ params, body }) => {
          return providerSettingsService.update(params.id, body);
        },
      }),
    ],

    deleteProvider: [
      isAuthenticated(),
      defineRoute({
        schemas: settingsSchemas.deleteProvider,
        handler: async ({ params }) => {
          await providerSettingsService.delete(params.id);
          return null;
        },
      }),
    ],
  };
}
