import { type AwilixContainer, InjectionMode, asClass, asValue, createContainer } from 'awilix';
import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from './config';
import { AutomationScheduler } from './cron/automationScheduler';
import type { DrizzleDb } from './database';
import { getChildLogger } from './logger';
import { AuthService } from './services/authService';
import type { AuthService as AuthServiceType } from './services/authService';
import { AutomationService } from './services/automationService';
import type { AutomationService as AutomationServiceType } from './services/automationService';
import { PlexService } from './services/plexService';
import type { PlexService as PlexServiceType } from './services/plexService';
import { ProviderSettingsService } from './services/providerSettingsService';
import type { ProviderSettingsService as ProviderSettingsServiceType } from './services/providerSettingsService';
import { SavedQueryService } from './services/savedQueryService';
import type { SavedQueryService as SavedQueryServiceType } from './services/savedQueryService';
import { TmdbService } from './services/tmdbService';
import type { TmdbService as TmdbServiceType } from './services/tmdbService';

const log = getChildLogger('Container');

/**
 * Registered dependencies available via the container.
 * Extend this interface when adding new services.
 */
export interface Cradle {
  config: AppConfig;
  db: DrizzleDb;
  tmdbService: TmdbServiceType;
  plexService: PlexServiceType;
  authService: AuthServiceType;
  providerSettingsService: ProviderSettingsServiceType;
  savedQueryService: SavedQueryServiceType;
  automationService: AutomationServiceType;
  automationScheduler: AutomationScheduler;
}

let container: AwilixContainer<Cradle> | null = null;

/**
 * Build the DI container with runtime dependencies.
 * Call once during server startup after config and DB are initialized.
 */
export function buildContainer(deps: {
  config: AppConfig;
  db: DrizzleDb;
}): AwilixContainer<Cradle> {
  container = createContainer<Cradle>({
    injectionMode: InjectionMode.PROXY,
    strict: true,
  });

  container.register({
    config: asValue(deps.config),
    db: asValue(deps.db),

    // Services
    tmdbService: asClass(TmdbService).singleton(),
    plexService: asClass(PlexService).scoped(),
    authService: asClass(AuthService).scoped(),
    providerSettingsService: asClass(ProviderSettingsService).scoped(),
    savedQueryService: asClass(SavedQueryService).scoped(),
    automationService: asClass(AutomationService).scoped(),
    automationScheduler: asClass(AutomationScheduler).singleton(),
  });

  log.info('Container built', {
    registrations: Object.keys(container.registrations),
  });

  return container;
}

/**
 * Get the built container. Throws if buildContainer() hasn't been called.
 */
export function getContainer(): AwilixContainer<Cradle> {
  if (!container) {
    throw new Error('Container not built. Call buildContainer() at startup.');
  }
  return container;
}

/**
 * Express middleware that creates a scoped container per request.
 * The scoped container inherits all registrations and can have
 * request-specific values added (e.g., requestId, user).
 */
export function scopePerRequest(req: Request, _res: Response, next: NextFunction): void {
  const scopedContainer = getContainer().createScope();
  req.scope = scopedContainer;
  next();
}
