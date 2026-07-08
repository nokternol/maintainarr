import { type AwilixContainer, InjectionMode, asClass, asValue, createContainer } from 'awilix';
import type { NextFunction, Request, Response } from 'express';
import { AutomationScheduler } from './cron/automationScheduler';
import { EnrichmentJobFactory } from './jobs/enrichmentJobFactory';
import { IdentityJobFactory } from './jobs/identityJobFactory';
import type { AppConfig } from './kernel/config';
import type { DrizzleDb } from './kernel/db';
import { DomainEventBus } from './kernel/eventBus';
import { getChildLogger } from './kernel/logger';
import { MediaSourceFactory } from './providers/mediaSourceFactory';
import { ProviderFactory } from './providers/providerFactory';
import { AuthService } from './services/authService';
import { AutomationExecutor } from './services/automationExecutor';
import { AutomationRunService } from './services/automationRunService';
import { AutomationService } from './services/automationService';
import { MediaQueryEngine } from './services/mediaQueryEngine';
import { MediaQueryService } from './services/mediaQueryService';
import { PlexService } from './services/plexService';
import { ProviderSettingsService } from './services/providerSettingsService';
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
  eventBus: DomainEventBus;
  tmdbService: TmdbService;
  plexService: PlexService;
  authService: AuthService;
  providerSettingsService: ProviderSettingsService;
  mediaQueryService: MediaQueryService;
  mediaQueryEngine: MediaQueryEngine;
  automationService: AutomationService;
  automationRunService: AutomationRunService;
  providerFactory: ProviderFactory;
  mediaSourceFactory: MediaSourceFactory;
  identityJobFactory: IdentityJobFactory;
  enrichmentJobFactory: EnrichmentJobFactory;
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
    eventBus: asClass(DomainEventBus).singleton(),

    // Services
    tmdbService: asClass(TmdbService).singleton(),
    plexService: asClass(PlexService).scoped(),
    authService: asClass(AuthService).scoped(),
    providerSettingsService: asClass(ProviderSettingsService).singleton(),
    mediaQueryService: asClass(MediaQueryService).singleton(),
    mediaQueryEngine: asClass(MediaQueryEngine).singleton(),
    automationService: asClass(AutomationService).singleton(),
    automationRunService: asClass(AutomationRunService).singleton(),
    providerFactory: asClass(ProviderFactory).singleton(),
    mediaSourceFactory: asClass(MediaSourceFactory).singleton(),
    identityJobFactory: asClass(IdentityJobFactory).singleton(),
    enrichmentJobFactory: asClass(EnrichmentJobFactory).singleton(),
    systemTaskRunner: asClass(SystemTaskRunner).singleton(),
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
