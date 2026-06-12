import {
  type AwilixContainer,
  InjectionMode,
  asClass,
  asFunction,
  asValue,
  createContainer,
} from 'awilix';
import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from './config';
import { AutomationScheduler } from './cron/automationScheduler';
import type { DrizzleDb } from './database';
import { getChildLogger } from './logger';
import { ProviderFactory } from './providers/providerFactory';
import { AuthService } from './services/authService';
import { AutomationExecutor } from './services/automationExecutor';
import { AutomationRunService } from './services/automationRunService';
import { AutomationService } from './services/automationService';
import { PlexService } from './services/plexService';
import { ProviderSettingsService } from './services/providerSettingsService';
import { SavedQueryService } from './services/savedQueryService';
import { SystemTaskRunner } from './services/systemTaskRunner';
import { TmdbService } from './services/tmdbService';

const log = getChildLogger('Container');

/**
 * Registered dependencies available via the container.
 * Extend this interface when adding new services.
 */
export interface Cradle {
  config: AppConfig;
  db: DrizzleDb;
  tmdbService: TmdbService;
  plexService: PlexService;
  authService: AuthService;
  providerSettingsService: ProviderSettingsService;
  savedQueryService: SavedQueryService;
  automationService: AutomationService;
  automationRunService: AutomationRunService;
  providerFactory: ProviderFactory;
  systemTaskRunner: SystemTaskRunner;
  automationExecutor: AutomationExecutor;
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
    providerSettingsService: asClass(ProviderSettingsService).singleton(),
    savedQueryService: asClass(SavedQueryService).singleton(),
    automationService: asClass(AutomationService).singleton(),
    automationRunService: asClass(AutomationRunService).singleton(),
    providerFactory: asClass(ProviderFactory).singleton(),
    // asFunction: pass only registered cradle keys; the runner's test-only job-factory
    // seams stay undefined so its defaults (real provider resolution) are used.
    systemTaskRunner: asFunction(
      (cradle: Cradle) =>
        new SystemTaskRunner({
          providerSettingsService: cradle.providerSettingsService,
          providerFactory: cradle.providerFactory,
          db: cradle.db,
        })
    ).singleton(),
    automationExecutor: asClass(AutomationExecutor).singleton(),
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
