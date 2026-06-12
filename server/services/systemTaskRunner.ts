export interface IdentityJobLike {
  runForMovies(): Promise<void>;
  runForSeries(): Promise<void>;
  runForPlex(): Promise<void>;
}

export interface EnrichmentJobLike {
  run(): Promise<void>;
}

export interface IdentityJobFactoryLike {
  create(): Promise<IdentityJobLike>;
}

export interface EnrichmentJobFactoryLike {
  create(): Promise<EnrichmentJobLike>;
}

export interface SystemTaskRunnerDeps {
  identityJobFactory: IdentityJobFactoryLike;
  enrichmentJobFactory: EnrichmentJobFactoryLike;
}

export class SystemTaskRunner {
  private readonly identityJobFactory: IdentityJobFactoryLike;
  private readonly enrichmentJobFactory: EnrichmentJobFactoryLike;

  constructor(deps: SystemTaskRunnerDeps) {
    this.identityJobFactory = deps.identityJobFactory;
    this.enrichmentJobFactory = deps.enrichmentJobFactory;
  }

  async run(taskId: string): Promise<void> {
    if (taskId === 'system:identity-resolution') {
      const job = await this.identityJobFactory.create();
      await job.runForMovies();
      await job.runForSeries();
      await job.runForPlex();
      return;
    }
    if (taskId === 'system:enrichment') {
      const job = await this.enrichmentJobFactory.create();
      await job.run();
      return;
    }
    throw new Error(`Task "${taskId}" is not yet implemented`);
  }
}
