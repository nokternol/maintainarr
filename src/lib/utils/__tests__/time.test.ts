import { describe, expect, it } from 'vitest';
import { relativeTime, safeHumanSchedule } from '../time';

describe('relativeTime', () => {
  it('formats a past time in minutes', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000);
    expect(relativeTime(fiveMinutesAgo)).toBe('5m ago');
  });

  it('formats a future time in minutes', () => {
    const inTenMinutes = new Date(Date.now() + 10 * 60_000);
    expect(relativeTime(inTenMinutes)).toBe('in 10m');
  });
});

describe('safeHumanSchedule', () => {
  it('returns human-readable string for valid cron', () => {
    expect(safeHumanSchedule('0 2 * * *')).toBe('At 02:00');
  });

  it('returns "Invalid cron expression" for invalid input', () => {
    expect(safeHumanSchedule('not a cron')).toBe('Invalid cron expression');
  });
});
