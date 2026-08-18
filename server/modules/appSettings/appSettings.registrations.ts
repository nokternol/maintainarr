import { type AwilixContainer, type NameAndRegistrationPair, asClass } from 'awilix';
import { AppSettingsService } from './appSettingsService';

export interface AppSettingsCradle {
  appSettingsService: AppSettingsService;
}

export function registerAppSettingsDependencies<TCradle extends AppSettingsCradle>(
  container: AwilixContainer<TCradle>
): void {
  const registrations: NameAndRegistrationPair<AppSettingsCradle> = {
    appSettingsService: asClass(AppSettingsService).singleton(),
  };
  container.register(registrations as NameAndRegistrationPair<TCradle>);
}
