import type { DrizzleDb } from '../database';
import type { MetadataProvider, MetadataProviderType } from '../database/schema';
import { getChildLogger } from '../logger';
import { type IProviderFactory, ProviderFactory } from '../providers/providerFactory';
import type { RadarrProvider } from '../providers/radarrProvider';
import type { SonarrProvider } from '../providers/sonarrProvider';
import type { AutomationRunService } from './automationRunService';
import type { AutomationQuerySourceDto, AutomationService } from './automationService';
import type { DomainEventBus } from './eventBus';
import { MediaQueryEngine } from './mediaQueryEngine';
import type { ProviderSettingsService } from './providerSettingsService';
import type { SavedQueryService } from './savedQueryService';
import { taskManifest } from './taskManifest';

const log = getChildLogger('AutomationExecutor');

export interface SystemTaskRunnerLike {
  run(taskId: string): Promise<number>;
}

interface ExecutorDeps {
  automationService: AutomationService;
  automationRunService: AutomationRunService;
  providerSettingsService: ProviderSettingsService;
  savedQueryService: SavedQueryService;
  providerFactory?: IProviderFactory;
  mediaQueryEngine?: MediaQueryEngine;
  db?: DrizzleDb;
  systemTaskRunner?: SystemTaskRunnerLike;
  eventBus?: DomainEventBus;
}

// ─── Executor ─────────────────────────────────────────────────────────────────

export class AutomationExecutor {
  private readonly automationService: AutomationService;
  private readonly automationRunService: AutomationRunService;
  private readonly providerSettingsService: ProviderSettingsService;
  private readonly savedQueryService: SavedQueryService;
  private readonly providerFactory: IProviderFactory;
  private readonly mediaQueryEngine: MediaQueryEngine;
  private readonly systemTaskRunner?: SystemTaskRunnerLike;
  private readonly eventBus?: DomainEventBus;
  private readonly inFlight = new Set<number>();

  constructor(deps: ExecutorDeps) {
    this.automationService = deps.automationService;
    this.automationRunService = deps.automationRunService;
    this.providerSettingsService = deps.providerSettingsService;
    this.savedQueryService = deps.savedQueryService;
    this.providerFactory = deps.providerFactory ?? new ProviderFactory();
    this.mediaQueryEngine = deps.mediaQueryEngine ?? new MediaQueryEngine({ db: deps.db });
    this.systemTaskRunner = deps.systemTaskRunner;
    this.eventBus = deps.eventBus;
  }

  async execute(automationId: number): Promise<void> {
    if (this.inFlight.has(automationId)) return;
    this.inFlight.add(automationId);

    let itemCount = 0;
    let kind: 'user' | 'system' = 'user';
    let taskId = '';

    try {
      const automation = await this.automationService.getById(automationId);
      kind = automation.kind;
      taskId = automation.taskId;

      this.eventBus?.emit('run:started', {
        automationId,
        kind,
        taskId: automation.taskId,
        startedAt: new Date(),
      });

      if (automation.kind === 'system') {
        if (!this.systemTaskRunner) {
          throw new Error('System automation requires a systemTaskRunner');
        }
        itemCount = await this.systemTaskRunner.run(automation.taskId);
        await this.recordResult(automationId, taskId, { itemCount, status: 'success', kind });

        this.emitDataChange(SYSTEM_TASKS[taskId]?.affects, itemCount);

        log.info('System automation executed', {
          automationId,
          taskId: automation.taskId,
          itemCount,
        });
        return;
      }

      if (!automation.provider) {
        throw new Error(`Automation ${automationId} has no provider — cannot execute`);
      }

      const sources = automation.querySources ?? [];

      if (!sources.length) {
        throw new Error(`Automation ${automationId} has no query sources — cannot execute`);
      }

      const providerSettings = await this.providerSettingsService.findById(automation.provider.id);
      itemCount = await this.executeWithSources(automation.taskId, providerSettings, sources);
      await this.recordResult(automationId, taskId, { itemCount, status: 'success', kind });

      const descriptor = taskManifest(automation.provider.type as MetadataProviderType).find(
        (t) => t.id === taskId
      );
      this.emitDataChange(descriptor?.affects, itemCount);

      log.info('Automation executed', { automationId, taskId: automation.taskId, itemCount });
    } catch (err) {
      log.error('Automation execution failed', { automationId, err });
      await this.recordResult(automationId, taskId, {
        itemCount,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        kind,
      });
    } finally {
      this.inFlight.delete(automationId);
    }
  }

  private async executeWithSources(
    taskId: string,
    providerSettings: MetadataProvider,
    sources: AutomationQuerySourceDto[]
  ): Promise<number> {
    const queryDtos = await Promise.all(
      sources.map((s) => this.savedQueryService.getById(s.queryId))
    );
    const contentType = queryDtos[0].contentType;
    const source = this.providerFactory.create(providerSettings, log) as
      | RadarrProvider
      | SonarrProvider;

    const matched = await this.mediaQueryEngine.evaluate({
      source,
      contentType,
      sources: sources.map((s, i) => ({ filterValues: queryDtos[i].filterValues, role: s.role })),
    });
    const finalIds = matched.map((item) => source.idOf(item)!);

    const task = taskManifest(providerSettings.type).find((t) => t.id === taskId);
    if (!task) throw new Error(`Task "${taskId}" is not yet implemented`);
    await task.run(source, finalIds);
    return finalIds.length;
  }

  /**
   * Emits the namespaced `<scope>:changed` event when a run with a declared data
   * scope actually changed items. The payload is empty — consumers evict the whole
   * scope, so the event need only signal *that* the scope changed.
   */
  private emitDataChange(affects: 'media' | undefined, itemCount: number): void {
    if (affects && itemCount > 0) {
      this.eventBus?.emit(`${affects}:changed`, {});
    }
  }

  private async recordResult(
    automationId: number,
    taskId: string,
    result: {
      itemCount: number;
      status: 'success' | 'error';
      error?: string;
      kind: 'user' | 'system';
    }
  ): Promise<void> {
    const [, run] = await Promise.all([
      this.automationService.recordRun(automationId, result),
      this.automationRunService.createRun({
        automationId,
        status: result.status,
        itemCount: result.itemCount,
        error: result.error,
        kind: result.kind,
      }),
    ]);

    this.eventBus?.emit('run:completed', {
      automationId,
      kind: result.kind,
      taskId,
      status: result.status,
      itemCount: result.itemCount,
      error: result.error,
      finishedAt: new Date(),
      runId: run.id,
      ranAt: run.ranAt,
    });
  }
}

// System data jobs span every source, so they declare scope but no sourceType —
// a `media:changed` from here evicts both movie and series caches.
export const SYSTEM_TASKS: Record<string, { affects?: 'media' }> = {
  'system:enrichment': { affects: 'media' },
  'system:identity-resolution': { affects: 'media' },
};
