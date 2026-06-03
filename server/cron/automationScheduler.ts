import { Cron } from 'croner';
import { getChildLogger } from '../logger';

const log = getChildLogger('AutomationScheduler');

interface Executor {
  execute(automationId: number): Promise<void>;
}

export class AutomationScheduler {
  private readonly jobs = new Map<number, Cron>();
  private readonly executor: Executor | null;

  constructor(executor?: Executor) {
    this.executor = executor ?? null;
  }

  schedule(automation: { id: number; name: string; schedule: string }): void {
    this.unschedule(automation.id);
    try {
      const job = new Cron(automation.schedule, { protect: true }, () => {
        if (this.executor) {
          this.executor.execute(automation.id).catch((err) => {
            log.error('Automation execution error', { id: automation.id, err });
          });
        } else {
          log.info('Automation tick — execution not yet implemented', {
            id: automation.id,
            name: automation.name,
            schedule: automation.schedule,
          });
        }
      });
      this.jobs.set(automation.id, job);
      log.debug('Automation scheduled', {
        id: automation.id,
        name: automation.name,
        schedule: automation.schedule,
        nextRun: job.nextRun()?.toISOString(),
      });
    } catch (err) {
      log.error('Failed to schedule automation', { id: automation.id, err });
    }
  }

  unschedule(id: number): void {
    const job = this.jobs.get(id);
    if (job) {
      job.stop();
      this.jobs.delete(id);
      log.debug('Automation unscheduled', { id });
    }
  }

  stopAll(): void {
    for (const [id, job] of this.jobs) {
      job.stop();
      log.debug('Automation stopped on shutdown', { id });
    }
    this.jobs.clear();
  }

  get count(): number {
    return this.jobs.size;
  }
}
