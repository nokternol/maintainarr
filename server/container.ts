import { type MediaCradle, registerMediaDependencies } from '@server/modules/media';
import {
  type ProvidersCradle,
  registerProvidersDependencies,
} from '@server/modules/providers/index';
import { type AwilixContainer, asClass } from 'awilix';
import type { NextFunction, Request, Response } from 'express';
import { AutomationScheduler } from './cron/automationScheduler';
import type { AppConfig } from './kernel/config';
import { type KernelCradle, createKernelContainer } from './kernel/container';
import type { DrizzleDb } from './kernel/db';
import { getChildLogger } from './kernel/logger';
import { AuthService } from './services/authService';
import { AutomationExecutor } from './services/automationExecutor';
import { AutomationRunService } from './services/automationRunService';
import { AutomationService } from './services/automationService';
import { MediaQueryService } from './services/mediaQueryService';
import { SystemTaskRunner } from './services/systemTaskRunner';

const log = getChildLogger('Container');

/**
 * Registered dependencies available via the container.
 * Extend this interface when adding new services.
 */
export interface Cradle extends KernelCradle, MediaCradle, ProvidersCradle {
  authService: AuthService;
  mediaQueryService: MediaQueryService;
  automationService: AutomationService;
  automationRunService: AutomationRunService;
  systemTaskRunner: SystemTaskRunner;
  automationExecutor: AutomationExecutor;
  automationScheduler: AutomationScheduler;
}

let container: AwilixContainer<Cradle> | null = null;

/**
 * Build the DI container with runtime dependencies. This is assembly: it
 * starts from the kernel mechanism (`createKernelContainer`), then registers
 * app-level services and each module's dependencies on top. Call once during
 * server startup after config and DB are initialized.
 */
export function buildContainer(deps: {
  config: AppConfig;
  db: DrizzleDb;
}): AwilixContainer<Cradle> {
  container = createKernelContainer<Cradle>(deps);

  container.register({
    // Services
    authService: asClass(AuthService).scoped(),
    mediaQueryService: asClass(MediaQueryService).singleton(),
    automationService: asClass(AutomationService).singleton(),
    automationRunService: asClass(AutomationRunService).singleton(),
    systemTaskRunner: asClass(SystemTaskRunner).singleton(),
    automationExecutor: asClass(AutomationExecutor).singleton(),
    automationScheduler: asClass(AutomationScheduler).singleton(),
  });
  registerMediaDependencies(container);
  registerProvidersDependencies(container);

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
