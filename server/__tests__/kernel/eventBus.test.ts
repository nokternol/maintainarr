import { DomainEventBus } from '@server/kernel/eventBus';
import { describe, expect, it } from 'vitest';

describe('DomainEventBus', () => {
  it('delivers a published typed event to a subscriber', () => {
    const bus = new DomainEventBus();
    const received: Array<{ automationId: number }> = [];

    bus.on('run:started', (payload) => received.push(payload));
    bus.emit('run:started', {
      automationId: 7,
      kind: 'user',
      taskId: 'unmonitorMovie',
      startedAt: new Date(),
    });

    expect(received).toHaveLength(1);
    expect(received[0].automationId).toBe(7);
  });
});
