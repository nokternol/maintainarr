/**
 * AutomationScheduler unit tests.
 *
 * Run: vitest run --project server
 */
import { AutomationScheduler } from '@server/cron/automationScheduler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('AutomationScheduler', () => {
  describe('construction', () => {
    it('throws at construction time when automationExecutor is missing', () => {
      expect(() => new AutomationScheduler({} as any)).toThrow(/executor/i);
    });

    it('throws when automationExecutor is explicitly undefined', () => {
      expect(() => new AutomationScheduler({ automationExecutor: undefined as any })).toThrow(
        /executor/i
      );
    });

    it('constructs successfully with a valid executor', () => {
      const executor = { execute: vi.fn().mockResolvedValue(undefined) };
      expect(() => new AutomationScheduler({ automationExecutor: executor })).not.toThrow();
    });
  });

  describe('tick behaviour', () => {
    let scheduler: AutomationScheduler;
    const mockExecutor = { execute: vi.fn<(id: number) => Promise<void>>() };

    beforeEach(() => {
      mockExecutor.execute.mockResolvedValue(undefined);
      scheduler = new AutomationScheduler({ automationExecutor: mockExecutor });
    });

    afterEach(() => {
      scheduler.stopAll();
      vi.clearAllMocks();
    });

    it('calls executor.execute with the automation id on each tick', async () => {
      scheduler.schedule({ id: 7, name: 'Nightly', schedule: '* * * * *' });
      await scheduler.trigger(7);
      expect(mockExecutor.execute).toHaveBeenCalledWith(7);
    });

    it('does not call executor.execute for unregistered ids', async () => {
      scheduler.schedule({ id: 7, name: 'Nightly', schedule: '* * * * *' });
      await scheduler.trigger(999);
      expect(mockExecutor.execute).not.toHaveBeenCalled();
    });

    it('does not call executor.execute after the job is unscheduled', async () => {
      scheduler.schedule({ id: 7, name: 'Nightly', schedule: '* * * * *' });
      scheduler.unschedule(7);
      await scheduler.trigger(7);
      expect(mockExecutor.execute).not.toHaveBeenCalled();
    });
  });
});
